import { z } from "zod";

export const emailSchema = z.string().trim().toLowerCase().email("Enter a valid email");
export const passwordSchema = z.string().min(8, "Password must be at least 8 characters").max(200);
export const nameSchema = z.string().trim().min(2, "Name is required").max(120);
