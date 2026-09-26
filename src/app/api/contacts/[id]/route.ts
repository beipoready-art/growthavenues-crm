import { NextResponse } from "next/server";
import { audit, diff } from "@/lib/audit";
import { assertCanEditParent, clearOtherPrimaries, contactUpdateSchema } from "@/lib/contacts";
import { prisma } from "@/lib/prisma";
import { handle, HttpError, requireApiUser } from "@/lib/session";

type Ctx = { params: Promise<{ id: string }> };

async function load(id: string) {
  const c = await prisma.contact.findUnique({ where: { id } });
  if (!c) throw new HttpError(404, "Contact not found");
  return c;
}

export async function PATCH(req: Request, { params }: Ctx) {
  return handle(async () => {
    const user = await requireApiUser();
    const c = await load((await params).id);
    await assertCanEditParent(user, c);
    const input = contactUpdateSchema.parse(await req.json());
    const changes = diff(c, input);
    const contact = await prisma.$transaction(async (tx) => {
      const u = await tx.contact.update({ where: { id: c.id }, data: input });
      if (u.isPrimary) await clearOtherPrimaries(tx, u, u.id);
      if (Object.keys(changes).length) {
        await audit(tx, { entityType: c.clientId ? "Client" : "Lead", entityId: (c.clientId ?? c.leadId)!, action: "contact_updated", userId: user.id, metadata: { contact: c.name, ...changes } });
      }
      return u;
    });
    return NextResponse.json({ contact });
  });
}

export async function DELETE(_req: Request, { params }: Ctx) {
  return handle(async () => {
    const user = await requireApiUser();
    const c = await load((await params).id);
    await assertCanEditParent(user, c);
    await prisma.$transaction([
      prisma.contact.delete({ where: { id: c.id } }),
      prisma.auditLog.create({ data: { entityType: c.clientId ? "Client" : "Lead", entityId: (c.clientId ?? c.leadId)!, action: "contact_removed", userId: user.id, metadata: { name: c.name } } }),
    ]);
    return NextResponse.json({ ok: true });
  });
}
