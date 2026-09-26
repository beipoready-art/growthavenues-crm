import { z } from "zod";

export const emailSchema = z.string().trim().toLowerCase().email("Enter a valid email");
export const passwordSchema = z.string().min(8, "Password must be at least 8 characters").max(200);
export const nameSchema = z.string().trim().min(2, "Name is required").max(120);

export const phoneSchema = z
  .string()
  .trim()
  .min(6, "Enter a valid phone number")
  .max(20)
  .regex(/^[+\d][\d\s-]+$/, "Enter a valid phone number");

/** Optional email that accepts "" from forms as "no value". */
export const optionalEmail = z
  .union([z.literal(""), emailSchema])
  .optional()
  .nullable()
  .transform((v) => (v ? v : null));

export const optionalText = (max = 2000) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .nullable()
    .transform((v) => (v ? v : null));

/** Optional id from a <select>; "" means unset. */
export const optionalId = z
  .string()
  .optional()
  .nullable()
  .transform((v) => (v ? v : null));

export const panSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z]{5}[0-9]{4}[A-Z]$/, "PAN must look like ABCDE1234F");

/** Optional "" → null wrapper for a pattern-validated, upper-cased identifier. */
const optionalId_ = (schema: z.ZodType<string>) =>
  z
    .union([z.literal(""), schema])
    .optional()
    .nullable()
    .transform((v) => (v ? v : null));

export const cinSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[LU]\d{5}[A-Z]{2}\d{4}[A-Z]{3}\d{6}$/, "CIN must look like U72200MH2015PTC123456");
export const gstinSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/, "GSTIN must look like 27AABCU9603R1ZM");

export const optionalCin = optionalId_(cinSchema);
export const optionalGstin = optionalId_(gstinSchema);
export const optionalPan = optionalId_(panSchema);

/** Optional ₹ crore amount from a form field ("" → null). Negative allowed (losses, negative net worth). */
export const optionalCrore = z
  .union([z.literal(""), z.coerce.number({ error: "Enter a number" }).min(-1e7).max(1e7)])
  .optional()
  .nullable()
  .transform((v) => (v === "" || v === undefined || v === null ? null : Math.round(Number(v) * 100) / 100));

export const optionalYear = z
  .union([z.literal(""), z.coerce.number().int().min(1850, "Enter a valid year").max(new Date().getFullYear(), "Year can't be in the future")])
  .optional()
  .nullable()
  .transform((v) => (v === "" || v === undefined || v === null ? null : Number(v)));
