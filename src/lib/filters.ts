import { endOfZonedDay, parseZonedDate } from "@/lib/tz";

/** Helpers for parsing list filters from URL search params (shared by pages and API routes). */

export type SearchParams = Record<string, string | string[] | undefined>;

export function param(sp: SearchParams | URLSearchParams, key: string): string | undefined {
  const v = sp instanceof URLSearchParams ? sp.get(key) : sp[key];
  const s = Array.isArray(v) ? v[0] : v;
  return s && s.trim() ? s.trim() : undefined;
}

export function enumParam<T extends string>(sp: SearchParams | URLSearchParams, key: string, values: readonly T[]): T | undefined {
  const v = param(sp, key);
  return v && (values as readonly string[]).includes(v) ? (v as T) : undefined;
}

/** Inclusive date range from `from` / `to` (YYYY-MM-DD, app timezone) params. */
export function dateRange(sp: SearchParams | URLSearchParams, fromKey = "from", toKey = "to") {
  const from = parseZonedDate(param(sp, fromKey) ?? "");
  const to = parseZonedDate(param(sp, toKey) ?? "");
  const range: { gte?: Date; lte?: Date } = {};
  if (from) range.gte = from;
  if (to) range.lte = endOfZonedDay(to);
  return Object.keys(range).length ? range : undefined;
}

export const PAGE_SIZE = 25;

export function pageParam(sp: SearchParams | URLSearchParams) {
  const n = Number(param(sp, "page") ?? 1);
  return Number.isFinite(n) && n >= 1 ? Math.floor(n) : 1;
}
