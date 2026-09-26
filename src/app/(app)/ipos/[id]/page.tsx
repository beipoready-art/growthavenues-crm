import Link from "next/link";
import { notFound } from "next/navigation";
import { DetailGrid } from "@/components/detail";
import { History } from "@/components/history";
import { ApplicationsTable } from "@/components/ipo-applications";
import { EditIpoButton } from "@/components/ipo-form";
import { StatTile } from "@/components/stat";
import { Card, EmptyState, PageBody, PageHeader } from "@/components/layout";
import { Badge } from "@/components/ui";
import { formatDate, formatINR } from "@/lib/format";
import { formatPriceBand, serializeIpo } from "@/lib/ipos";
import { applicationInclude, summarize, toApplicationRow } from "@/lib/ipo-applications";
import { IPO_APP_STATUS_LABELS, IPO_APP_STATUS_TONE, IPO_STATUS_LABELS, IPO_STATUS_TONE } from "@/lib/labels";
import { prisma } from "@/lib/prisma";
import { can, isScopedToOwn, ownedScope } from "@/lib/rbac";
import { requirePageUser } from "@/lib/session";

export default async function IpoPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePageUser("ipos:view");
  const { id } = await params;
  const ipo = await prisma.ipo.findUnique({ where: { id } });
  if (!ipo) notFound();
  const scope = ownedScope(user);
  const [applications, notApplied] = await Promise.all([
    prisma.ipoApplication.findMany({ where: { ipoId: ipo.id, client: scope }, include: applicationInclude, orderBy: { applicationDate: "desc" } }),
    // Follow-up list during the subscription window: verified clients who haven't applied yet.
    ipo.status === "OPEN" || ipo.status === "UPCOMING"
      ? prisma.client.findMany({
          where: { ...scope, kycStatus: "VERIFIED", ipoApplications: { none: { ipoId: ipo.id } } },
          select: { id: true, name: true, phone: true, assignedRm: { select: { name: true } } },
          orderBy: { name: "asc" },
          take: 50,
        })
      : Promise.resolve([]),
  ]);
  const summary = summarize(applications);
  const scoped = isScopedToOwn(user.role);

  return (
    <>
      <PageHeader
        title={ipo.companyName}
        description={[ipo.symbol, ipo.exchange].filter(Boolean).join(" · ") || "IPO"}
        actions={can(user.role, "ipos:manage") && <EditIpoButton ipo={serializeIpo(ipo)} />}
      />
      <PageBody className="space-y-5">
        <Link href="/ipos" className="text-xs font-medium text-gray-500 hover:text-gray-900">
          ← All IPOs
        </Link>
        <Card title="Issue details">
          <DetailGrid
            items={[
              { label: "Status", value: <Badge tone={IPO_STATUS_TONE[ipo.status]}>{IPO_STATUS_LABELS[ipo.status]}</Badge> },
              { label: "Price band", value: formatPriceBand(ipo.priceBandLow, ipo.priceBandHigh) },
              { label: "Lot size", value: `${ipo.lotSize} shares` },
              { label: "Min. investment (1 lot @ upper band)", value: formatINR(Number(ipo.priceBandHigh) * ipo.lotSize) },
              { label: "Subscription window", value: `${formatDate(ipo.openDate)} – ${formatDate(ipo.closeDate)}` },
              { label: "Listing date", value: formatDate(ipo.listingDate) },
            ]}
          />
          {ipo.notes && (
            <div className="border-t border-gray-100 px-5 py-4">
              <p className="text-xs text-gray-500">Notes</p>
              <p className="mt-1 whitespace-pre-wrap text-sm text-gray-800">{ipo.notes}</p>
            </div>
          )}
        </Card>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatTile label={scoped ? "My clients applied" : "Clients applied"} value={summary.applications} />
          <StatTile label="Lots applied" value={summary.lots.toLocaleString("en-IN")} hint={`${(summary.lots * ipo.lotSize).toLocaleString("en-IN")} shares`} />
          <StatTile label="Total application amount" value={formatINR(summary.amount)} />
          <div className="rounded-xl border border-gray-200 bg-white px-5 py-4 shadow-sm">
            <p className="text-xs font-medium text-gray-500">Status breakdown</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {Object.entries(summary.byStatus)
                .filter(([, n]) => n > 0)
                .map(([s, n]) => (
                  <Badge key={s} tone={IPO_APP_STATUS_TONE[s as keyof typeof IPO_APP_STATUS_TONE]}>
                    {IPO_APP_STATUS_LABELS[s as keyof typeof IPO_APP_STATUS_LABELS]} · {n}
                  </Badge>
                ))}
              {summary.applications === 0 && <span className="text-sm text-gray-400">No applications</span>}
            </div>
          </div>
        </div>
        <Card title={scoped ? "My clients' applications" : "Client applications"}>
          <ApplicationsTable rows={applications.map((a) => toApplicationRow(a, user))} show="client" />
        </Card>
        {(ipo.status === "OPEN" || ipo.status === "UPCOMING") && (
          <Card title={`Follow up: verified clients not yet applied (${notApplied.length})`}>
            {notApplied.length === 0 ? (
              <EmptyState title="Every verified client has applied" />
            ) : (
              <ul className="divide-y divide-gray-100" data-testid="not-applied">
                {notApplied.map((c) => (
                  <li key={c.id}>
                    <Link href={`/clients/${c.id}`} className="flex items-center justify-between px-5 py-2.5 text-sm hover:bg-gray-50">
                      <span className="font-medium text-gray-900">{c.name}</span>
                      <span className="text-xs text-gray-500">
                        {c.phone} · {c.assignedRm?.name ?? "Unassigned"}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        )}
        <History entities={[{ type: "Ipo", id: ipo.id }]} />
      </PageBody>
    </>
  );
}
