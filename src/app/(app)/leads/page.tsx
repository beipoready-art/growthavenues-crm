import Link from "next/link";
import { FilterBar } from "@/components/filter-bar";
import { NewLeadButton } from "@/components/lead-form";
import { Card, EmptyState, PageBody, PageHeader, Table, Td, Th } from "@/components/layout";
import { Pagination } from "@/components/pagination";
import { Badge } from "@/components/ui";
import { PAGE_SIZE, pageParam, type SearchParams } from "@/lib/filters";
import { formatDate } from "@/lib/format";
import { LEAD_SOURCE_LABELS, LEAD_STATUS_LABELS, LEAD_STATUS_TONE, options } from "@/lib/labels";
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
        description={scoped ? "Leads assigned to you" : "All prospective clients"}
        actions={can(user.role, "leads:create") && <NewLeadButton rms={rms} canAssign={can(user.role, "leads:assign")} />}
      />
      <PageBody className="space-y-4">
        <FilterBar
          searchPlaceholder="Search name, phone, email…"
          filters={[
            { type: "select", key: "status", label: "Statuses", options: options(LEAD_STATUS_LABELS) },
            { type: "select", key: "source", label: "Sources", options: options(LEAD_SOURCE_LABELS) },
            ...(scoped
              ? []
              : [{ type: "select" as const, key: "rm", label: "RMs", allLabel: "All RMs", options: [{ value: "unassigned", label: "Unassigned" }, ...rms.map((r) => ({ value: r.id, label: r.name }))] }]),
            { type: "dateRange" },
          ]}
        />
        <Card>
          {leads.length === 0 ? (
            <EmptyState title="No leads found" description="Try adjusting your filters." />
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th>Name</Th>
                  <Th>Phone</Th>
                  <Th>Email</Th>
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
                        {l.name}
                      </Link>
                    </Td>
                    <Td>{l.phone}</Td>
                    <Td className="text-gray-500">{l.email ?? "—"}</Td>
                    <Td>{LEAD_SOURCE_LABELS[l.source]}</Td>
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
