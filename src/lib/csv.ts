type Cell = string | number | boolean | Date | null | undefined;

/**
 * Quotes a CSV cell. Values starting with = + - @ (or tab/CR) are prefixed
 * with ' so spreadsheet apps don't evaluate them as formulas (CSV injection).
 */
function cell(v: Cell) {
  if (v === null || v === undefined) return "";
  let s = v instanceof Date ? v.toISOString() : String(v);
  if (typeof v === "string" && /^[=+\-@\t\r]/.test(s)) s = "'" + s;
  return /[",\r\n]/.test(s) || s !== s.trim() ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(headers: string[], rows: Cell[][]) {
  return [headers, ...rows].map((r) => r.map(cell).join(",")).join("\r\n") + "\r\n";
}

export function csvResponse(filename: string, csv: string) {
  const stamp = new Date().toISOString().slice(0, 10);
  // BOM so Excel opens UTF-8 (₹, names) correctly.
  return new Response("﻿" + csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}-${stamp}.csv"`,
      "Cache-Control": "private, no-store",
    },
  });
}

/** Local YYYY-MM-DD for date-only columns. */
export const csvDate = (d: Date | null | undefined) => (d ? d.toISOString().slice(0, 10) : "");
