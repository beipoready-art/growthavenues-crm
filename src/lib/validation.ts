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
