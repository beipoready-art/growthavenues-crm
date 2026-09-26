import type { ClientType, Prisma } from "@prisma/client";
import { z } from "zod";
import { dateRange, enumParam, param, type SearchParams } from "@/lib/filters";
import { KYC_STATUSES } from "@/lib/kyc";
import { LEAD_SOURCES } from "@/lib/leads";
import { prisma } from "@/lib/prisma";
import { isScopedToOwn, ownedScope, ownsRecord } from "@/lib/rbac";
import { HttpError } from "@/lib/session";
import type { CurrentUser } from "@/lib/session";
import { nameSchema, optionalEmail, optionalId, optionalText, panSchema, phoneSchema } from "@/lib/validation";

export const CLIENT_TYPES = ["INDIVIDUAL", "HUF", "CORPORATE"] as const satisfies readonly ClientType[];

export function clientWhere(user: CurrentUser, sp: SearchParams | URLSearchParams): Prisma.ClientWhereInput {
  const q = param(sp, "q");
  const rm = param(sp, "rm");
  const where: Prisma.ClientWhereInput = {
    ...ownedScope(user),
    clientType: enumParam(sp, "type", CLIENT_TYPES),
    createdAt: dateRange(sp),
  };
  // `kyc` may be a single status or the "queue" pseudo-status (submitted + under review).
  const kyc = param(sp, "kyc");
  if (kyc === "queue") where.kycStatus = { in: ["SUBMITTED", "UNDER_REVIEW"] };
  else where.kycStatus = enumParam(sp, "kyc", KYC_STATUSES);
  if (rm && !isScopedToOwn(user.role)) where.assignedRmId = rm === "unassigned" ? null : rm;
  if (q) {
    where.OR = [
      { name: { contains: q, mode: "insensitive" } },
      { email: { contains: q, mode: "insensitive" } },
      { phone: { contains: q } },
      { panNumber: { contains: q.toUpperCase() } },
    ];
  }
  return where;
}

export const clientListInclude = { assignedRm: { select: { id: true, name: true } } } as const;

const optionalPan = z
  .union([z.literal(""), panSchema])
  .optional()
  .nullable()
  .transform((v) => (v ? v : null));

export const convertLeadSchema = z.object({
  panNumber: optionalPan,
  clientType: z.enum(CLIENT_TYPES).default("INDIVIDUAL"),
});

export const clientUpdateSchema = z
  .object({
    name: nameSchema,
    phone: phoneSchema,
    email: optionalEmail,
    source: z.enum(LEAD_SOURCES),
    panNumber: optionalPan,
    clientType: z.enum(CLIENT_TYPES),
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
