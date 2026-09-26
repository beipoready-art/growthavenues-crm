"use client";

import clsx from "clsx";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Input } from "@/components/ui";
import type { RangePreset } from "@/lib/date-range";

const PRESETS: { value: RangePreset; label: string }[] = [
  { value: "week", label: "This week" },
  { value: "month", label: "This month" },
  { value: "quarter", label: "This quarter" },
  { value: "custom", label: "Custom" },
];

/** Segmented date-range control synced to ?range=&from=&to=. */
export function RangeFilter({ preset, from, to }: { preset: RangePreset; from: string; to: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  function update(changes: Record<string, string | null>) {
    const next = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(changes)) {
      if (v) next.set(k, v);
      else next.delete(k);
    }
    router.replace(`${pathname}?${next.toString()}`);
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="inline-flex rounded-md border border-gray-200 bg-white p-0.5 shadow-sm" role="group" aria-label="Date range">
        {PRESETS.map((p) => (
          <button
            key={p.value}
            aria-pressed={preset === p.value}
            onClick={() => update(p.value === "custom" ? { range: "custom", from, to } : { range: p.value, from: null, to: null })}
            className={clsx("rounded px-3 py-1 text-sm transition-colors", preset === p.value ? "bg-gray-900 text-white" : "text-gray-600 hover:bg-gray-50")}
          >
            {p.label}
          </button>
        ))}
      </div>
      {preset === "custom" && (
        <div className="flex items-center gap-1.5 text-xs text-gray-500">
          <Input type="date" aria-label="From date" className="!w-[9.5rem]" value={from} max={to} onChange={(e) => update({ range: "custom", from: e.target.value })} />
          <span>–</span>
          <Input type="date" aria-label="To date" className="!w-[9.5rem]" value={to} min={from} onChange={(e) => update({ range: "custom", to: e.target.value })} />
        </div>
      )}
    </div>
  );
}
