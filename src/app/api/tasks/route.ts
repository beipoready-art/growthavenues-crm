import type { Prisma, TaskStatus } from "@prisma/client";
import { NextResponse } from "next/server";
import { assertCanAccessParent } from "@/lib/interactions";
import { prisma } from "@/lib/prisma";
import { handle, requireApiUser } from "@/lib/session";
import { resolveAssignee, taskCreateSchema, taskInclude, toTaskRow } from "@/lib/tasks";

/** My tasks (?status=OPEN|DONE), or tasks on a record (?leadId= / ?clientId=). */
export async function GET(req: Request) {
  return handle(async () => {
    const user = await requireApiUser("tasks:manage");
    const sp = new URL(req.url).searchParams;
    const leadId = sp.get("leadId");
    const clientId = sp.get("clientId");
    const status: TaskStatus | undefined = sp.get("status") === "DONE" ? "DONE" : sp.get("status") === "OPEN" ? "OPEN" : undefined;
    let where: Prisma.TaskWhereInput;
    if (leadId || clientId) {
      await assertCanAccessParent(user, { leadId, clientId });
      where = { leadId: leadId ?? undefined, clientId: clientId ?? undefined, status };
    } else {
      where = { assignedToId: user.id, status };
    }
    const tasks = await prisma.task.findMany({ where, include: taskInclude, orderBy: { dueAt: "asc" } });
    return NextResponse.json({ tasks: tasks.map((t) => toTaskRow(t, user)) });
  });
}

export async function POST(req: Request) {
  return handle(async () => {
    const user = await requireApiUser("tasks:manage");
    const input = taskCreateSchema.parse(await req.json());
    await assertCanAccessParent(user, input);
    const assignedToId = await resolveAssignee(user, input.assignedToId, input);
    const task = await prisma.task.create({
      data: { ...input, assignedToId, createdById: user.id },
      include: taskInclude,
    });
    return NextResponse.json({ task: toTaskRow(task, user) }, { status: 201 });
  });
}
