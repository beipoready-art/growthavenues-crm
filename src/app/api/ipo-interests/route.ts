import { NextResponse } from "next/server";
import { z } from "zod";
import { audit } from "@/lib/audit";
import { loadClientForUser } from "@/lib/clients";
import { prisma } from "@/lib/prisma";
import { handle, HttpError, requireApiUser } from "@/lib/session";
import { optionalText } from "@/lib/validation";

const schema = z.object({ ipoId: z.string().min(1), clientId: z.string().min(1), note: optionalText(500) });

/** Record that a client is interested in an IPO (drives "closing soon" reminders). */
export async function POST(req: Request) {
  return handle(async () => {
    const user = await requireApiUser("ipoInterest:manage");
    const input = schema.parse(await req.json());
    const client = await loadClientForUser(user, input.clientId);
    const ipo = await prisma.ipo.findUnique({ where: { id: input.ipoId } });
    if (!ipo) throw new HttpError(404, "IPO not found");
    if (ipo.status === "LISTED" || ipo.status === "CLOSED") throw new HttpError(400, "This IPO is no longer open for subscription");
    const interest = await prisma.ipoInterest.upsert({
      where: { ipoId_clientId: { ipoId: ipo.id, clientId: client.id } },
      create: { ipoId: ipo.id, clientId: client.id, note: input.note, createdById: user.id },
      update: { note: input.note },
    });
    await audit(prisma, { entityType: "Client", entityId: client.id, action: "ipo_interest", userId: user.id, metadata: { ipo: ipo.companyName } });
    return NextResponse.json({ interest }, { status: 201 });
  });
}

export async function DELETE(req: Request) {
  return handle(async () => {
    const user = await requireApiUser("ipoInterest:manage");
    const sp = new URL(req.url).searchParams;
    const client = await loadClientForUser(user, sp.get("clientId") ?? "");
    await prisma.ipoInterest.deleteMany({ where: { ipoId: sp.get("ipoId") ?? "", clientId: client.id } });
    return NextResponse.json({ ok: true });
  });
}
