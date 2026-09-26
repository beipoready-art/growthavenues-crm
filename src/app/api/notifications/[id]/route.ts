import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { handle, HttpError, requireApiUser } from "@/lib/session";

/** Mark one notification read or unread: { read: boolean }. */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const user = await requireApiUser();
    const { read } = z.object({ read: z.boolean() }).parse(await req.json());
    const res = await prisma.notification.updateMany({ where: { id: (await params).id, userId: user.id }, data: { readAt: read ? new Date() : null } });
    if (res.count === 0) throw new HttpError(404, "Notification not found");
    return NextResponse.json({ ok: true });
  });
}
