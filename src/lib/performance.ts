import { prisma } from "@/lib/prisma";

export type RmPerformance = {
  rmId: string;
  name: string;
  active: boolean;
  leadsAssigned: number; // leads created in the period, currently assigned to the RM
  leadsConverted: number; // conversions that happened in the period
  cohortConverted: number; // of leadsAssigned, how many are converted (any time)
  conversionRate: number; // cohortConverted / leadsAssigned
  clientsUnderManagement: number; // current book size
  ipoApplications: number; // applications dated in the period for the RM's clients
  applicationValue: number; // ₹ total of those applications
};

/** Per-RM metrics for [from, to]. Pass rmIds to restrict (e.g. an RM viewing themselves). */
export async function getRmPerformance(from: Date, to: Date, rmIds?: string[]): Promise<RmPerformance[]> {
  const rms = await prisma.user.findMany({
    where: { role: "RM", ...(rmIds ? { id: { in: rmIds } } : {}) },
    select: { id: true, name: true, active: true },
    orderBy: { name: "asc" },
  });
  const ids = rms.map((r) => r.id);
  const inRange = { gte: from, lte: to };

  const [assigned, cohort, converted, clients, apps] = await Promise.all([
    prisma.lead.groupBy({ by: ["assignedRmId"], where: { assignedRmId: { in: ids }, createdAt: inRange }, _count: { _all: true } }),
    prisma.lead.groupBy({ by: ["assignedRmId"], where: { assignedRmId: { in: ids }, createdAt: inRange, status: "CONVERTED" }, _count: { _all: true } }),
    prisma.lead.groupBy({ by: ["assignedRmId"], where: { assignedRmId: { in: ids }, convertedAt: inRange }, _count: { _all: true } }),
    prisma.client.groupBy({ by: ["assignedRmId"], where: { assignedRmId: { in: ids } }, _count: { _all: true } }),
    prisma.ipoApplication.findMany({
      where: { applicationDate: inRange, client: { assignedRmId: { in: ids } } },
      select: { amount: true, client: { select: { assignedRmId: true } } },
    }),
  ]);
  const count = (rows: { assignedRmId: string | null; _count: { _all: number } }[], id: string) => rows.find((r) => r.assignedRmId === id)?._count._all ?? 0;

  return rms.map((rm) => {
    const mine = apps.filter((a) => a.client.assignedRmId === rm.id);
    const leadsAssigned = count(assigned, rm.id);
    const cohortConverted = count(cohort, rm.id);
    return {
      rmId: rm.id,
      name: rm.name,
      active: rm.active,
      leadsAssigned,
      leadsConverted: count(converted, rm.id),
      cohortConverted,
      conversionRate: leadsAssigned ? cohortConverted / leadsAssigned : 0,
      clientsUnderManagement: count(clients, rm.id),
      ipoApplications: mine.length,
      applicationValue: mine.reduce((s, a) => s + Number(a.amount), 0),
    };
  });
}

/** Leaderboard: rank by conversions in the period, ties broken by application value. */
export function rankRms(rows: RmPerformance[]) {
  return [...rows]
    .filter((r) => r.active || r.leadsConverted > 0)
    .sort((a, b) => b.leadsConverted - a.leadsConverted || b.applicationValue - a.applicationValue || a.name.localeCompare(b.name))
    .map((r, i) => ({ ...r, rank: i + 1 }));
}
