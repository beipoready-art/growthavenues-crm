import { KYC_STATUSES } from "@/lib/kyc";
import { KYC_STATUS_LABELS, LEAD_SOURCE_LABELS, LEAD_STATUS_LABELS, SERVICE_SHORT_LABELS } from "@/lib/labels";
import { LEAD_SOURCES, LEAD_STATUSES, SERVICE_LINES } from "@/lib/leads";
import { BOARD_COLUMNS, CLOSED_STAGES, mandateInclude, mandateScope, WON_STAGES } from "@/lib/mandates";
import { prisma } from "@/lib/prisma";
import { ownedScope } from "@/lib/rbac";
import type { CurrentUser } from "@/lib/session";
import { zonedMidnight, zonedParts } from "@/lib/tz";

/** Start of the Indian financial year (1 April) containing `now`. */
export function financialYearStart(now = new Date()) {
  const p = zonedParts(now);
  return zonedMidnight(p.month >= 4 ? p.year : p.year - 1, 4, 1);
}

/** All dashboard numbers, scoped to the user's own records for RMs. */
export async function getDashboard(user: CurrentUser) {
  const scope = ownedScope(user);
  const mScope = mandateScope(user);
  const fyStart = financialYearStart();

  const [totalLeads, totalClients, bySource, byService, byStatus, byRm, byKyc, recentLeads, rms, activeMandates, wonThisFy] = await Promise.all([
    prisma.lead.count({ where: scope }),
    prisma.client.count({ where: scope }),
    prisma.lead.groupBy({ by: ["source"], where: scope, _count: { _all: true } }),
    prisma.lead.groupBy({ by: ["serviceInterest"], where: scope, _count: { _all: true } }),
    prisma.lead.groupBy({ by: ["status"], where: scope, _count: { _all: true } }),
    prisma.lead.groupBy({ by: ["assignedRmId"], where: scope, _count: { _all: true } }),
    prisma.client.groupBy({ by: ["kycStatus"], where: scope, _count: { _all: true } }),
    prisma.lead.findMany({
      where: { ...scope, status: { notIn: ["CONVERTED", "LOST"] } },
      orderBy: { createdAt: "desc" },
      take: 6,
      include: { assignedRm: { select: { name: true } } },
    }),
    prisma.user.findMany({ where: { role: "RM" }, select: { id: true, name: true } }),
    prisma.mandate.findMany({
      where: { AND: [mScope, { stage: { notIn: [...CLOSED_STAGES, "ON_HOLD"] } }] },
      include: mandateInclude,
      orderBy: { targetDate: "asc" },
    }),
    prisma.mandate.findMany({ where: { AND: [mScope, { stage: { in: WON_STAGES }, closedAt: { gte: fyStart } }] }, select: { expectedFee: true } }),
  ]);

  const count = <K extends string>(rows: ({ _count: { _all: number } } & Record<string, unknown>)[], key: string, value: K) =>
    rows.find((r) => r[key] === value)?._count._all ?? 0;

  const rmName = Object.fromEntries(rms.map((r) => [r.id, r.name]));
  const kyc = KYC_STATUSES.map((s) => ({ status: s, label: KYC_STATUS_LABELS[s], value: count(byKyc, "kycStatus", s) }));
  const leadsByStatus = LEAD_STATUSES.map((s) => ({ status: s, label: LEAD_STATUS_LABELS[s], value: count(byStatus, "status", s) }));
  const converted = leadsByStatus.find((s) => s.status === "CONVERTED")!.value;

  const pipelineFee = activeMandates.reduce((s, m) => s + Number(m.expectedFee ?? 0), 0);
  const stageColumns = BOARD_COLUMNS.filter((c) => c.key !== "won").map((c) => {
    const ms = activeMandates.filter((m) => c.stages.includes(m.stage));
    return { key: c.key, label: c.label, count: ms.length, fee: ms.reduce((s, m) => s + Number(m.expectedFee ?? 0), 0) };
  });

  return {
    totalLeads,
    totalClients,
    openLeads: leadsByStatus.filter((s) => s.status !== "CONVERTED" && s.status !== "LOST").reduce((a, s) => a + s.value, 0),
    conversionRate: totalLeads ? converted / totalLeads : 0,
    activeMandates: activeMandates.length,
    pipelineFee,
    wonThisFy: wonThisFy.length,
    wonFeeThisFy: wonThisFy.reduce((s, m) => s + Number(m.expectedFee ?? 0), 0),
    kycPending: kyc.filter((k) => k.status === "PENDING" || k.status === "SUBMITTED" || k.status === "UNDER_REVIEW").reduce((a, k) => a + k.value, 0),
    kycAwaitingReview: kyc.filter((k) => k.status === "SUBMITTED" || k.status === "UNDER_REVIEW").reduce((a, k) => a + k.value, 0),
    leadsBySource: LEAD_SOURCES.map((s) => ({ label: LEAD_SOURCE_LABELS[s], value: count(bySource, "source", s) })),
    leadsByService: [
      ...SERVICE_LINES.map((s) => ({ label: SERVICE_SHORT_LABELS[s], value: count(byService, "serviceInterest", s) })),
      { label: "Not specified", value: byService.find((r) => r.serviceInterest === null)?._count._all ?? 0 },
    ].filter((r) => r.value > 0),
    leadsByStatus,
    leadsByRm: byRm
      .map((r) => ({ label: r.assignedRmId ? (rmName[r.assignedRmId] ?? "Former user") : "Unassigned", value: r._count._all }))
      .sort((a, b) => b.value - a.value),
    kyc,
    recentLeads,
    stageColumns,
    upcoming: activeMandates.filter((m) => m.targetDate).slice(0, 6),
  };
}
