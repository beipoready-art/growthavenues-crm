"use client";

import { Bar, BarChart, CartesianGrid, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

// Chart tokens (reference data-viz palette, light surface).
export const CHART = {
  series: ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4", "#008300", "#4a3aa7", "#e34948"],
  grid: "#ecebe8",
  axis: "#52514e",
  text: "#0b0b0b",
};

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
  format = (n) => n.toLocaleString("en-IN"),
  ariaLabel,
}: {
  data: Datum[];
  color?: string;
  format?: (n: number) => string;
  ariaLabel: string;
}) {
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
