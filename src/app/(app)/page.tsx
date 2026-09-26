import Link from "next/link";
import { HBarChart } from "@/components/charts";
import { Card, EmptyState } from "@/components/layout";
import { PageBody, PageHeader } from "@/components/layout";
import { StatTile } from "@/components/stat";
import { Badge } from "@/components/ui";
import { getDashboard } from "@/lib/dashboard";
import { formatDate } from "@/lib/format";
import { KYC_STATUS_TONE, LEAD_SOURCE_LABELS, LEAD_STATUS_LABELS, LEAD_STATUS_TONE, ROLE_LABELS } from "@/lib/labels";
import { can } from "@/lib/rbac";
import { requirePageUser } from "@/lib/session";

export default async function DashboardPage() {
  const user = await requirePageUser();
  const org = can(user.role, "dashboard:org");
  const d = await getDashboard(user);
  const pct = (n: number) => `${(n * 100).toFixed(0)}%`;

  return (
    <>
      <PageHeader
        title={org ? "Dashboard" : "My dashboard"}
        description={org ? `Firm-wide overview · ${ROLE_LABELS[user.role]}` : "Your assigned leads and clients"}
      />
      <PageBody className="space-y-5">
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatTile label={org ? "Total leads" : "My leads"} value={d.totalLeads} hint={`${d.openLeads} open`} href="/leads" />
          <StatTile label={org ? "Total clients" : "My clients"} value={d.totalClients} hint={`${pct(d.conversionRate)} lead conversion`} href="/clients" />
          <StatTile label="KYC pending" value={d.kycPending} hint="Pending, submitted or under review" href="/clients?kyc=PENDING" />
          <StatTile label="Awaiting compliance" value={d.kycAwaitingReview} hint="Submitted or under review" href="/kyc" />
        </div>

        <div className="grid gap-5 lg:grid-cols-2">
          <Card title="Leads by source">
            <div className="px-4 py-3">
              <HBarChart data={d.leadsBySource} ariaLabel="Leads by source" />
            </div>
          </Card>
          {org ? (
            <Card title="Leads by RM">
              <div className="px-4 py-3">
                {d.leadsByRm.length ? <HBarChart data={d.leadsByRm} ariaLabel="Leads by relationship manager" /> : <EmptyState title="No leads yet" />}
              </div>
            </Card>
          ) : (
            <Card title="My leads by status">
              <div className="px-4 py-3">
                <HBarChart data={d.leadsByStatus} ariaLabel="My leads by status" />
              </div>
            </Card>
          )}
        </div>

        <div className="grid gap-5 lg:grid-cols-3">
          <Card title="KYC status">
            <ul className="divide-y divide-gray-100">
              {d.kyc.map((k) => (
                <li key={k.status}>
                  <Link href={`/clients?kyc=${k.status}`} className="flex items-center justify-between px-5 py-2.5 text-sm hover:bg-gray-50">
                    <Badge tone={KYC_STATUS_TONE[k.status]}>{k.label}</Badge>
                    <span className="font-medium tabular-nums text-gray-900">{k.value}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </Card>
          <Card title={org ? "Latest open leads" : "My latest leads"} className="lg:col-span-2">
            {d.recentLeads.length === 0 ? (
              <EmptyState title="No open leads" />
            ) : (
              <ul className="divide-y divide-gray-100">
                {d.recentLeads.map((l) => (
                  <li key={l.id}>
                    <Link href={`/leads/${l.id}`} className="flex items-center justify-between gap-4 px-5 py-2.5 text-sm hover:bg-gray-50">
                      <div className="min-w-0">
                        <p className="truncate font-medium text-gray-900">{l.name}</p>
                        <p className="text-xs text-gray-500">
                          {LEAD_SOURCE_LABELS[l.source]} · {l.assignedRm?.name ?? "Unassigned"} · {formatDate(l.createdAt)}
                        </p>
                      </div>
                      <Badge tone={LEAD_STATUS_TONE[l.status]}>{LEAD_STATUS_LABELS[l.status]}</Badge>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </PageBody>
    </>
  );
}
