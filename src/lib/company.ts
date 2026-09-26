import { cache } from "react";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { optionalText } from "@/lib/validation";

export type CompanyProfileView = {
  firmName: string;
  tagline: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  address: string | null;
  sebiRegistration: string | null;
  logoUrl: string | null;
};

/** The firm profile (singleton), memoised per request. Falls back to defaults before first save. */
export const getCompanyProfile = cache(async (): Promise<CompanyProfileView> => {
  const p = await prisma.companyProfile.findUnique({ where: { id: 1 } });
  return {
    firmName: p?.firmName ?? "Be IPO Ready",
    tagline: p?.tagline ?? null,
    email: p?.email ?? null,
    phone: p?.phone ?? null,
    website: p?.website ?? null,
    address: p?.address ?? null,
    sebiRegistration: p?.sebiRegistration ?? null,
    // Version the URL so browsers pick up a new logo immediately.
    logoUrl: p?.logoKey ? `/api/settings/logo?v=${p.updatedAt.getTime()}` : null,
  };
});

export const companyProfileSchema = z.object({
  firmName: z.string().trim().min(2, "Firm name is required").max(120),
  tagline: optionalText(160),
  email: z
    .union([z.literal(""), z.string().trim().email("Enter a valid email")])
    .optional()
    .nullable()
    .transform((v) => v || null),
  phone: optionalText(40),
  website: z
    .union([z.literal(""), z.string().trim().url("Enter a full URL, e.g. https://growthavenues.in")])
    .optional()
    .nullable()
    .transform((v) => v || null),
  address: optionalText(500),
  sebiRegistration: optionalText(60),
});

export const LOGO_MIME_TYPES = ["image/png", "image/jpeg", "image/webp"]; // no SVG: it can carry script
export const MAX_LOGO_BYTES = 1024 * 1024;
