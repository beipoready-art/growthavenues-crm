import { param, type SearchParams } from "@/lib/filters";

export const RANGE_PRESETS = ["week", "month", "quarter", "custom"] as const;
export type RangePreset = (typeof RANGE_PRESETS)[number];

export type ResolvedRange = { preset: RangePreset; from: Date; to: Date; label: string };

const fmt = new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", year: "numeric" });

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}
function endOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

/**
 * Resolves ?range=week|month|quarter|custom (&from=&to= for custom) into a
 * concrete [from, to] window. Weeks start on Monday; quarters are calendar
 * quarters (Jan–Mar, …). Defaults to this month.
 */
export function resolveRange(sp: SearchParams | URLSearchParams, now = new Date(), fallback: RangePreset = "month"): ResolvedRange {
  const preset = (RANGE_PRESETS as readonly string[]).includes(param(sp, "range") ?? "") ? (param(sp, "range") as RangePreset) : fallback;
  if (preset === "custom") {
    const f = param(sp, "from");
    const t = param(sp, "to");
    const from = f && !isNaN(Date.parse(f)) ? startOfDay(new Date(f + "T00:00:00")) : startOfDay(new Date(now.getFullYear(), now.getMonth(), 1));
    const to = t && !isNaN(Date.parse(t)) ? endOfDay(new Date(t + "T00:00:00")) : endOfDay(now);
    return { preset, from, to, label: `${fmt.format(from)} – ${fmt.format(to)}` };
  }
  if (preset === "week") {
    const from = startOfDay(now);
    from.setDate(from.getDate() - ((from.getDay() + 6) % 7));
    return { preset, from, to: endOfDay(now), label: "This week" };
  }
  if (preset === "quarter") {
    const q = Math.floor(now.getMonth() / 3);
    return { preset, from: new Date(now.getFullYear(), q * 3, 1), to: endOfDay(now), label: `This quarter (Q${q + 1} ${now.getFullYear()})` };
  }
  return { preset: "month", from: new Date(now.getFullYear(), now.getMonth(), 1), to: endOfDay(now), label: "This month" };
}
