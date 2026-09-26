import { NextResponse } from "next/server";
import { parseProvider } from "@/lib/integrations/provider-param";
import { prisma } from "@/lib/prisma";
import { handle, requireApiUser } from "@/lib/session";

/** Disconnect: forget the tokens. Emails already captured stay on the client timelines. */
export async function DELETE(_req: Request, { params }: { params: Promise<{ provider: string }> }) {
  return handle(async () => {
    const user = await requireApiUser();
    const provider = parseProvider((await params).provider);
    await prisma.connectedAccount.deleteMany({ where: { userId: user.id, provider } });
    return NextResponse.json({ ok: true });
  });
}
