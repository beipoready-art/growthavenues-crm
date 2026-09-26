import { NextResponse } from "next/server";
import { audit } from "@/lib/audit";
import { PAGE_SIZE, pageParam } from "@/lib/filters";
import { leadCreateSchema, leadListInclude, leadWhere } from "@/lib/leads";
import { notify } from "@/lib/notifications";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/rbac";
import { handle, HttpError, requireApiUser } from "@/lib/session";

export async function GET(req: Request) {
  return handle(async () => {
    const user = await requireApiUser("leads:view");
    const sp = new URL(req.url).searchParams;
    const where = leadWhere(user, sp);
    const page = pageParam(sp);
    const [total, leads] = await Promise.all([
      prisma.lead.count({ where }),
      prisma.lead.findMany({ where, include: leadListInclude, orderBy: { createdAt: "desc" }, skip: (page - 1) * PAGE_SIZE, take: PAGE_SIZE }),
    ]);
    return NextResponse.json({ total, page, pageSize: PAGE_SIZE, leads });
  });
}

export async function POST(req: Request) {
  return handle(async () => {
    const user = await requireApiUser("leads:create");
    const input = leadCreateSchema.parse(await req.json());

    // RMs always own the leads they create; only admins pick an assignee.
    let assignedRmId = input.assignedRmId;
    if (!can(user.role, "leads:assign")) assignedRmId = user.role === "RM" ? user.id : null;
    if (assignedRmId) {
      const rm = await prisma.user.findFirst({ where: { id: assignedRmId, role: "RM", active: true } });
      if (!rm) throw new HttpError(400, "Assigned RM must be an active Relationship Manager");
    }

    const lead = await prisma.$transaction(async (tx) => {
      const created = await tx.lead.create({ data: { ...input, assignedRmId, createdById: user.id } });
      await audit(tx, { entityType: "Lead", entityId: created.id, action: "created", userId: user.id });
      await notify(tx, [assignedRmId], { type: "LEAD_ASSIGNED", title: `New lead assigned: ${created.name}`, body: `Assigned by ${user.name}`, link: `/leads/${created.id}` }, user.id);
      return created;
    });
    return NextResponse.json({ lead }, { status: 201 });
  });
}
