import { NextResponse } from "next/server";
import { audit } from "@/lib/audit";
import { ipoCreateSchema, ipoOrder, ipoWhere } from "@/lib/ipos";
import { prisma } from "@/lib/prisma";
import { handle, requireApiUser } from "@/lib/session";

export async function GET(req: Request) {
  return handle(async () => {
    await requireApiUser("ipos:view");
    const ipos = await prisma.ipo.findMany({ where: ipoWhere(new URL(req.url).searchParams), orderBy: ipoOrder });
    return NextResponse.json({ ipos });
  });
}

export async function POST(req: Request) {
  return handle(async () => {
    const user = await requireApiUser("ipos:manage");
    const input = ipoCreateSchema.parse(await req.json());
    const ipo = await prisma.$transaction(async (tx) => {
      const created = await tx.ipo.create({ data: { ...input, createdById: user.id } });
      await audit(tx, { entityType: "Ipo", entityId: created.id, action: "created", userId: user.id });
      return created;
    });
    return NextResponse.json({ ipo }, { status: 201 });
  });
}
