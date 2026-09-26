import type { IpoApplicationStatus, Prisma } from "@prisma/client";
import { z } from "zod";
import { enumParam, param, type SearchParams } from "@/lib/filters";
import { can, ownedScope, ownsRecord } from "@/lib/rbac";
import type { CurrentUser } from "@/lib/session";
import { optionalText } from "@/lib/validation";

export const IPO_APP_STATUSES = ["APPLIED", "ALLOTTED", "PARTIALLY_ALLOTTED", "REJECTED", "REFUNDED"] as const satisfies readonly IpoApplicationStatus[];

/** IPO statuses during which new applications can be logged (CLOSED allows late entry of bids placed in the window). */
export const IPO_ACCEPTING_APPLICATIONS = ["OPEN", "CLOSED"] as const;

export function applicationWhere(user: CurrentUser, sp: SearchParams | URLSearchParams): Prisma.IpoApplicationWhereInput {
  return {
    client: ownedScope(user),
    ipoId: param(sp, "ipoId"),
    clientId: param(sp, "clientId"),
    status: enumParam(sp, "status", IPO_APP_STATUSES),
  };
}

export const applicationInclude = {
  ipo: { select: { id: true, companyName: true, lotSize: true, priceBandHigh: true, status: true } },
  client: { select: { id: true, name: true, panNumber: true, assignedRm: { select: { id: true, name: true } } } },
  createdBy: { select: { name: true } },
} as const;

const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Enter a valid date").transform((s) => new Date(s + "T00:00:00Z"));
const optionalAmount = z
  .union([z.literal(""), z.coerce.number().positive("Amount must be greater than 0").max(1e10)])
  .optional()
  .nullable()
  .transform((v) => (v === "" || v === undefined || v === null ? null : v));

export const applicationCreateSchema = z.object({
  ipoId: z.string().min(1, "Choose an IPO"),
  clientId: z.string().min(1),
  lotsApplied: z.coerce.number().int("Lots must be a whole number").min(1, "Apply for at least 1 lot").max(10000),
  amount: optionalAmount,
  applicationDate: dateStr,
  notes: optionalText(),
});

export const applicationUpdateSchema = z.object({
  status: z.enum(IPO_APP_STATUSES).optional(),
  lotsAllotted: z
    .union([z.literal(""), z.coerce.number().int().min(0)])
    .optional()
    .nullable()
    .transform((v) => (v === "" || v === undefined ? undefined : v)),
  lotsApplied: z.coerce.number().int().min(1).max(10000).optional(),
  amount: optionalAmount,
  notes: optionalText(),
});

/** Bid amount at the upper price band (cut-off). */
export function defaultAmount(lots: number, lotSize: number, priceBandHigh: number | Prisma.Decimal) {
  return Math.round(lots * lotSize * Number(priceBandHigh) * 100) / 100;
}

type Summary = { applications: number; lots: number; amount: number; byStatus: Record<IpoApplicationStatus, number> };

export function summarize(apps: { lotsApplied: number; amount: Prisma.Decimal | number; status: IpoApplicationStatus }[]): Summary {
  const byStatus = Object.fromEntries(IPO_APP_STATUSES.map((s) => [s, 0])) as Record<IpoApplicationStatus, number>;
  let lots = 0;
  let amount = 0;
  for (const a of apps) {
    byStatus[a.status]++;
    lots += a.lotsApplied;
    amount += Number(a.amount);
  }
  return { applications: apps.length, lots, amount, byStatus };
}

type AppWithRelations = Prisma.IpoApplicationGetPayload<{ include: typeof applicationInclude }>;

/** Serializable row for the ApplicationsTable client component. */
export function toApplicationRow(a: AppWithRelations, user: CurrentUser) {
  return {
    id: a.id,
    ipo: { id: a.ipo.id, companyName: a.ipo.companyName },
    client: { id: a.client.id, name: a.client.name, rm: a.client.assignedRm?.name ?? null },
    lotsApplied: a.lotsApplied,
    lotsAllotted: a.lotsAllotted,
    amount: Number(a.amount),
    applicationDate: a.applicationDate.toISOString(),
    status: a.status,
    notes: a.notes,
    canEdit: can(user.role, "ipoApps:manage") && ownsRecord(user, { assignedRmId: a.client.assignedRm?.id ?? null }),
  };
}
