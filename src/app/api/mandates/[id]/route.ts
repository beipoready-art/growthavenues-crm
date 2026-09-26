import { NextResponse } from "next/server";
import { audit, diff } from "@/lib/audit";
import { estimateFee, loadMandateForUser, mandateInclude, mandateUpdateSchema } from "@/lib/mandates";
import { prisma } from "@/lib/prisma";
import { handle, HttpError, requireApiUser } from "@/lib/session";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  return handle(async () => {
    const user = await requireApiUser("mandates:view");
    return NextResponse.json({ mandate: await loadMandateForUser(user, (await params).id) });
  });
}

export async function PATCH(req: Request, { params }: Ctx) {
  return handle(async () => {
    const user = await requireApiUser("mandates:manage");
    const m = await loadMandateForUser(user, (await params).id);
    const input = mandateUpdateSchema.parse(await req.json());
    if (input.service && input.service !== m.service && m.stage !== "PROPOSAL") {
      throw new HttpError(400, "The service can only be changed while the mandate is at Proposal");
    }
    if (input.leadAdvisorId && input.leadAdvisorId !== m.leadAdvisorId) {
      const advisor = await prisma.user.findFirst({ where: { id: input.leadAdvisorId, active: true, role: { in: ["ADMIN", "RM"] } } });
      if (!advisor) throw new HttpError(400, "Lead advisor must be an active RM or Admin");
    }
    if (input.ipoId && input.ipoId !== m.ipoId) {
      const ipo = await prisma.ipo.findUnique({ where: { id: input.ipoId }, include: { mandate: { select: { id: true } } } });
      if (!ipo) throw new HttpError(404, "IPO issue not found");
      if (ipo.mandate && ipo.mandate.id !== m.id) throw new HttpError(409, "That IPO issue is already linked to another mandate");
    }
    const num = (v: unknown) => (v == null ? null : Number(v));
    const merged = {
      issueSizeCr: input.issueSizeCr !== undefined ? input.issueSizeCr : num(m.issueSizeCr),
      retainerFee: input.retainerFee !== undefined ? input.retainerFee : num(m.retainerFee),
      successFeePct: input.successFeePct !== undefined ? input.successFeePct : num(m.successFeePct),
    };
    const data = { ...input, expectedFee: estimateFee(merged.issueSizeCr, merged.retainerFee, merged.successFeePct) };
    const before = { ...m, issueSizeCr: num(m.issueSizeCr), retainerFee: num(m.retainerFee), successFeePct: num(m.successFeePct), expectedFee: num(m.expectedFee) };
    const changes = diff(before as Record<string, unknown>, data);
    const updated = await prisma.$transaction(async (tx) => {
      const u = await tx.mandate.update({ where: { id: m.id }, data, include: mandateInclude });
      if (Object.keys(changes).length) await audit(tx, { entityType: "Mandate", entityId: m.id, action: "updated", userId: user.id, metadata: changes as object });
      return u;
    });
    return NextResponse.json({ mandate: updated });
  });
}
