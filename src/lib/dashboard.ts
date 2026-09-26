import { LEAD_SOURCE_LABELS, LEAD_STATUS_LABELS, KYC_STATUS_LABELS } from "@/lib/labels";
import { LEAD_SOURCES, LEAD_STATUSES } from "@/lib/leads";
import { KYC_STATUSES } from "@/lib/kyc";
import { prisma } from "@/lib/prisma";
import { ownedScope } from "@/lib/rbac";
import type { CurrentUser } from "@/lib/session";

/** All dashboard numbers, scoped to the user's own records for RMs. */
export async function getDashboard(user: CurrentUser) {
  const scope = ownedScope(user);

  const [totalLeads, totalClients, bySource, byStatus, byRm, byKyc, recentLeads, rms] = await Promise.all([
    prisma.lead.count({ where: scope }),
    prisma.client.count({ where: scope }),
    prisma.lead.groupBy({ by: ["source"], where: scope, _count: { _all: true } }),
    prisma.lead.groupBy({ by: ["status"], where: scope, _count: { _all: true } }),
    prisma.lead.groupBy({ by: ["assignedRmId"], where: scope, _count: { _all: true } }),
    prisma.client.groupBy({ by: ["kycStatus"], where: scope, _count: { _all: true } }),
    prisma.lead.findMany({
      where: { ...scope, status: { not: "CONVERTED" } },
      orderBy: { createdAt: "desc" },
      take: 6,
      include: { assignedRm: { select: { name: true } } },
    }),
    prisma.user.findMany({ where: { role: "RM" }, select: { id: true, name: true } }),
  ]);

  const count = <K extends string>(rows: ({ _count: { _all: number } } & Record<string, unknown>)[], key: string, value: K) =>
    rows.find((r) => r[key] === value)?._count._all ?? 0;

  const leadsBySource = LEAD_SOURCES.map((s) => ({ label: LEAD_SOURCE_LABELS[s], value: count(bySource, "source", s) }));
  const leadsByStatus = LEAD_STATUSES.map((s) => ({ status: s, label: LEAD_STATUS_LABELS[s], value: count(byStatus, "status", s) }));
  const kyc = KYC_STATUSES.map((s) => ({ status: s, label: KYC_STATUS_LABELS[s], value: count(byKyc, "kycStatus", s) }));

  const rmName = Object.fromEntries(rms.map((r) => [r.id, r.name]));
  const leadsByRm = byRm
    .map((r) => ({ label: r.assignedRmId ? (rmName[r.assignedRmId] ?? "Former user") : "Unassigned", value: r._count._all }))
    .sort((a, b) => b.value - a.value);

  const kycPending = kyc.filter((k) => k.status === "PENDING" || k.status === "SUBMITTED" || k.status === "UNDER_REVIEW").reduce((a, k) => a + k.value, 0);
  const converted = leadsByStatus.find((s) => s.status === "CONVERTED")!.value;
  const openLeads = leadsByStatus.filter((s) => s.status !== "CONVERTED" && s.status !== "LOST").reduce((a, s) => a + s.value, 0);

  return {
    totalLeads,
    totalClients,
    openLeads,
    kycPending,
    kycAwaitingReview: kyc.filter((k) => k.status === "SUBMITTED" || k.status === "UNDER_REVIEW").reduce((a, k) => a + k.value, 0),
    conversionRate: totalLeads ? converted / totalLeads : 0,
    leadsBySource,
    leadsByStatus,
    leadsByRm,
    kyc,
    recentLeads,
  };
}
