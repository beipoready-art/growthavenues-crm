/**
 * The firm operates on Indian Standard Time. Servers usually run in UTC, so
 * every "day" boundary (today, this month, date filters) and every rendered
 * timestamp is computed in APP_TIMEZONE explicitly. The same zone is used
 * on the server and in the browser, which also keeps hydration consistent.
 */
export const APP_TIMEZONE = process.env.NEXT_PUBLIC_APP_TIMEZONE || "Asia/Kolkata";

const partsFmt = new Intl.DateTimeFormat("en-CA", {
  timeZone: APP_TIMEZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

export function zonedParts(d: Date) {
  const p = Object.fromEntries(partsFmt.formatToParts(d).map((x) => [x.type, x.value]));
  return { year: +p.year, month: +p.month, day: +p.day, hour: +p.hour, minute: +p.minute, second: +p.second };
}

/** Offset (ms) of APP_TIMEZONE from UTC at instant `d`. */
function offsetMs(d: Date) {
  const p = zonedParts(d);
  return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) - Math.floor(d.getTime() / 1000) * 1000;
}

/** The UTC instant of 00:00 on the given calendar date in APP_TIMEZONE (month is 1-based; overflow allowed). */
export function zonedMidnight(year: number, month: number, day: number) {
  const guess = new Date(Date.UTC(year, month - 1, day));
  return new Date(guess.getTime() - offsetMs(guess));
}

export function startOfZonedDay(d: Date) {
  const p = zonedParts(d);
  return zonedMidnight(p.year, p.month, p.day);
}

export function endOfZonedDay(d: Date) {
  const p = zonedParts(d);
  return new Date(zonedMidnight(p.year, p.month, p.day + 1).getTime() - 1);
}

/** YYYY-MM-DD of `d` in APP_TIMEZONE. */
export function zonedDateString(d: Date) {
  const p = zonedParts(d);
  return `${p.year}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`;
}

/** Parses "YYYY-MM-DD" as a calendar date in APP_TIMEZONE (start of that day). */
export function parseZonedDate(s: string) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  return m ? zonedMidnight(+m[1], +m[2], +m[3]) : null;
}
