import { NextResponse } from "next/server";
import { audit } from "@/lib/audit";
import { MANDATE_STAGE_LABELS } from "@/lib/labels";
import { allowedNextStages, CLOSED_STAGES, lastActiveStage, loadMandateForUser, mandateInclude, stageChangeSchema } from "@/lib/mandates";
import { notify } from "@/lib/notifications";
import { prisma } from "@/lib/prisma";
import { handle, HttpError, requireApiUser } from "@/lib/session";

/** Move a mandate to another stage; every move is recorded with user, time and note. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const user = await requireApiUser("mandates:manage");
    const m = await loadMandateForUser(user, (await params).id);
    const { toStage, note } = stageChangeSchema.parse(await req.json());
    const allowed = allowedNextStages(m.service, m.stage, await lastActiveStage(m.id));
    if (!allowed.includes(toStage)) {
      throw new HttpError(400, `A ${m.service.replace(/_/g, " ").toLowerCase()} mandate can't move from ${MANDATE_STAGE_LABELS[m.stage]} to ${MANDATE_STAGE_LABELS[toStage]}`);
    }
    if ((toStage === "DROPPED" || toStage === "ON_HOLD") && !note) throw new HttpError(400, "Give a reason for putting the mandate on hold or dropping it");

    const now = new Date();
    const updated = await prisma.$transaction(async (tx) => {
      const res = await tx.mandate.updateMany({
        where: { id: m.id, stage: m.stage },
        data: {
          stage: toStage,
          stageChangedAt: now,
          ...(toStage === "MANDATE_SIGNED" && !m.signedAt ? { signedAt: now } : {}),
          closedAt: CLOSED_STAGES.includes(toStage) ? now : null,
        },
      });
      if (res.count === 0) throw new HttpError(409, "The mandate moved in the meantime. Refresh and try again.");
      await tx.mandateStageChange.create({ data: { mandateId: m.id, fromStage: m.stage, toStage, note, changedById: user.id } });
      await audit(tx, { entityType: "Mandate", entityId: m.id, action: "stage_changed", userId: user.id, metadata: { stage: { from: m.stage, to: toStage } } });
      await notify(
        tx,
        [m.leadAdvisorId, m.client.assignedRmId],
        {
          type: "MANDATE_STAGE",
          title: `${m.code} → ${MANDATE_STAGE_LABELS[toStage]}`,
          body: `${m.client.name} · ${m.title} · moved by ${user.name}${note ? ` — ${note}` : ""}`,
          link: `/mandates/${m.id}`,
        },
        user.id,
      );
      return tx.mandate.findUniqueOrThrow({ where: { id: m.id }, include: mandateInclude });
    });
    return NextResponse.json({ mandate: updated });
  });
}
