"use client";

import { Bar, BarChart, CartesianGrid, LabelList, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { CHART } from "@/lib/chart-tokens";

export { CHART };

/** Named formats (functions can't be passed from server to client components). */
export type ValueFormat = "number" | "inr" | "percent";
const FORMATS: Record<ValueFormat, (n: number) => string> = {
  number: (n) => n.toLocaleString("en-IN"),
  inr: (n) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n),
  percent: (n) => `${n}%`,
};
/** Axis ticks in one unit (lakh or crore) so labels read consistently. */
const trim = (x: number) => String(Number(x.toFixed(2)));
const compactInr = (n: number) => (n >= 1e7 ? `₹${trim(n / 1e7)}Cr` : n >= 1e3 ? `₹${trim(n / 1e5)}L` : `₹${n}`);

type Datum = { label: string; value: number };

function ChartTooltip({ active, payload, format }: { active?: boolean; payload?: { payload: Datum }[]; format: (n: number) => string }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="rounded-md border border-gray-200 bg-white px-2.5 py-1.5 text-xs shadow-sm">
      <p className="text-gray-500">{d.label}</p>
      <p className="font-semibold text-gray-900">{format(d.value)}</p>
    </div>
  );
}

/** Single-series horizontal bar chart: one hue, value labels at the bar end, hover tooltip. */
export function HBarChart({
  data,
  color = CHART.series[0],
  valueFormat = "number",
  ariaLabel,
}: {
  data: Datum[];
  color?: string;
  valueFormat?: ValueFormat;
  ariaLabel: string;
}) {
  const format = FORMATS[valueFormat];
  const height = Math.max(120, data.length * 36 + 24);
  return (
    <div role="img" aria-label={ariaLabel} style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 4, right: 48, bottom: 4, left: 8 }} barCategoryGap={10}>
          <CartesianGrid horizontal={false} stroke={CHART.grid} />
          <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11, fill: CHART.axis }} axisLine={false} tickLine={false} />
          <YAxis type="category" dataKey="label" width={130} tick={{ fontSize: 12, fill: CHART.text }} axisLine={false} tickLine={false} />
          <Tooltip cursor={{ fill: "rgba(0,0,0,0.04)" }} content={<ChartTooltip format={format} />} />
          <Bar dataKey="value" fill={color} radius={[0, 4, 4, 0]} maxBarSize={22} isAnimationActive={false}>
            <LabelList dataKey="value" position="right" formatter={(v) => format(Number(v))} style={{ fontSize: 12, fill: CHART.axis }} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

type SeriesDef = { key: string; label: string; color: string };

function MultiTooltip({ active, payload, label, series, format }: { active?: boolean; payload?: { dataKey: string; value: number }[]; label?: string; series: SeriesDef[]; format: (n: number) => string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-md border border-gray-200 bg-white px-2.5 py-1.5 text-xs shadow-sm">
      <p className="mb-1 text-gray-500">{label}</p>
      {series.map((s) => {
        const p = payload.find((x) => x.dataKey === s.key);
        return (
          <p key={s.key} className="flex items-center gap-1.5">
            <span className="inline-block h-2 w-2 rounded-full" style={{ background: s.color }} />
            <span className="text-gray-600">{s.label}</span>
            <span className="ml-auto pl-3 font-semibold text-gray-900">{format(p?.value ?? 0)}</span>
          </p>
        );
      })}
    </div>
  );
}

/** Single-series vertical bars over time (one hue, rounded tops, tooltip). */
export function VBarChart({
  data,
  dataKey,
  label,
  color = CHART.series[0],
  valueFormat = "number",
  ariaLabel,
}: {
  data: Record<string, string | number>[];
  dataKey: string;
  label: string;
  color?: string;
  valueFormat?: ValueFormat;
  ariaLabel: string;
}) {
  const format = FORMATS[valueFormat];
  const tickFormat = valueFormat === "inr" ? (n: number) => (n === 0 ? "0" : compactInr(n)) : format;
  return (
    <div role="img" aria-label={ariaLabel} style={{ height: 240 }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 16, right: 8, bottom: 0, left: 8 }}>
          <CartesianGrid vertical={false} stroke={CHART.grid} />
          <XAxis dataKey="label" tick={{ fontSize: 12, fill: CHART.axis }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fontSize: 11, fill: CHART.axis }} axisLine={false} tickLine={false} tickFormatter={tickFormat} width={64} />
          <Tooltip cursor={{ fill: "rgba(0,0,0,0.04)" }} content={<MultiTooltip series={[{ key: dataKey, label, color }]} format={format} />} />
          <Bar dataKey={dataKey} fill={color} radius={[4, 4, 0, 0]} maxBarSize={36} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Multi-series line chart (≤ 4 series) with legend, 2px lines and a crosshair tooltip. */
export function LinesChart({ data, series, ariaLabel }: { data: Record<string, string | number>[]; series: SeriesDef[]; ariaLabel: string }) {
  const format = FORMATS.number;
  return (
    <div>
      <ul className="mb-2 flex flex-wrap gap-4 text-xs text-gray-600" aria-label="Legend">
        {series.map((s) => (
          <li key={s.key} className="flex items-center gap-1.5">
            <span className="inline-block h-0.5 w-4 rounded" style={{ background: s.color }} />
            {s.label}
          </li>
        ))}
      </ul>
      <div role="img" aria-label={ariaLabel} style={{ height: 220 }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
            <CartesianGrid vertical={false} stroke={CHART.grid} />
            <XAxis dataKey="label" tick={{ fontSize: 12, fill: CHART.axis }} axisLine={false} tickLine={false} />
            <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: CHART.axis }} axisLine={false} tickLine={false} width={32} />
            <Tooltip cursor={{ stroke: CHART.axis, strokeDasharray: "3 3" }} content={<MultiTooltip series={series} format={format} />} />
            {series.map((s) => (
              <Line key={s.key} type="linear" dataKey={s.key} stroke={s.color} strokeWidth={2} dot={{ r: 4, strokeWidth: 2, fill: "#fff" }} activeDot={{ r: 5 }} isAnimationActive={false} />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
