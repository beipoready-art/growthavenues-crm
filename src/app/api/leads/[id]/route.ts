import { NextResponse } from "next/server";
import { audit, diff } from "@/lib/audit";
import { leadUpdateSchema } from "@/lib/leads";
import { prisma } from "@/lib/prisma";
import { can, ownsRecord } from "@/lib/rbac";
import { handle, HttpError, requireApiUser, type CurrentUser } from "@/lib/session";

type Ctx = { params: Promise<{ id: string }> };

async function loadLead(user: CurrentUser, id: string) {
  const lead = await prisma.lead.findUnique({ where: { id }, include: { assignedRm: { select: { id: true, name: true } }, client: { select: { id: true } } } });
  // RMs get a 404 (not 403) for other RMs' leads so ids can't be probed.
  if (!lead || !ownsRecord(user, lead)) throw new HttpError(404, "Lead not found");
  return lead;
}

export async function GET(_req: Request, { params }: Ctx) {
  return handle(async () => {
    const user = await requireApiUser("leads:view");
    return NextResponse.json({ lead: await loadLead(user, (await params).id) });
  });
}

export async function PATCH(req: Request, { params }: Ctx) {
  return handle(async () => {
    const user = await requireApiUser("leads:edit");
    const lead = await loadLead(user, (await params).id);
    const input = leadUpdateSchema.parse(await req.json());

    if (lead.status === "CONVERTED") throw new HttpError(400, "Converted leads are read-only. Edit the client record instead.");
    if (input.assignedRmId !== undefined && input.assignedRmId !== lead.assignedRmId) {
      if (!can(user.role, "leads:assign")) throw new HttpError(403, "Only admins can reassign leads");
      if (input.assignedRmId) {
        const rm = await prisma.user.findFirst({ where: { id: input.assignedRmId, role: "RM", active: true } });
        if (!rm) throw new HttpError(400, "Assigned RM must be an active Relationship Manager");
      }
    } else {
      delete input.assignedRmId;
    }

    const changes = diff(lead, input);
    const updated = await prisma.$transaction(async (tx) => {
      const u = await tx.lead.update({ where: { id: lead.id }, data: input });
      if (Object.keys(changes).length) {
        await audit(tx, {
          entityType: "Lead",
          entityId: lead.id,
          action: changes.status ? "status_changed" : "updated",
          userId: user.id,
          metadata: changes as object,
        });
      }
      return u;
    });
    return NextResponse.json({ lead: updated });
  });
}

export async function DELETE(_req: Request, { params }: Ctx) {
  return handle(async () => {
    const user = await requireApiUser("leads:delete");
    const lead = await loadLead(user, (await params).id);
    if (lead.client) throw new HttpError(400, "This lead has been converted and cannot be deleted");
    await prisma.$transaction([
      prisma.lead.delete({ where: { id: lead.id } }),
      prisma.auditLog.create({ data: { entityType: "Lead", entityId: lead.id, action: "deleted", userId: user.id, metadata: { name: lead.name } } }),
    ]);
    return NextResponse.json({ ok: true });
  });
}
