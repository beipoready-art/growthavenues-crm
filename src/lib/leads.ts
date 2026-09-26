import type { LeadSource, LeadStatus, Prisma } from "@prisma/client";
import { z } from "zod";
import { dateRange, enumParam, param, type SearchParams } from "@/lib/filters";
import { isScopedToOwn, ownedScope } from "@/lib/rbac";
import type { CurrentUser } from "@/lib/session";
import { nameSchema, optionalEmail, optionalId, optionalText, phoneSchema } from "@/lib/validation";

export const LEAD_STATUSES = ["NEW", "CONTACTED", "QUALIFIED", "CONVERTED", "LOST"] as const satisfies readonly LeadStatus[];
export const LEAD_SOURCES = ["REFERRAL", "WEBSITE", "CALL_IN", "OTHER"] as const satisfies readonly LeadSource[];

/** Builds the Prisma filter for the leads list; always includes the RM ownership scope. */
export function leadWhere(user: CurrentUser, sp: SearchParams | URLSearchParams): Prisma.LeadWhereInput {
  const q = param(sp, "q");
  const rm = param(sp, "rm");
  const where: Prisma.LeadWhereInput = {
    ...ownedScope(user),
    status: enumParam(sp, "status", LEAD_STATUSES),
    source: enumParam(sp, "source", LEAD_SOURCES),
    createdAt: dateRange(sp),
  };
  if (rm && !isScopedToOwn(user.role)) where.assignedRmId = rm === "unassigned" ? null : rm;
  if (q) {
    where.OR = [
      { name: { contains: q, mode: "insensitive" } },
      { email: { contains: q, mode: "insensitive" } },
      { phone: { contains: q } },
    ];
  }
  return where;
}

export const leadListInclude = { assignedRm: { select: { id: true, name: true } }, client: { select: { id: true } } } as const;

export const leadCreateSchema = z.object({
  name: nameSchema,
  phone: phoneSchema,
  email: optionalEmail,
  source: z.enum(LEAD_SOURCES),
  status: z.enum(LEAD_STATUSES).exclude(["CONVERTED"]).default("NEW"),
  notes: optionalText(),
  assignedRmId: optionalId,
});

export const leadUpdateSchema = leadCreateSchema.partial();
