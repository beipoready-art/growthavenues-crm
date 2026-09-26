import { param, type SearchParams } from "@/lib/filters";
import { endOfZonedDay, parseZonedDate, zonedMidnight, zonedParts } from "@/lib/tz";

export const RANGE_PRESETS = ["week", "month", "quarter", "custom"] as const;
export type RangePreset = (typeof RANGE_PRESETS)[number];

export type ResolvedRange = { preset: RangePreset; from: Date; to: Date; label: string };

const fmt = (d: Date) => new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", year: "numeric", timeZone: process.env.NEXT_PUBLIC_APP_TIMEZONE || "Asia/Kolkata" }).format(d);

/**
 * Resolves ?range=week|month|quarter|custom (&from=&to= for custom) into a
 * concrete [from, to] window in the app timezone. Weeks start on Monday;
 * quarters are calendar quarters. "to" is the end of today for presets.
 */
export function resolveRange(sp: SearchParams | URLSearchParams, now = new Date(), fallback: RangePreset = "month"): ResolvedRange {
  const raw = param(sp, "range") ?? "";
  const preset = (RANGE_PRESETS as readonly string[]).includes(raw) ? (raw as RangePreset) : fallback;
  const today = zonedParts(now);
  const endToday = endOfZonedDay(now);

  if (preset === "custom") {
    const from = parseZonedDate(param(sp, "from") ?? "") ?? zonedMidnight(today.year, today.month, 1);
    const toStart = parseZonedDate(param(sp, "to") ?? "");
    const to = toStart ? endOfZonedDay(toStart) : endToday;
    return { preset, from, to, label: `${fmt(from)} – ${fmt(to)}` };
  }
  if (preset === "week") {
    const weekday = new Date(Date.UTC(today.year, today.month - 1, today.day)).getUTCDay(); // 0 = Sunday
    return { preset, from: zonedMidnight(today.year, today.month, today.day - ((weekday + 6) % 7)), to: endToday, label: "This week" };
  }
  if (preset === "quarter") {
    const q = Math.floor((today.month - 1) / 3);
    return { preset, from: zonedMidnight(today.year, q * 3 + 1, 1), to: endToday, label: `This quarter (Q${q + 1} ${today.year})` };
  }
  return { preset: "month", from: zonedMidnight(today.year, today.month, 1), to: endToday, label: "This month" };
}
