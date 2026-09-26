import { Download } from "lucide-react";
import { HBarChart, LinesChart, VBarChart } from "@/components/charts";
import { CHART } from "@/lib/chart-tokens";
import { Card, PageBody, PageHeader, Table, Td, Th } from "@/components/layout";
import { RangeFilter } from "@/components/range-filter";
import { resolveRange } from "@/lib/date-range";
import type { SearchParams } from "@/lib/filters";
import { formatINR, formatPct, toLocalDateInput } from "@/lib/format";
import { can } from "@/lib/rbac";
import { leadSourceReport, pipelineByMonth } from "@/lib/reports";
import { requirePageUser } from "@/lib/session";

function rangeQuery(preset: string, from: Date, to: Date) {
  const qs = new URLSearchParams({ range: preset });
  if (preset === "custom") {
    qs.set("from", toLocalDateInput(from));
    qs.set("to", toLocalDateInput(to));
  }
  return qs.toString();
}

export default async function ReportsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const user = await requirePageUser("reports:view");
  const sp = await searchParams;
  const range = resolveRange(sp, new Date(), "quarter");
  const [sources, pipeline] = await Promise.all([leadSourceReport(user, range.from, range.to), pipelineByMonth(user, 6)]);
  const q = rangeQuery(range.preset, range.from, range.to);
  const canPerf = can(user.role, "performance:viewAll") || can(user.role, "performance:viewOwn");
  const scoped = user.role === "RM";
  const best = [...sources].filter((s) => s.leads > 0).sort((a, b) => b.conversionRate - a.conversionRate)[0];

  const exports = [
    { href: "/api/reports/clients", title: "Client list with KYC status", desc: "All clients, PAN, type, KYC status and last KYC change." },
    { href: "/api/reports/ipo-summary", title: "IPO subscription summary", desc: "Per IPO: clients applied, lots, total amount, status breakdown." },
    ...(canPerf ? [{ href: `/api/reports/rm-performance?${q}`, title: "RM performance", desc: `Per-RM metrics · ${range.label}.` }] : []),
    { href: `/api/reports/lead-sources?${q}`, title: "Lead source effectiveness", desc: `Conversion by source · ${range.label}.` },
  ];

  return (
    <>
      <PageHeader title="Reports" description={scoped ? "Reports on your own leads and clients" : "Firm-wide reports and exports"} />
      <PageBody className="space-y-5">
        <Card title="CSV exports">
          <ul className="grid gap-px bg-gray-100 sm:grid-cols-2">
            {exports.map((e) => (
              <li key={e.title} className="bg-white">
                <a href={e.href} className="flex items-start gap-3 px-5 py-4 hover:bg-gray-50" data-testid="export-link">
                  <Download size={16} className="mt-0.5 text-brand-600" />
                  <div>
                    <p className="text-sm font-medium text-gray-900">{e.title}</p>
                    <p className="text-xs text-gray-500">{e.desc}</p>
                  </div>
                </a>
              </li>
            ))}
          </ul>
        </Card>

        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-900">Lead source effectiveness</h2>
          <RangeFilter preset={range.preset} from={toLocalDateInput(range.from)} to={toLocalDateInput(range.to)} />
        </div>
        <div className="grid gap-5 lg:grid-cols-5">
          <Card className="lg:col-span-3" title={`Leads created · ${range.label}`}>
            <Table>
              <thead>
                <tr>
                  <Th>Source</Th>
                  <Th className="text-right">Leads</Th>
                  <Th className="text-right">Converted</Th>
                  <Th className="text-right">Lost</Th>
                  <Th className="text-right">Open</Th>
                  <Th className="text-right">Conversion</Th>
                  <Th className="text-right">Avg. days</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100" data-testid="source-table">
                {sources.map((s) => (
                  <tr key={s.source}>
                    <Td className="font-medium text-gray-900">{s.label}</Td>
                    <Td className="text-right tabular-nums">{s.leads}</Td>
                    <Td className="text-right tabular-nums">{s.converted}</Td>
                    <Td className="text-right tabular-nums">{s.lost}</Td>
                    <Td className="text-right tabular-nums">{s.open}</Td>
                    <Td className="text-right tabular-nums">{s.leads ? formatPct(s.conversionRate) : "—"}</Td>
                    <Td className="text-right tabular-nums">{s.avgDaysToConvert != null ? s.avgDaysToConvert.toFixed(1) : "—"}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
            {best && (
              <p className="border-t border-gray-100 px-5 py-2.5 text-xs text-gray-600">
                Best converting source: <span className="font-medium text-gray-900">{best.label}</span> ({formatPct(best.conversionRate)} of {best.leads} leads).
              </p>
            )}
          </Card>
          <Card className="lg:col-span-2" title="Conversion rate by source">
            <div className="px-4 py-3">
              <HBarChart
                data={sources.map((s) => ({ label: s.label, value: Math.round(s.conversionRate * 1000) / 10 }))}
                valueFormat="percent"
                ariaLabel="Conversion rate by lead source"
              />
            </div>
          </Card>
        </div>

        <h2 className="pt-2 text-sm font-semibold text-gray-900">Pipeline over time · last 6 months</h2>
        <div className="grid gap-5 lg:grid-cols-2">
          <Card title="Pipeline value (IPO application value by month)">
            <div className="px-4 py-3">
              <VBarChart
                data={pipeline}
                dataKey="applicationValue"
                label="Application value"
                valueFormat="inr"
                ariaLabel="IPO application value by month"
              />
            </div>
          </Card>
          <Card title="Lead pipeline (new leads vs conversions)">
            <div className="px-4 py-3">
              <LinesChart
                data={pipeline}
                series={[
                  { key: "newLeads", label: "New leads", color: CHART.series[0] },
                  { key: "conversions", label: "Conversions", color: CHART.series[1] },
                ]}
                ariaLabel="New leads and conversions by month"
              />
            </div>
          </Card>
        </div>
        <Card title="Monthly figures">
          <Table>
            <thead>
              <tr>
                <Th>Month</Th>
                <Th className="text-right">New leads</Th>
                <Th className="text-right">Conversions</Th>
                <Th className="text-right">IPO applications</Th>
                <Th className="text-right">Application value</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100" data-testid="pipeline-table">
              {pipeline.map((m) => (
                <tr key={m.month}>
                  <Td>{m.label}</Td>
                  <Td className="text-right tabular-nums">{m.newLeads}</Td>
                  <Td className="text-right tabular-nums">{m.conversions}</Td>
                  <Td className="text-right tabular-nums">{m.applications}</Td>
                  <Td className="text-right tabular-nums">{formatINR(m.applicationValue)}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Card>
      </PageBody>
    </>
  );
}
