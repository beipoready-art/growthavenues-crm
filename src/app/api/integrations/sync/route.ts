import { NextResponse } from "next/server";
import { syncAccount } from "@/lib/email-sync";
import { prisma } from "@/lib/prisma";
import { handle, requireApiUser } from "@/lib/session";

/** "Sync now" for the signed-in user's connected mailboxes. */
export async function POST() {
  return handle(async () => {
    const user = await requireApiUser();
    const accounts = await prisma.connectedAccount.findMany({ where: { userId: user.id } });
    const results = [];
    for (const a of accounts) {
      try {
        results.push({ provider: a.provider, ...(await syncAccount(a)) });
      } catch (err) {
        results.push({ provider: a.provider, error: (err as Error).message });
      }
    }
    return NextResponse.json({ results });
  });
}
