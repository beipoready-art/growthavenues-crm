import Link from "next/link";
import { FilterBar } from "@/components/filter-bar";
import { NewIpoButton } from "@/components/ipo-form";
import { Card, EmptyState, PageBody, PageHeader, Table, Td, Th } from "@/components/layout";
import { Badge } from "@/components/ui";
import { type SearchParams } from "@/lib/filters";
import { formatDate, formatINR } from "@/lib/format";
import { formatPriceBand, ipoOrder, ipoWhere, STATUS_RANK } from "@/lib/ipos";
import { IPO_STATUS_LABELS, IPO_STATUS_TONE, options } from "@/lib/labels";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/rbac";
import { requirePageUser } from "@/lib/session";

export default async function IposPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const user = await requirePageUser("ipos:view");
  const sp = await searchParams;
  const ipos = (
    await prisma.ipo.findMany({ where: ipoWhere(sp), orderBy: ipoOrder, include: { mandate: { select: { id: true, code: true, client: { select: { name: true } } } } } })
  ).sort((a, b) => STATUS_RANK[a.status] - STATUS_RANK[b.status]);

  return (
    <>
      <PageHeader title="IPO issues" description="Issues of our mandates, plus other IPOs we track for market reference" actions={can(user.role, "ipos:manage") && <NewIpoButton />} />
      <PageBody className="space-y-4">
        <FilterBar searchPlaceholder="Search company or symbol…" filters={[{ type: "select", key: "status", label: "Statuses", options: options(IPO_STATUS_LABELS) }]} />
        <Card>
          {ipos.length === 0 ? (
            <EmptyState title="No IPOs found" />
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th>Company</Th>
                  <Th>Price band</Th>
                  <Th>Lot size</Th>
                  <Th>Min. investment</Th>
                  <Th>Open – Close</Th>
                  <Th>Listing</Th>
                  <Th>Status</Th>
                  <Th>Our mandate</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {ipos.map((i) => (
                  <tr key={i.id} className="hover:bg-gray-50/60">
                    <Td>
                      <Link href={`/ipos/${i.id}`} className="font-medium text-gray-900 hover:text-brand-600">
                        {i.companyName}
                      </Link>
                      {i.symbol && <div className="text-xs text-gray-500">{i.symbol}</div>}
                    </Td>
                    <Td>{formatPriceBand(i.priceBandLow, i.priceBandHigh)}</Td>
                    <Td>{i.lotSize} shares</Td>
                    <Td>{formatINR(Number(i.priceBandHigh) * i.lotSize)}</Td>
                    <Td>
                      {formatDate(i.openDate)} – {formatDate(i.closeDate)}
                    </Td>
                    <Td>{formatDate(i.listingDate)}</Td>
                    <Td>
                      <Badge tone={IPO_STATUS_TONE[i.status]}>{IPO_STATUS_LABELS[i.status]}</Badge>
                    </Td>
                    <Td>
                      {i.mandate ? (
                        <Link href={`/mandates/${i.mandate.id}`} className="text-brand-600 hover:underline">
                          {i.mandate.code}
                        </Link>
                      ) : (
                        <span className="text-xs text-gray-400">Market tracker</span>
                      )}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Card>
      </PageBody>
    </>
  );
}
