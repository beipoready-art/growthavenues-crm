import type { IpoStatus, Prisma } from "@prisma/client";
import { z } from "zod";
import { enumParam, param, type SearchParams } from "@/lib/filters";
import { optionalText } from "@/lib/validation";

export const IPO_STATUSES = ["UPCOMING", "OPEN", "CLOSED", "LISTED"] as const satisfies readonly IpoStatus[];

export function ipoWhere(sp: SearchParams | URLSearchParams): Prisma.IpoWhereInput {
  const q = param(sp, "q");
  return {
    status: enumParam(sp, "status", IPO_STATUSES),
    ...(q ? { OR: [{ companyName: { contains: q, mode: "insensitive" } }, { symbol: { contains: q, mode: "insensitive" } }] } : {}),
  };
}

/** Open first, then upcoming, closed, listed; newest dates first within a status. */
export const ipoOrder: Prisma.IpoOrderByWithRelationInput[] = [{ openDate: "desc" }];
export const STATUS_RANK: Record<IpoStatus, number> = { OPEN: 0, UPCOMING: 1, CLOSED: 2, LISTED: 3 };

const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Enter a valid date").transform((s) => new Date(s + "T00:00:00Z"));
const optionalDate = z
  .union([z.literal(""), dateStr])
  .optional()
  .nullable()
  .transform((v) => (v ? v : null));
const money = z.coerce.number({ error: "Enter a number" }).positive("Must be greater than 0").max(1e9);

const ipoFields = z.object({
  companyName: z.string().trim().min(2, "Company name is required").max(200),
  symbol: optionalText(40),
  exchange: optionalText(40),
  priceBandLow: money,
  priceBandHigh: money,
  lotSize: z.coerce.number().int("Lot size must be a whole number").positive("Lot size must be at least 1").max(1e7),
  openDate: dateStr,
  closeDate: dateStr,
  listingDate: optionalDate,
  status: z.enum(IPO_STATUSES),
  notes: optionalText(),
});

type IpoInput = z.infer<typeof ipoFields>;

function checkConsistency(v: Partial<IpoInput>, ctx: z.RefinementCtx) {
  if (v.priceBandLow !== undefined && v.priceBandHigh !== undefined && v.priceBandLow > v.priceBandHigh) {
    ctx.addIssue({ code: "custom", path: ["priceBandHigh"], message: "Upper price must be ≥ lower price" });
  }
  if (v.openDate && v.closeDate && v.openDate > v.closeDate) {
    ctx.addIssue({ code: "custom", path: ["closeDate"], message: "Close date must be on or after open date" });
  }
  if (v.closeDate && v.listingDate && v.listingDate < v.closeDate) {
    ctx.addIssue({ code: "custom", path: ["listingDate"], message: "Listing date must be on or after close date" });
  }
}

export const ipoCreateSchema = ipoFields.superRefine(checkConsistency);
export const ipoUpdateSchema = ipoFields.partial();
export { checkConsistency as checkIpoConsistency };

/** Plain JSON shape for client components (Decimals → numbers, dates → ISO). */
export function serializeIpo<T extends { priceBandLow: Prisma.Decimal; priceBandHigh: Prisma.Decimal; openDate: Date; closeDate: Date; listingDate: Date | null }>(ipo: T) {
  return {
    ...ipo,
    priceBandLow: Number(ipo.priceBandLow),
    priceBandHigh: Number(ipo.priceBandHigh),
    openDate: ipo.openDate.toISOString(),
    closeDate: ipo.closeDate.toISOString(),
    listingDate: ipo.listingDate?.toISOString() ?? null,
  };
}

export const formatPriceBand = (low: number | Prisma.Decimal, high: number | Prisma.Decimal) =>
  Number(low) === Number(high) ? `₹${Number(low)}` : `₹${Number(low)} – ₹${Number(high)}`;
