"use client";

import { Search, X } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Button, Input, Select } from "@/components/ui";

export type FilterDef =
  | { type: "select"; key: string; label: string; allLabel?: string; options: { value: string; label: string }[] }
  | { type: "dateRange"; label?: string };

/** URL-driven filter bar: every change updates the query string, the server page re-renders. */
export function FilterBar({ filters, searchPlaceholder = "Search…" }: { filters: FilterDef[]; searchPlaceholder?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [q, setQ] = useState(params.get("q") ?? "");

  function update(changes: Record<string, string | null>) {
    const next = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(changes)) {
      if (v) next.set(k, v);
      else next.delete(k);
    }
    next.delete("page");
    router.replace(`${pathname}?${next.toString()}`);
  }

  // Debounced search box.
  useEffect(() => {
    if ((params.get("q") ?? "") === q) return;
    const t = setTimeout(() => update({ q: q || null }), 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  const active = [...params.keys()].some((k) => k !== "page");

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative w-64">
        <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={searchPlaceholder} className="pl-8" />
      </div>
      {filters.map((f) =>
        f.type === "select" ? (
          <Select
            key={f.key}
            aria-label={f.label}
            className="!w-auto min-w-[9rem]"
            options={f.options}
            placeholder={f.allLabel ?? `All ${f.label.toLowerCase()}`}
            value={params.get(f.key) ?? ""}
            onChange={(e) => update({ [f.key]: e.target.value || null })}
          />
        ) : (
          <div key="dateRange" className="flex items-center gap-1.5 text-xs text-gray-500">
            <span>{f.label ?? "Created"}</span>
            <Input type="date" aria-label="From date" className="!w-[9.5rem]" value={params.get("from") ?? ""} onChange={(e) => update({ from: e.target.value || null })} />
            <span>–</span>
            <Input type="date" aria-label="To date" className="!w-[9.5rem]" value={params.get("to") ?? ""} onChange={(e) => update({ to: e.target.value || null })} />
          </div>
        ),
      )}
      {active && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            setQ("");
            router.replace(pathname);
          }}
        >
          <X size={14} /> Clear
        </Button>
      )}
    </div>
  );
}
