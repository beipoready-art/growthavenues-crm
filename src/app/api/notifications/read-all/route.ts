import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { handle, requireApiUser } from "@/lib/session";

export async function POST() {
  return handle(async () => {
    const user = await requireApiUser();
    const { count } = await prisma.notification.updateMany({ where: { userId: user.id, readAt: null }, data: { readAt: new Date() } });
    return NextResponse.json({ updated: count });
  });
}
