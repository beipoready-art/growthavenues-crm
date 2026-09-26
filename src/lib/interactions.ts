import type { InteractionType, Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ownsRecord } from "@/lib/rbac";
import { HttpError, type CurrentUser } from "@/lib/session";

export const INTERACTION_TYPES = ["CALL", "EMAIL", "MEETING", "WHATSAPP", "NOTE"] as const satisfies readonly InteractionType[];

const occurredAt = z
  .string()
  .min(1, "Enter when it happened")
  .transform((s) => new Date(s))
  .refine((d) => !isNaN(d.getTime()), "Enter a valid date and time")
  .refine((d) => d.getTime() <= Date.now() + 5 * 60 * 1000, "Interactions cannot be in the future");

const summary = z.string().trim().min(3, "Write a short summary").max(5000);
const reason = z.string().trim().min(5, "Give a reason (at least 5 characters)").max(1000);

export const interactionCreateSchema = z
  .object({
    leadId: z.string().optional().nullable(),
    clientId: z.string().optional().nullable(),
    type: z.enum(INTERACTION_TYPES),
    occurredAt,
    summary,
  })
  .refine((v) => !!v.leadId !== !!v.clientId, "Link the interaction to exactly one lead or client");

export const interactionEditSchema = z.object({ type: z.enum(INTERACTION_TYPES).optional(), occurredAt: occurredAt.optional(), summary: summary.optional(), reason });
export const interactionDeleteSchema = z.object({ reason });

/** Resolves the lead/client an interaction belongs to and checks the user may see it. */
export async function assertCanAccessParent(user: CurrentUser, parent: { leadId?: string | null; clientId?: string | null }) {
  if (parent.clientId) {
    const client = await prisma.client.findUnique({ where: { id: parent.clientId }, select: { id: true, assignedRmId: true } });
    if (!client || !ownsRecord(user, client)) throw new HttpError(404, "Client not found");
    return;
  }
  if (parent.leadId) {
    const lead = await prisma.lead.findUnique({ where: { id: parent.leadId }, select: { id: true, assignedRmId: true } });
    if (!lead || !ownsRecord(user, lead)) throw new HttpError(404, "Lead not found");
    return;
  }
  throw new HttpError(400, "Interaction has no lead or client");
}

export const interactionInclude = {
  loggedBy: { select: { name: true } },
  editedBy: { select: { name: true } },
  deletedBy: { select: { name: true } },
  revisions: { include: { editedBy: { select: { name: true } } }, orderBy: { createdAt: "desc" } },
} as const satisfies Prisma.InteractionInclude;

/**
 * Timeline scope for a record. A client's timeline also includes everything
 * logged against the lead it was converted from, so history carries over.
 */
export function timelineWhere(target: { leadId?: string; clientId?: string; originLeadId?: string | null }): Prisma.InteractionWhereInput {
  if (target.clientId) {
    return { OR: [{ clientId: target.clientId }, ...(target.originLeadId ? [{ leadId: target.originLeadId }] : [])] };
  }
  return { leadId: target.leadId };
}

type Row = Prisma.InteractionGetPayload<{ include: typeof interactionInclude }>;

/** Serializes for the timeline; hides removed entries' text from users who may not see it. */
export function toTimelineEntry(i: Row, canSeeRemoved: boolean) {
  const hide = !!i.deletedAt && !canSeeRemoved;
  return {
    id: i.id,
    type: i.type,
    occurredAt: i.occurredAt.toISOString(),
    summary: hide ? null : i.summary,
    fromLead: !!i.leadId,
    loggedBy: i.loggedBy.name,
    createdAt: i.createdAt.toISOString(),
    editedAt: i.editedAt?.toISOString() ?? null,
    editedBy: i.editedBy?.name ?? null,
    deletedAt: i.deletedAt?.toISOString() ?? null,
    deletedBy: i.deletedBy?.name ?? null,
    deleteReason: i.deleteReason,
    revisions: hide
      ? []
      : i.revisions.map((r) => ({
          id: r.id,
          previousType: r.previousType,
          previousOccurredAt: r.previousOccurredAt.toISOString(),
          previousSummary: r.previousSummary,
          reason: r.reason,
          editedBy: r.editedBy.name,
          createdAt: r.createdAt.toISOString(),
        })),
  };
}

export type TimelineEntry = ReturnType<typeof toTimelineEntry>;
