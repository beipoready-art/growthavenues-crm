import Link from "next/link";
import { notFound } from "next/navigation";
import { DetailGrid } from "@/components/detail";
import { History } from "@/components/history";
import { EditIpoButton } from "@/components/ipo-form";
import { Card, PageBody, PageHeader } from "@/components/layout";
import { MandateList } from "@/components/mandate-list";
import { Badge } from "@/components/ui";
import { formatDate, formatINR } from "@/lib/format";
import { formatPriceBand, serializeIpo } from "@/lib/ipos";
import { IPO_STATUS_LABELS, IPO_STATUS_TONE } from "@/lib/labels";
import { canSeeMandate } from "@/lib/mandates";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/rbac";
import { requirePageUser } from "@/lib/session";

export default async function IpoPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePageUser("ipos:view");
  const { id } = await params;
  const ipo = await prisma.ipo.findUnique({
    where: { id },
    include: { mandate: { include: { client: { select: { id: true, name: true, assignedRmId: true } }, leadAdvisor: { select: { name: true } } } } },
  });
  if (!ipo) notFound();
  const mandate = ipo.mandate && canSeeMandate(user, ipo.mandate) ? ipo.mandate : null;

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
        <Card title="Our mandate">
          {mandate ? (
            <MandateList
              showClient
              mandates={[{ ...mandate, expectedFee: mandate.expectedFee == null ? null : Number(mandate.expectedFee), issueSizeCr: mandate.issueSizeCr == null ? null : Number(mandate.issueSizeCr) }]}
            />
          ) : (
            <p className="px-5 py-4 text-sm text-gray-500">
              {ipo.mandate ? "Linked to a mandate you don't have access to." : "Not one of our mandates — tracked for market reference. Link it from a mandate's page."}
            </p>
          )}
        </Card>
        <History entities={[{ type: "Ipo", id: ipo.id }]} />
      </PageBody>
    </>
  );
}
