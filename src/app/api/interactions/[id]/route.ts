import { NextResponse } from "next/server";
import { assertCanAccessParent, interactionDeleteSchema, interactionEditSchema, interactionInclude, toTimelineEntry } from "@/lib/interactions";
import { prisma } from "@/lib/prisma";
import { handle, HttpError, requireApiUser } from "@/lib/session";

type Ctx = { params: Promise<{ id: string }> };

async function load(id: string) {
  const i = await prisma.interaction.findUnique({ where: { id } });
  if (!i) throw new HttpError(404, "Interaction not found");
  return i;
}

/** Admin-only correction. The previous content is preserved as a revision. */
export async function PATCH(req: Request, { params }: Ctx) {
  return handle(async () => {
    const user = await requireApiUser("interactions:amend");
    const existing = await load((await params).id);
    await assertCanAccessParent(user, existing);
    if (existing.deletedAt) throw new HttpError(400, "Removed interactions cannot be edited");
    const { reason, ...changes } = interactionEditSchema.parse(await req.json());

    const updated = await prisma.$transaction(async (tx) => {
      await tx.interactionRevision.create({
        data: {
          interactionId: existing.id,
          previousType: existing.type,
          previousOccurredAt: existing.occurredAt,
          previousSummary: existing.summary,
          reason,
          editedById: user.id,
        },
      });
      return tx.interaction.update({
        where: { id: existing.id },
        data: { ...changes, editedAt: new Date(), editedById: user.id },
        include: interactionInclude,
      });
    });
    return NextResponse.json({ interaction: toTimelineEntry(updated, true) });
  });
}

/** Admin-only soft delete: the entry stays in the log, marked removed with the reason. */
export async function DELETE(req: Request, { params }: Ctx) {
  return handle(async () => {
    const user = await requireApiUser("interactions:amend");
    const existing = await load((await params).id);
    await assertCanAccessParent(user, existing);
    if (existing.deletedAt) throw new HttpError(400, "Already removed");
    const { reason } = interactionDeleteSchema.parse(await req.json().catch(() => ({})));
    const updated = await prisma.interaction.update({
      where: { id: existing.id },
      data: { deletedAt: new Date(), deletedById: user.id, deleteReason: reason },
      include: interactionInclude,
    });
    return NextResponse.json({ interaction: toTimelineEntry(updated, true) });
  });
}
