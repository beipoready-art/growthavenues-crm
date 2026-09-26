import { CLOSED_STAGES, WON_STAGES } from "@/lib/mandates";
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
  mandatesSigned: number; // mandates they lead that were signed in the period
  mandatesWon: number; // mandates they lead that listed / completed in the period
  feesWon: number; // ₹ expected fee of mandates won in the period
  pipelineFee: number; // ₹ expected fee of their currently active mandates
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

  const [assigned, cohort, converted, clients, mandates] = await Promise.all([
    prisma.lead.groupBy({ by: ["assignedRmId"], where: { assignedRmId: { in: ids }, createdAt: inRange }, _count: { _all: true } }),
    prisma.lead.groupBy({ by: ["assignedRmId"], where: { assignedRmId: { in: ids }, createdAt: inRange, status: "CONVERTED" }, _count: { _all: true } }),
    prisma.lead.groupBy({ by: ["assignedRmId"], where: { assignedRmId: { in: ids }, convertedAt: inRange }, _count: { _all: true } }),
    prisma.client.groupBy({ by: ["assignedRmId"], where: { assignedRmId: { in: ids } }, _count: { _all: true } }),
    prisma.mandate.findMany({
      where: { leadAdvisorId: { in: ids } },
      select: { leadAdvisorId: true, stage: true, signedAt: true, closedAt: true, expectedFee: true },
    }),
  ]);
  const count = (rows: { assignedRmId: string | null; _count: { _all: number } }[], id: string) => rows.find((r) => r.assignedRmId === id)?._count._all ?? 0;
  const within = (d: Date | null) => !!d && d >= from && d <= to;

  return rms.map((rm) => {
    const mine = mandates.filter((m) => m.leadAdvisorId === rm.id);
    const won = mine.filter((m) => WON_STAGES.includes(m.stage) && within(m.closedAt));
    const active = mine.filter((m) => !CLOSED_STAGES.includes(m.stage) && m.stage !== "ON_HOLD");
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
      mandatesSigned: mine.filter((m) => within(m.signedAt)).length,
      mandatesWon: won.length,
      feesWon: won.reduce((s, m) => s + Number(m.expectedFee ?? 0), 0),
      pipelineFee: active.reduce((s, m) => s + Number(m.expectedFee ?? 0), 0),
    };
  });
}

/** Leaderboard: rank by conversions in the period, ties broken by application value. */
export function rankRms(rows: RmPerformance[]) {
  return [...rows]
    .filter((r) => r.active || r.leadsConverted > 0)
    .sort((a, b) => b.leadsConverted - a.leadsConverted || b.mandatesSigned - a.mandatesSigned || b.feesWon - a.feesWon || a.name.localeCompare(b.name))
    .map((r, i) => ({ ...r, rank: i + 1 }));
}
