import { NextResponse } from "next/server";
import { audit } from "@/lib/audit";
import { assertCanEditParent, clearOtherPrimaries, contactCreateSchema } from "@/lib/contacts";
import { prisma } from "@/lib/prisma";
import { handle, requireApiUser } from "@/lib/session";

export async function POST(req: Request) {
  return handle(async () => {
    const user = await requireApiUser();
    const input = contactCreateSchema.parse(await req.json());
    await assertCanEditParent(user, input);
    const contact = await prisma.$transaction(async (tx) => {
      const c = await tx.contact.create({ data: { ...input, clientId: input.clientId || null, leadId: input.leadId || null, isPrimary: !!input.isPrimary } });
      if (c.isPrimary) await clearOtherPrimaries(tx, c, c.id);
      await audit(tx, { entityType: c.clientId ? "Client" : "Lead", entityId: (c.clientId ?? c.leadId)!, action: "contact_added", userId: user.id, metadata: { name: c.name } });
      return c;
    });
    return NextResponse.json({ contact }, { status: 201 });
  });
}
