import { NextResponse } from "next/server";
import { audit } from "@/lib/audit";
import { loadClientForUser } from "@/lib/clients";
import { defaultBoard, estimateFee, mandateCreateSchema, mandateInclude, mandateWhere, nextMandateCode } from "@/lib/mandates";
import { notify } from "@/lib/notifications";
import { prisma } from "@/lib/prisma";
import { handle, HttpError, requireApiUser } from "@/lib/session";

export async function GET(req: Request) {
  return handle(async () => {
    const user = await requireApiUser("mandates:view");
    const mandates = await prisma.mandate.findMany({
      where: mandateWhere(user, new URL(req.url).searchParams),
      include: mandateInclude,
      orderBy: [{ stageChangedAt: "desc" }],
    });
    return NextResponse.json({ mandates });
  });
}

export async function POST(req: Request) {
  return handle(async () => {
    const user = await requireApiUser("mandates:manage");
    const input = mandateCreateSchema.parse(await req.json());
    const client = await loadClientForUser(user, input.clientId);

    const leadAdvisorId = input.leadAdvisorId ?? client.assignedRmId ?? (user.role === "RM" ? user.id : null);
    if (leadAdvisorId) {
      const advisor = await prisma.user.findFirst({ where: { id: leadAdvisorId, active: true, role: { in: ["ADMIN", "RM"] } } });
      if (!advisor) throw new HttpError(400, "Lead advisor must be an active RM or Admin");
    }

    const mandate = await prisma.$transaction(async (tx) => {
      const created = await tx.mandate.create({
        data: {
          ...input,
          board: input.board ?? defaultBoard(input.service),
          code: await nextMandateCode(tx),
          stage: "PROPOSAL",
          expectedFee: estimateFee(input.issueSizeCr, input.retainerFee, input.successFeePct),
          leadAdvisorId,
          createdById: user.id,
        },
        include: mandateInclude,
      });
      await tx.mandateStageChange.create({ data: { mandateId: created.id, fromStage: null, toStage: "PROPOSAL", changedById: user.id, note: "Mandate opened" } });
      await audit(tx, { entityType: "Client", entityId: client.id, action: "mandate_created", userId: user.id, metadata: { mandateId: created.id, code: created.code, title: created.title } });
      await notify(tx, [leadAdvisorId], { type: "MANDATE_STAGE", title: `New mandate: ${created.code} ${created.title}`, body: `${client.name} · you are the lead advisor`, link: `/mandates/${created.id}` }, user.id);
      return created;
    });
    return NextResponse.json({ mandate }, { status: 201 });
  });
}
