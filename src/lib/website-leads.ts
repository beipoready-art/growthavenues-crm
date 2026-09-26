import type { LeadSource, Prisma } from "@prisma/client";
import { timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { SERVICE_LINES } from "@/lib/leads";
import { notify } from "@/lib/notifications";
import { prisma } from "@/lib/prisma";
import { optionalCrore } from "@/lib/validation";

/**
 * Payload accepted from beipoready.com forms:
 * - type "readiness_call": "Book an IPO Readiness Call"
 * - type "readiness_check": "Are you IPO ready? 2-minute check" (with answers/score)
 * - type "enquiry": any other contact form
 */
export const websiteLeadSchema = z.object({
  type: z.enum(["readiness_call", "readiness_check", "enquiry"]).default("enquiry"),
  companyName: z.string().trim().min(2, "companyName is required").max(200),
  name: z.string().trim().min(2, "name is required").max(120),
  email: z.string().trim().toLowerCase().email("email is invalid").optional().or(z.literal("")).transform((v) => v || null),
  phone: z.string().trim().min(6, "phone is required").max(20),
  designation: z.string().trim().max(100).optional().transform((v) => v || null),
  city: z.string().trim().max(100).optional().transform((v) => v || null),
  sector: z.string().trim().max(100).optional().transform((v) => v || null),
  service: z.enum(SERVICE_LINES).optional().nullable(),
  revenueCr: optionalCrore,
  message: z.string().trim().max(3000).optional().transform((v) => v || null),
  preferredTime: z.string().trim().max(200).optional().transform((v) => v || null),
  readiness: z
    .object({
      score: z.coerce.number().int().min(0).max(100).optional(),
      answers: z.record(z.string().max(200), z.union([z.string().max(500), z.number(), z.boolean()])).optional(),
    })
    .optional(),
  utm: z.record(z.string().max(50), z.string().max(200)).optional(),
  // Honeypot: real users never fill this hidden field; bots often do.
  website: z.string().optional(),
});
export type WebsiteLead = z.infer<typeof websiteLeadSchema>;

const SOURCE: Record<WebsiteLead["type"], LeadSource> = {
  readiness_call: "READINESS_CALL",
  readiness_check: "READINESS_CHECK",
  enquiry: "WEBSITE",
};

/** Constant-time API key check against WEBSITE_API_KEY. */
export function validApiKey(provided: string | null) {
  const expected = process.env.WEBSITE_API_KEY;
  if (!expected || !provided) return false;
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Browser origins allowed to call the endpoint directly (comma-separated WEBSITE_ALLOWED_ORIGINS). */
export function allowedOrigin(origin: string | null) {
  if (!origin) return null;
  const list = (process.env.WEBSITE_ALLOWED_ORIGINS ?? "https://beipoready.com,https://www.beipoready.com").split(",").map((s) => s.trim());
  return list.includes(origin) ? origin : null;
}

// Simple fixed-window rate limit per client IP (per server instance).
const hits = new Map<string, { count: number; reset: number }>();
export function rateLimited(ip: string, limit = 20, windowMs = 60_000) {
  const now = Date.now();
  const h = hits.get(ip);
  if (!h || h.reset < now) {
    hits.set(ip, { count: 1, reset: now + windowMs });
    return false;
  }
  h.count++;
  return h.count > limit;
}

/** The active RM with the fewest open enquiries (simple load balancing). */
async function pickRm() {
  const rms = await prisma.user.findMany({
    where: { role: "RM", active: true },
    select: { id: true, _count: { select: { assignedLeads: { where: { status: { in: ["NEW", "CONTACTED", "DISCOVERY", "QUALIFIED"] } } } } } },
  });
  rms.sort((a, b) => a._count.assignedLeads - b._count.assignedLeads);
  return rms[0]?.id ?? null;
}

function describe(input: WebsiteLead) {
  const lines = [
    `Website form: ${input.type === "readiness_call" ? "Book an IPO Readiness Call" : input.type === "readiness_check" ? "IPO-ready check" : "Enquiry"} (${new Date().toISOString().slice(0, 10)})`,
    input.preferredTime && `Preferred call time: ${input.preferredTime}`,
    input.message && `Message: ${input.message}`,
    input.utm && `UTM: ${Object.entries(input.utm).map(([k, v]) => `${k}=${v}`).join(", ")}`,
  ];
  return lines.filter(Boolean).join("\n");
}

/**
 * Creates a lead from a website submission, or — if the same person
 * (email or phone) already has an open enquiry from the last 90 days —
 * appends the submission to it instead of creating a duplicate.
 */
export async function ingestWebsiteLead(input: WebsiteLead) {
  const since = new Date(Date.now() - 90 * 86_400_000);
  const existing = await prisma.lead.findFirst({
    where: {
      status: { notIn: ["CONVERTED", "LOST"] },
      createdAt: { gte: since },
      OR: [...(input.email ? [{ email: input.email }] : []), { phone: input.phone }],
    },
    orderBy: { createdAt: "desc" },
  });
  const readinessFields: Prisma.LeadUpdateInput = input.readiness
    ? { readinessScore: input.readiness.score ?? null, readinessAnswers: (input.readiness.answers ?? {}) as Prisma.InputJsonValue }
    : {};

  if (existing) {
    const updated = await prisma.$transaction(async (tx) => {
      const u = await tx.lead.update({
        where: { id: existing.id },
        data: {
          notes: [existing.notes, describe(input)].filter(Boolean).join("\n\n"),
          serviceInterest: existing.serviceInterest ?? input.service ?? undefined,
          revenueCr: existing.revenueCr ?? input.revenueCr ?? undefined,
          ...readinessFields,
        },
      });
      await tx.auditLog.create({ data: { entityType: "Lead", entityId: u.id, action: "website_resubmission", userId: null, metadata: { type: input.type } } });
      await notify(tx, [u.assignedRmId], { type: "LEAD_ASSIGNED", title: `Repeat website enquiry: ${u.companyName}`, body: describe(input).split("\n")[0], link: `/leads/${u.id}` });
      return u;
    });
    return { lead: updated, deduplicated: true };
  }

  const assignedRmId = await pickRm();
  const lead = await prisma.$transaction(async (tx) => {
    const created = await tx.lead.create({
      data: {
        companyName: input.companyName,
        name: input.name,
        designation: input.designation,
        email: input.email,
        phone: input.phone,
        city: input.city,
        sector: input.sector,
        serviceInterest: input.service ?? null,
        revenueCr: input.revenueCr,
        source: SOURCE[input.type],
        status: "NEW",
        notes: describe(input),
        assignedRmId,
        readinessScore: input.readiness?.score ?? null,
        readinessAnswers: input.readiness?.answers as Prisma.InputJsonValue | undefined,
      },
    });
    await tx.auditLog.create({ data: { entityType: "Lead", entityId: created.id, action: "created", userId: null, metadata: { via: "website", type: input.type } } });
    const admins = await tx.user.findMany({ where: { role: "ADMIN", active: true }, select: { id: true } });
    await notify(tx, [assignedRmId, ...admins.map((a) => a.id)], {
      type: "LEAD_ASSIGNED",
      title: `New website enquiry: ${created.companyName}`,
      body: `${created.name} · ${SOURCE[input.type] === "READINESS_CALL" ? "wants an IPO readiness call" : SOURCE[input.type] === "READINESS_CHECK" ? `IPO-ready check${created.readinessScore != null ? ` (score ${created.readinessScore})` : ""}` : "website enquiry"}`,
      link: `/leads/${created.id}`,
    });
    return created;
  });
  return { lead, deduplicated: false };
}
