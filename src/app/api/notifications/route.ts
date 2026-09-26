import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { handle, requireApiUser } from "@/lib/session";

/** The signed-in user's notifications, newest first. ?unread=1 to filter, ?limit=N (max 100). */
export async function GET(req: Request) {
  return handle(async () => {
    const user = await requireApiUser();
    const sp = new URL(req.url).searchParams;
    const limit = Math.min(100, Math.max(1, Number(sp.get("limit")) || 50));
    const where = { userId: user.id, ...(sp.get("unread") === "1" ? { readAt: null } : {}) };
    const [notifications, unread] = await Promise.all([
      prisma.notification.findMany({ where, orderBy: { createdAt: "desc" }, take: limit }),
      prisma.notification.count({ where: { userId: user.id, readAt: null } }),
    ]);
    return NextResponse.json({ notifications, unread });
  });
}
