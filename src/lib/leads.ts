import type { LeadSource, LeadStatus, Prisma, ServiceLine } from "@prisma/client";
import { z } from "zod";
import { dateRange, enumParam, param, type SearchParams } from "@/lib/filters";
import { isScopedToOwn, ownedScope } from "@/lib/rbac";
import type { CurrentUser } from "@/lib/session";
import { nameSchema, optionalCrore, optionalEmail, optionalId, optionalText, phoneSchema } from "@/lib/validation";

export const LEAD_STATUSES = ["NEW", "CONTACTED", "DISCOVERY", "QUALIFIED", "CONVERTED", "LOST"] as const satisfies readonly LeadStatus[];
export const LEAD_SOURCES = ["WEBSITE", "READINESS_CALL", "READINESS_CHECK", "REFERRAL", "EVENT", "CALL_IN", "OTHER"] as const satisfies readonly LeadSource[];
export const SERVICE_LINES = ["FUND_RAISING", "PRE_IPO", "SME_IPO", "MAINBOARD_IPO", "VALUATION_RESTRUCTURING"] as const satisfies readonly ServiceLine[];

/** Builds the Prisma filter for the leads list; always includes the RM ownership scope. */
export function leadWhere(user: CurrentUser, sp: SearchParams | URLSearchParams): Prisma.LeadWhereInput {
  const q = param(sp, "q");
  const rm = param(sp, "rm");
  const where: Prisma.LeadWhereInput = {
    ...ownedScope(user),
    status: enumParam(sp, "status", LEAD_STATUSES),
    source: enumParam(sp, "source", LEAD_SOURCES),
    serviceInterest: enumParam(sp, "service", SERVICE_LINES),
    createdAt: dateRange(sp),
  };
  if (rm && !isScopedToOwn(user.role)) where.assignedRmId = rm === "unassigned" ? null : rm;
  if (q) {
    where.OR = [
      { companyName: { contains: q, mode: "insensitive" } },
      { name: { contains: q, mode: "insensitive" } },
      { email: { contains: q, mode: "insensitive" } },
      { phone: { contains: q } },
    ];
  }
  return where;
}

export const leadListInclude = { assignedRm: { select: { id: true, name: true } }, client: { select: { id: true } } } as const;

export const leadCreateSchema = z.object({
  companyName: z.string().trim().min(2, "Company name is required").max(200),
  name: nameSchema,
  designation: optionalText(100),
  phone: phoneSchema,
  email: optionalEmail,
  city: optionalText(100),
  sector: optionalText(100),
  serviceInterest: z
    .union([z.literal(""), z.enum(SERVICE_LINES)])
    .optional()
    .nullable()
    .transform((v) => (v ? v : null)),
  revenueCr: optionalCrore,
  source: z.enum(LEAD_SOURCES),
  status: z.enum(LEAD_STATUSES).exclude(["CONVERTED"]).default("NEW"),
  notes: optionalText(),
  assignedRmId: optionalId,
});

export const leadUpdateSchema = leadCreateSchema.partial();
