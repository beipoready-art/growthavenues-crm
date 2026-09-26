import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

type Db = Prisma.TransactionClient | typeof prisma;

export function audit(
  db: Db,
  entry: { entityType: string; entityId: string; action: string; userId: string | null; metadata?: Prisma.InputJsonValue },
) {
  return db.auditLog.create({ data: entry });
}

/** Builds a { field: { from, to } } diff of changed fields, for audit metadata. */
export function diff<T extends Record<string, unknown>>(before: T, patch: Partial<T>) {
  const changes: Record<string, { from: unknown; to: unknown }> = {};
  for (const key of Object.keys(patch) as (keyof T)[]) {
    const from = before[key] instanceof Date ? (before[key] as Date).toISOString() : before[key];
    const to = patch[key] instanceof Date ? (patch[key] as Date).toISOString() : patch[key];
    if (to !== undefined && from !== to) changes[key as string] = { from: from ?? null, to: to ?? null };
  }
  return changes;
}
