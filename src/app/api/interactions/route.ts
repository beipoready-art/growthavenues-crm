import { NextResponse } from "next/server";
import { enumParam, param } from "@/lib/filters";
import { assertCanAccessParent, interactionCreateSchema, interactionInclude, INTERACTION_TYPES, timelineWhere, toTimelineEntry } from "@/lib/interactions";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/rbac";
import { handle, HttpError, requireApiUser } from "@/lib/session";

/** Timeline for one lead (?leadId=) or client (?clientId=), newest first, optional ?type= filter. */
export async function GET(req: Request) {
  return handle(async () => {
    const user = await requireApiUser("leads:view");
    const sp = new URL(req.url).searchParams;
    const leadId = param(sp, "leadId");
    const clientId = param(sp, "clientId");
    if (!leadId && !clientId) throw new HttpError(400, "Pass leadId or clientId");
    await assertCanAccessParent(user, { leadId, clientId });

    const originLeadId = clientId ? (await prisma.client.findUnique({ where: { id: clientId }, select: { leadId: true } }))?.leadId : null;
    const interactions = await prisma.interaction.findMany({
      where: { ...timelineWhere({ leadId, clientId, originLeadId }), type: enumParam(sp, "type", INTERACTION_TYPES) },
      include: interactionInclude,
      orderBy: [{ occurredAt: "desc" }, { createdAt: "desc" }],
    });
    const canSeeRemoved = can(user.role, "interactions:viewRemoved");
    return NextResponse.json({ interactions: interactions.map((i) => toTimelineEntry(i, canSeeRemoved)) });
  });
}

export async function POST(req: Request) {
  return handle(async () => {
    const user = await requireApiUser("interactions:log");
    const input = interactionCreateSchema.parse(await req.json());
    await assertCanAccessParent(user, input);
    const interaction = await prisma.interaction.create({
      data: {
        type: input.type,
        occurredAt: input.occurredAt,
        summary: input.summary,
        leadId: input.leadId || null,
        clientId: input.clientId || null,
        loggedById: user.id, // always the signed-in user, never client-supplied
      },
      include: interactionInclude,
    });
    return NextResponse.json({ interaction: toTimelineEntry(interaction, true) }, { status: 201 });
  });
}
