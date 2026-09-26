import type { EntityType, Prisma } from "@prisma/client";
import { z } from "zod";
import { dateRange, enumParam, param, type SearchParams } from "@/lib/filters";
import { KYC_STATUSES } from "@/lib/kyc";
import { LEAD_SOURCES } from "@/lib/leads";
import { prisma } from "@/lib/prisma";
import { isScopedToOwn, ownedScope, ownsRecord } from "@/lib/rbac";
import { HttpError } from "@/lib/session";
import type { CurrentUser } from "@/lib/session";
import {
  optionalCin,
  optionalCrore,
  optionalEmail,
  optionalGstin,
  optionalId,
  optionalPan,
  optionalText,
  optionalYear,
} from "@/lib/validation";

export const ENTITY_TYPES = ["PRIVATE_LIMITED", "PUBLIC_LIMITED", "LLP", "PARTNERSHIP", "PROPRIETORSHIP", "OTHER"] as const satisfies readonly EntityType[];

export function clientWhere(user: CurrentUser, sp: SearchParams | URLSearchParams): Prisma.ClientWhereInput {
  const q = param(sp, "q");
  const rm = param(sp, "rm");
  const where: Prisma.ClientWhereInput = {
    ...ownedScope(user),
    entityType: enumParam(sp, "type", ENTITY_TYPES),
    createdAt: dateRange(sp),
  };
  // `kyc` may be a single status or the "queue" pseudo-status (submitted + under review).
  const kyc = param(sp, "kyc");
  if (kyc === "queue") where.kycStatus = { in: ["SUBMITTED", "UNDER_REVIEW"] };
  else where.kycStatus = enumParam(sp, "kyc", KYC_STATUSES);
  if (rm && !isScopedToOwn(user.role)) where.assignedRmId = rm === "unassigned" ? null : rm;
  const sector = param(sp, "sector");
  if (sector) where.sector = { equals: sector, mode: "insensitive" };
  if (q) {
    where.OR = [
      { name: { contains: q, mode: "insensitive" } },
      { email: { contains: q, mode: "insensitive" } },
      { sector: { contains: q, mode: "insensitive" } },
      { city: { contains: q, mode: "insensitive" } },
      { panNumber: { contains: q.toUpperCase() } },
      { cin: { contains: q.toUpperCase() } },
      { contacts: { some: { OR: [{ name: { contains: q, mode: "insensitive" } }, { email: { contains: q, mode: "insensitive" } }] } } },
    ];
  }
  return where;
}

export const clientListInclude = {
  assignedRm: { select: { id: true, name: true } },
  contacts: { where: { isPrimary: true }, take: 1, select: { name: true, designation: true } },
  _count: { select: { mandates: true } },
} as const;

export const convertLeadSchema = z.object({
  entityType: z.enum(ENTITY_TYPES).default("PRIVATE_LIMITED"),
  cin: optionalCin,
  panNumber: optionalPan,
});

export const clientUpdateSchema = z
  .object({
    name: z.string().trim().min(2, "Company name is required").max(200),
    cin: optionalCin,
    panNumber: optionalPan,
    gstin: optionalGstin,
    entityType: z.enum(ENTITY_TYPES),
    sector: optionalText(100),
    incorporationYear: optionalYear,
    city: optionalText(100),
    state: optionalText(100),
    website: optionalText(200),
    phone: optionalText(40),
    email: optionalEmail,
    source: z.enum(LEAD_SOURCES),
    financialYear: optionalText(20),
    revenueCr: optionalCrore,
    ebitdaCr: optionalCrore,
    patCr: optionalCrore,
    netWorthCr: optionalCrore,
    notes: optionalText(),
    assignedRmId: optionalId,
  })
  .partial();

/** Loads a client the user may see, or throws 404 (RMs can't probe other RMs' ids). */
export async function loadClientForUser(user: CurrentUser, id: string) {
  const client = await prisma.client.findUnique({ where: { id } });
  if (!client || !ownsRecord(user, client)) throw new HttpError(404, "Client not found");
  return client;
}
