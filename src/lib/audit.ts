import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

type Db = Prisma.TransactionClient | typeof prisma;

export function audit(
  db: Db,
  entry: { entityType: string; entityId: string; action: string; userId: string | null; metadata?: Prisma.InputJsonValue },
) {
  return db.auditLog.create({ data: entry });
}

/** Normalises values for comparison/storage: Dates → ISO strings, Prisma Decimals → numbers. */
function norm(v: unknown) {
  if (v instanceof Date) return v.toISOString();
  if (v && typeof v === "object" && "toFixed" in v && typeof (v as { toString(): string }).toString === "function") return Number(String(v));
  return v;
}

/** Builds a { field: { from, to } } diff of changed fields, for audit metadata. */
export function diff(before: object, patch: object) {
  const b = before as Record<string, unknown>;
  const changes: Record<string, { from: unknown; to: unknown }> = {};
  for (const [key, value] of Object.entries(patch)) {
    const from = norm(b[key]);
    const to = norm(value);
    if (to !== undefined && from !== to) changes[key] = { from: from ?? null, to: to ?? null };
  }
  return changes;
}
