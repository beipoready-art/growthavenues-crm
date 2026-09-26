import { APP_TIMEZONE, zonedDateString } from "@/lib/tz";

const dateFmt = new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", year: "numeric", timeZone: APP_TIMEZONE });
const dateTimeFmt = new Intl.DateTimeFormat("en-IN", {
  timeZone: APP_TIMEZONE,
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

export const formatDate = (d: Date | string | null | undefined) => (d ? dateFmt.format(new Date(d)) : "—");
export const formatDateTime = (d: Date | string | null | undefined) => (d ? dateTimeFmt.format(new Date(d)) : "—");

export function formatBytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

const inr = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });
const inr2 = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", minimumFractionDigits: 0, maximumFractionDigits: 2 });

/** ₹ amount; whole rupees by default, paise when `precise`. Accepts Prisma Decimals. */
export function formatINR(n: number | string | { toString(): string } | null | undefined, precise = false) {
  if (n === null || n === undefined) return "—";
  const v = Number(n.toString());
  return (precise ? inr2 : inr).format(v);
}

/** Compact ₹ for tiles: ₹12.4L, ₹3.1Cr. */
export function formatINRCompact(n: number) {
  if (n >= 1e7) return `₹${(n / 1e7).toFixed(2)}Cr`;
  if (n >= 1e5) return `₹${(n / 1e5).toFixed(2)}L`;
  return inr.format(n);
}

/** YYYY-MM-DD for <input type="date"> (dates are stored as UTC midnight). */
export const toDateInput = (d: Date | string | null | undefined) => (d ? new Date(d).toISOString().slice(0, 10) : "");

/** YYYY-MM-DD in the app timezone (for date-range inputs). */
export const toLocalDateInput = (d: Date) => zonedDateString(d);

export const formatPct = (n: number) => `${(n * 100).toFixed(n > 0 && n < 0.1 ? 1 : 0)}%`;
