import { NextResponse } from "next/server";
import { audit, diff } from "@/lib/audit";
import { clientUpdateSchema, loadClientForUser } from "@/lib/clients";
import { kycDocsEditable } from "@/lib/kyc";
import { notify } from "@/lib/notifications";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/rbac";
import { handle, HttpError, requireApiUser } from "@/lib/session";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  return handle(async () => {
    const user = await requireApiUser("clients:view");
    return NextResponse.json({ client: await loadClientForUser(user, (await params).id) });
  });
}

export async function PATCH(req: Request, { params }: Ctx) {
  return handle(async () => {
    const user = await requireApiUser("clients:edit");
    const client = await loadClientForUser(user, (await params).id);
    const input = clientUpdateSchema.parse(await req.json());

    if (input.assignedRmId !== undefined && input.assignedRmId !== client.assignedRmId) {
      if (!can(user.role, "clients:assign")) throw new HttpError(403, "Only admins can reassign clients");
      if (input.assignedRmId) {
        const rm = await prisma.user.findFirst({ where: { id: input.assignedRmId, role: "RM", active: true } });
        if (!rm) throw new HttpError(400, "Assigned RM must be an active Relationship Manager");
      }
    } else {
      delete input.assignedRmId;
    }
    // Identity details under review/verified are locked to protect the KYC.
    if (input.panNumber !== undefined && input.panNumber !== client.panNumber && !kycDocsEditable(client.kycStatus)) {
      throw new HttpError(400, "PAN cannot be changed while KYC is submitted, under review or verified");
    }

    const changes = diff(client, input);
    const updated = await prisma.$transaction(async (tx) => {
      const u = await tx.client.update({ where: { id: client.id }, data: input });
      if (Object.keys(changes).length) {
        await audit(tx, { entityType: "Client", entityId: client.id, action: "updated", userId: user.id, metadata: changes as object });
      }
      if (changes.assignedRmId && u.assignedRmId) {
        await notify(tx, [u.assignedRmId], { type: "CLIENT_ASSIGNED", title: `Client assigned to you: ${u.name}`, body: `Reassigned by ${user.name}`, link: `/clients/${u.id}` }, user.id);
      }
      return u;
    });
    return NextResponse.json({ client: updated });
  });
}
