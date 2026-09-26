import { Trophy } from "lucide-react";
import { Card, EmptyState, PageBody, PageHeader, Table, Td, Th } from "@/components/layout";
import { RangeFilter } from "@/components/range-filter";
import { StatTile } from "@/components/stat";
import { Badge } from "@/components/ui";
import { resolveRange } from "@/lib/date-range";
import type { SearchParams } from "@/lib/filters";
import { formatINR, formatPct, toLocalDateInput } from "@/lib/format";
import { getRmPerformance, rankRms, type RmPerformance } from "@/lib/performance";
import { can } from "@/lib/rbac";
import { requirePageUser } from "@/lib/session";

export default async function PerformancePage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const user = await requirePageUser("performance:view");
  const sp = await searchParams;
  const range = resolveRange(sp);
  const all = can(user.role, "performance:viewAll");
  const rows = await getRmPerformance(range.from, range.to, all ? undefined : [user.id]);

  const totals = rows.reduce(
    (t, r) => ({
      leadsAssigned: t.leadsAssigned + r.leadsAssigned,
      leadsConverted: t.leadsConverted + r.leadsConverted,
      cohortConverted: t.cohortConverted + r.cohortConverted,
      clients: t.clients + r.clientsUnderManagement,
      apps: t.apps + r.ipoApplications,
      value: t.value + r.applicationValue,
    }),
    { leadsAssigned: 0, leadsConverted: 0, cohortConverted: 0, clients: 0, apps: 0, value: 0 },
  );
  const me = rows[0] as RmPerformance | undefined;

  return (
    <>
      <PageHeader title={all ? "RM performance" : "My performance"} description={range.label} />
      <PageBody className="space-y-5">
        <RangeFilter preset={range.preset} from={toLocalDateInput(range.from)} to={toLocalDateInput(range.to)} />

        {!all && me && (
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-3" data-testid="my-performance">
            <StatTile label="Leads assigned" value={me.leadsAssigned} hint="New leads in period" />
            <StatTile label="Leads converted" value={me.leadsConverted} hint="Conversions in period" />
            <StatTile label="Conversion rate" value={formatPct(me.conversionRate)} hint={`${me.cohortConverted} of ${me.leadsAssigned} period leads converted`} />
            <StatTile label="Clients under management" value={me.clientsUnderManagement} hint="Current book" />
            <StatTile label="IPO applications logged" value={me.ipoApplications} />
            <StatTile label="Total application value" value={formatINR(me.applicationValue)} />
          </div>
        )}

        {all && (
          <>
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              <StatTile label="Leads assigned" value={totals.leadsAssigned} hint="All RMs, in period" />
              <StatTile label="Leads converted" value={totals.leadsConverted} />
              <StatTile label="IPO applications" value={totals.apps} />
              <StatTile label="Application value" value={formatINR(totals.value)} />
            </div>

            {can(user.role, "performance:leaderboard") && <Leaderboard rows={rows} />}

            <Card title="By relationship manager">
              {rows.length === 0 ? (
                <EmptyState title="No RMs yet" />
              ) : (
                <Table>
                  <thead>
                    <tr>
                      <Th>RM</Th>
                      <Th className="text-right">Leads assigned</Th>
                      <Th className="text-right">Converted</Th>
                      <Th className="text-right">Conversion rate</Th>
                      <Th className="text-right">Clients</Th>
                      <Th className="text-right">IPO apps</Th>
                      <Th className="text-right">Application value</Th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100" data-testid="rm-table">
                    {rows.map((r) => (
                      <tr key={r.rmId}>
                        <Td>
                          <span className="font-medium text-gray-900">{r.name}</span> {!r.active && <Badge>Inactive</Badge>}
                        </Td>
                        <Td className="text-right tabular-nums">{r.leadsAssigned}</Td>
                        <Td className="text-right tabular-nums">{r.leadsConverted}</Td>
                        <Td className="text-right tabular-nums">{r.leadsAssigned ? formatPct(r.conversionRate) : "—"}</Td>
                        <Td className="text-right tabular-nums">{r.clientsUnderManagement}</Td>
                        <Td className="text-right tabular-nums">{r.ipoApplications}</Td>
                        <Td className="text-right tabular-nums">{formatINR(r.applicationValue)}</Td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="border-t border-gray-200 bg-gray-50/60 text-sm font-medium">
                    <tr>
                      <Td>Total</Td>
                      <Td className="text-right tabular-nums">{totals.leadsAssigned}</Td>
                      <Td className="text-right tabular-nums">{totals.leadsConverted}</Td>
                      <Td className="text-right tabular-nums">{totals.leadsAssigned ? formatPct(totals.cohortConverted / totals.leadsAssigned) : "—"}</Td>
                      <Td className="text-right tabular-nums">{totals.clients}</Td>
                      <Td className="text-right tabular-nums">{totals.apps}</Td>
                      <Td className="text-right tabular-nums">{formatINR(totals.value)}</Td>
                    </tr>
                  </tfoot>
                </Table>
              )}
              <p className="border-t border-gray-100 px-5 py-2.5 text-xs text-gray-500">
                Leads assigned = new leads created in the period. Converted = conversions that happened in the period. Conversion rate = share of the
                period&apos;s leads that are now converted. Clients = current book.
              </p>
            </Card>
          </>
        )}
      </PageBody>
    </>
  );
}

function Leaderboard({ rows }: { rows: RmPerformance[] }) {
  const ranked = rankRms(rows);
  const max = Math.max(1, ...ranked.map((r) => r.leadsConverted));
  return (
    <Card title="Leaderboard · conversions" actions={<Trophy size={16} className="text-amber-500" />}>
      {ranked.length === 0 ? (
        <EmptyState title="No RMs to rank" />
      ) : (
        <ol className="divide-y divide-gray-100" data-testid="leaderboard">
          {ranked.map((r) => (
            <li key={r.rmId} className="flex items-center gap-4 px-5 py-3">
              <span
                className={
                  "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold " +
                  (r.rank === 1 ? "bg-amber-100 text-amber-800" : "bg-gray-100 text-gray-600")
                }
              >
                {r.rank}
              </span>
              <div className="w-40 shrink-0">
                <p className="text-sm font-medium text-gray-900">{r.name}</p>
                <p className="text-xs text-gray-500">{formatINR(r.applicationValue)} IPO value</p>
              </div>
              <div className="flex flex-1 items-center gap-2">
                <div className="h-2 flex-1 rounded-full bg-gray-100">
                  <div className="h-2 rounded-full bg-[#2a78d6]" style={{ width: `${(r.leadsConverted / max) * 100}%` }} />
                </div>
                <span className="w-32 whitespace-nowrap text-right text-sm tabular-nums text-gray-900">
                  {r.leadsConverted} conversion{r.leadsConverted === 1 ? "" : "s"}
                </span>
              </div>
            </li>
          ))}
        </ol>
      )}
    </Card>
  );
}
