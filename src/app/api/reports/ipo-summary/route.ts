import { csvDate, csvResponse, toCsv } from "@/lib/csv";
import { summarize } from "@/lib/ipo-applications";
import { ipoWhere } from "@/lib/ipos";
import { IPO_STATUS_LABELS } from "@/lib/labels";
import { prisma } from "@/lib/prisma";
import { ownedScope } from "@/lib/rbac";
import { handle, requireApiUser } from "@/lib/session";

/** One row per IPO: subscription totals and application status breakdown (RM-scoped). */
export async function GET(req: Request) {
  return handle(async () => {
    const user = await requireApiUser("reports:view");
    const ipos = await prisma.ipo.findMany({
      where: ipoWhere(new URL(req.url).searchParams),
      include: { applications: { where: { client: ownedScope(user) }, select: { lotsApplied: true, amount: true, status: true } } },
      orderBy: { openDate: "desc" },
    });
    const csv = toCsv(
      ["IPO", "Status", "Open date", "Close date", "Listing date", "Price band low", "Price band high", "Lot size", "Clients applied", "Lots applied", "Total amount (INR)", "Applied", "Allotted", "Partially allotted", "Rejected", "Refunded"],
      ipos.map((i) => {
        const s = summarize(i.applications);
        return [
          i.companyName,
          IPO_STATUS_LABELS[i.status],
          csvDate(i.openDate),
          csvDate(i.closeDate),
          csvDate(i.listingDate),
          Number(i.priceBandLow),
          Number(i.priceBandHigh),
          i.lotSize,
          s.applications,
          s.lots,
          s.amount.toFixed(2),
          s.byStatus.APPLIED,
          s.byStatus.ALLOTTED,
          s.byStatus.PARTIALLY_ALLOTTED,
          s.byStatus.REJECTED,
          s.byStatus.REFUNDED,
        ];
      }),
    );
    return csvResponse("ipo-subscription-summary", csv);
  });
}
