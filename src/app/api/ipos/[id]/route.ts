import { NextResponse } from "next/server";
import { z } from "zod";
import { audit, diff } from "@/lib/audit";
import { checkIpoConsistency, ipoUpdateSchema } from "@/lib/ipos";
import { prisma } from "@/lib/prisma";
import { handle, HttpError, requireApiUser } from "@/lib/session";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  return handle(async () => {
    await requireApiUser("ipos:view");
    const ipo = await prisma.ipo.findUnique({ where: { id: (await params).id } });
    if (!ipo) throw new HttpError(404, "IPO not found");
    return NextResponse.json({ ipo });
  });
}

export async function PATCH(req: Request, { params }: Ctx) {
  return handle(async () => {
    const user = await requireApiUser("ipos:manage");
    const ipo = await prisma.ipo.findUnique({ where: { id: (await params).id } });
    if (!ipo) throw new HttpError(404, "IPO not found");
    const input = ipoUpdateSchema.parse(await req.json());

    // Validate the merged record so partial updates can't break invariants.
    const merged = {
      ...ipo,
      priceBandLow: Number(ipo.priceBandLow),
      priceBandHigh: Number(ipo.priceBandHigh),
      ...input,
    };
    z.any().superRefine((_, ctx) => checkIpoConsistency(merged, ctx)).parse(null);

    const before = { ...ipo, priceBandLow: Number(ipo.priceBandLow), priceBandHigh: Number(ipo.priceBandHigh) };
    const changes = diff(before, input);
    const updated = await prisma.$transaction(async (tx) => {
      const u = await tx.ipo.update({ where: { id: ipo.id }, data: input });
      if (Object.keys(changes).length) {
        await audit(tx, { entityType: "Ipo", entityId: ipo.id, action: changes.status ? "status_changed" : "updated", userId: user.id, metadata: changes as object });
      }
      return u;
    });
    return NextResponse.json({ ipo: updated });
  });
}
