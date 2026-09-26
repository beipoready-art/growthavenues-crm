import { csvDate, csvResponse, toCsv } from "@/lib/csv";
import { resolveRange } from "@/lib/date-range";
import { getRmPerformance } from "@/lib/performance";
import { can } from "@/lib/rbac";
import { handle, HttpError, requireApiUser } from "@/lib/session";

/** RM performance for ?range= (RMs get only their own row). */
export async function GET(req: Request) {
  return handle(async () => {
    const user = await requireApiUser("reports:view");
    const all = can(user.role, "performance:viewAll");
    if (!all && !can(user.role, "performance:viewOwn")) throw new HttpError(403, "You do not have access to RM performance");
    const range = resolveRange(new URL(req.url).searchParams);
    const rows = await getRmPerformance(range.from, range.to, all ? undefined : [user.id]);
    const csv = toCsv(
      ["RM", "Active", "Period from", "Period to", "Leads assigned", "Leads converted", "Conversion rate %", "Clients under management", "IPO applications", "Application value (INR)"],
      rows.map((r) => [
        r.name,
        r.active ? "Yes" : "No",
        csvDate(range.from),
        csvDate(range.to),
        r.leadsAssigned,
        r.leadsConverted,
        (r.conversionRate * 100).toFixed(1),
        r.clientsUnderManagement,
        r.ipoApplications,
        r.applicationValue.toFixed(2),
      ]),
    );
    return csvResponse("rm-performance", csv);
  });
}
