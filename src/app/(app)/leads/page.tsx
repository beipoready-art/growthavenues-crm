import Link from "next/link";
import { FilterBar } from "@/components/filter-bar";
import { NewLeadButton } from "@/components/lead-form";
import { Card, EmptyState, PageBody, PageHeader, Table, Td, Th } from "@/components/layout";
import { Pagination } from "@/components/pagination";
import { Badge } from "@/components/ui";
import { PAGE_SIZE, pageParam, type SearchParams } from "@/lib/filters";
import { formatDate } from "@/lib/format";
import { LEAD_SOURCE_LABELS, LEAD_STATUS_LABELS, LEAD_STATUS_TONE, options, SERVICE_LABELS, SERVICE_SHORT_LABELS } from "@/lib/labels";
import { leadListInclude, leadWhere } from "@/lib/leads";
import { prisma } from "@/lib/prisma";
import { can, isScopedToOwn } from "@/lib/rbac";
import { requirePageUser } from "@/lib/session";
import { listRms } from "@/lib/users";

export default async function LeadsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const user = await requirePageUser("leads:view");
  const sp = await searchParams;
  const where = leadWhere(user, sp);
  const page = pageParam(sp);
  const [total, leads, rms] = await Promise.all([
    prisma.lead.count({ where }),
    prisma.lead.findMany({ where, include: leadListInclude, orderBy: { createdAt: "desc" }, skip: (page - 1) * PAGE_SIZE, take: PAGE_SIZE }),
    listRms(),
  ]);
  const scoped = isScopedToOwn(user.role);

  return (
    <>
      <PageHeader
        title="Leads"
        description={scoped ? "Company enquiries assigned to you" : "Companies enquiring about fund raising, IPOs and advisory"}
        actions={can(user.role, "leads:create") && <NewLeadButton rms={rms} canAssign={can(user.role, "leads:assign")} />}
      />
      <PageBody className="space-y-4">
        <FilterBar
          searchPlaceholder="Search company, contact, phone, email…"
          filters={[
            { type: "select", key: "status", label: "Statuses", options: options(LEAD_STATUS_LABELS) },
            { type: "select", key: "service", label: "Services", options: options(SERVICE_LABELS) },
            { type: "select", key: "source", label: "Sources", options: options(LEAD_SOURCE_LABELS) },
            ...(scoped
              ? []
              : [{ type: "select" as const, key: "rm", label: "RMs", allLabel: "All RMs", options: [{ value: "unassigned", label: "Unassigned" }, ...rms.map((r) => ({ value: r.id, label: r.name }))] }]),
            { type: "dateRange" },
          ]}
        />
        <Card>
          {leads.length === 0 ? (
            <EmptyState title="No enquiries found" description="Try adjusting your filters." />
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th>Company</Th>
                  <Th>Contact</Th>
                  <Th>Service</Th>
                  <Th className="text-right">Revenue</Th>
                  <Th>Source</Th>
                  <Th>Status</Th>
                  <Th>Assigned RM</Th>
                  <Th>Created</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {leads.map((l) => (
                  <tr key={l.id} className="hover:bg-gray-50/60">
                    <Td>
                      <Link href={`/leads/${l.id}`} className="font-medium text-gray-900 hover:text-brand-600">
                        {l.companyName}
                      </Link>
                      {(l.sector || l.city) && <div className="text-xs text-gray-500">{[l.sector, l.city].filter(Boolean).join(" · ")}</div>}
                    </Td>
                    <Td>
                      {l.name}
                      <div className="text-xs text-gray-500">{l.phone}</div>
                    </Td>
                    <Td>{l.serviceInterest ? SERVICE_SHORT_LABELS[l.serviceInterest] : <span className="text-gray-400">—</span>}</Td>
                    <Td className="text-right tabular-nums">{l.revenueCr != null ? `₹${Number(l.revenueCr)} Cr` : "—"}</Td>
                    <Td>
                      {LEAD_SOURCE_LABELS[l.source]}
                      {l.readinessScore != null && <div className="text-xs text-gray-500">Readiness {l.readinessScore}/100</div>}
                    </Td>
                    <Td>
                      <Badge tone={LEAD_STATUS_TONE[l.status]}>{LEAD_STATUS_LABELS[l.status]}</Badge>
                    </Td>
                    <Td>{l.assignedRm?.name ?? <span className="text-gray-400">Unassigned</span>}</Td>
                    <Td>{formatDate(l.createdAt)}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
          <Pagination total={total} page={page} pathname="/leads" searchParams={sp} />
        </Card>
      </PageBody>
    </>
  );
}
