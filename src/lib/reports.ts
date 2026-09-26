import { Prisma } from "@prisma/client";
import { LEAD_SOURCE_LABELS } from "@/lib/labels";
import { LEAD_SOURCES } from "@/lib/leads";
import { prisma } from "@/lib/prisma";
import { ownedScope } from "@/lib/rbac";
import type { CurrentUser } from "@/lib/session";

/** Lead source effectiveness for leads created in [from, to]. */
export async function leadSourceReport(user: CurrentUser, from: Date, to: Date) {
  const leads = await prisma.lead.findMany({
    where: { ...ownedScope(user), createdAt: { gte: from, lte: to } },
    select: { source: true, status: true, createdAt: true, convertedAt: true },
  });
  return LEAD_SOURCES.map((source) => {
    const mine = leads.filter((l) => l.source === source);
    const converted = mine.filter((l) => l.status === "CONVERTED" && l.convertedAt);
    const lost = mine.filter((l) => l.status === "LOST").length;
    const avgDays = converted.length
      ? converted.reduce((s, l) => s + (l.convertedAt!.getTime() - l.createdAt.getTime()) / 86_400_000, 0) / converted.length
      : null;
    return {
      source,
      label: LEAD_SOURCE_LABELS[source],
      leads: mine.length,
      converted: converted.length,
      lost,
      open: mine.length - converted.length - lost,
      conversionRate: mine.length ? converted.length / mine.length : 0,
      avgDaysToConvert: avgDays,
    };
  });
}

/** Month keys for the trailing `months` months, oldest first, e.g. "2026-04". */
export function trailingMonths(months: number, now = new Date()) {
  return Array.from({ length: months }, (_, i) => {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (months - 1 - i), 1));
    return d.toISOString().slice(0, 7);
  });
}

const monthLabel = (key: string) => new Intl.DateTimeFormat("en-IN", { month: "short", year: "2-digit", timeZone: "UTC" }).format(new Date(key + "-01T00:00:00Z"));

/** Monthly pipeline: IPO application value, new leads and conversions (RM-scoped). */
export async function pipelineByMonth(user: CurrentUser, months = 6) {
  const keys = trailingMonths(months);
  const since = new Date(keys[0] + "-01T00:00:00Z");
  const rmFilter = user.role === "RM" ? Prisma.sql`AND c."assignedRmId" = ${user.id}` : Prisma.empty;
  const leadRm = user.role === "RM" ? Prisma.sql`AND "assignedRmId" = ${user.id}` : Prisma.empty;

  const [value, created, converted] = await Promise.all([
    prisma.$queryRaw<{ month: string; total: Prisma.Decimal; n: bigint }[]>`
      SELECT to_char(date_trunc('month', a."applicationDate"), 'YYYY-MM') AS month, SUM(a.amount) AS total, COUNT(*) AS n
      FROM "IpoApplication" a JOIN "Client" c ON c.id = a."clientId"
      WHERE a."applicationDate" >= ${since} ${rmFilter}
      GROUP BY 1`,
    prisma.$queryRaw<{ month: string; n: bigint }[]>`
      SELECT to_char(date_trunc('month', "createdAt"), 'YYYY-MM') AS month, COUNT(*) AS n
      FROM "Lead" WHERE "createdAt" >= ${since} ${leadRm} GROUP BY 1`,
    prisma.$queryRaw<{ month: string; n: bigint }[]>`
      SELECT to_char(date_trunc('month', "convertedAt"), 'YYYY-MM') AS month, COUNT(*) AS n
      FROM "Lead" WHERE "convertedAt" >= ${since} ${leadRm} GROUP BY 1`,
  ]);
  const get = <T extends { month: string }>(rows: T[], k: string) => rows.find((r) => r.month === k);
  return keys.map((k) => ({
    month: k,
    label: monthLabel(k),
    applicationValue: Number(get(value, k)?.total ?? 0),
    applications: Number(get(value, k)?.n ?? 0),
    newLeads: Number(get(created, k)?.n ?? 0),
    conversions: Number(get(converted, k)?.n ?? 0),
  }));
}
