import { csvDate, csvResponse, toCsv } from "@/lib/csv";
import { resolveRange } from "@/lib/date-range";
import { leadSourceReport } from "@/lib/reports";
import { handle, requireApiUser } from "@/lib/session";

export async function GET(req: Request) {
  return handle(async () => {
    const user = await requireApiUser("reports:view");
    const range = resolveRange(new URL(req.url).searchParams, new Date(), "quarter");
    const rows = await leadSourceReport(user, range.from, range.to);
    const csv = toCsv(
      ["Source", "Period from", "Period to", "Leads", "Converted", "Lost", "Open", "Conversion rate %", "Avg days to convert"],
      rows.map((r) => [r.label, csvDate(range.from), csvDate(range.to), r.leads, r.converted, r.lost, r.open, (r.conversionRate * 100).toFixed(1), r.avgDaysToConvert?.toFixed(1) ?? ""]),
    );
    return csvResponse("lead-source-effectiveness", csv);
  });
}
