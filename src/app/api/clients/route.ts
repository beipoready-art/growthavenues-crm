import { NextResponse } from "next/server";
import { clientListInclude, clientWhere } from "@/lib/clients";
import { PAGE_SIZE, pageParam } from "@/lib/filters";
import { prisma } from "@/lib/prisma";
import { handle, requireApiUser } from "@/lib/session";

export async function GET(req: Request) {
  return handle(async () => {
    const user = await requireApiUser("clients:view");
    const sp = new URL(req.url).searchParams;
    const where = clientWhere(user, sp);
    const page = pageParam(sp);
    const [total, clients] = await Promise.all([
      prisma.client.count({ where }),
      prisma.client.findMany({ where, include: clientListInclude, orderBy: { createdAt: "desc" }, skip: (page - 1) * PAGE_SIZE, take: PAGE_SIZE }),
    ]);
    return NextResponse.json({ total, page, pageSize: PAGE_SIZE, clients });
  });
}
