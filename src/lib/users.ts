import { prisma } from "@/lib/prisma";

export const userSelect = {
  id: true,
  name: true,
  email: true,
  role: true,
  active: true,
  lastLoginAt: true,
  createdAt: true,
} as const;

/** Active RMs, for assignment dropdowns and filters. */
export function listRms() {
  return prisma.user.findMany({
    where: { role: "RM", active: true },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
}
