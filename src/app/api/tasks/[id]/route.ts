import { NextResponse } from "next/server";
import { notify } from "@/lib/notifications";
import { prisma } from "@/lib/prisma";
import { handle, HttpError, requireApiUser, type CurrentUser } from "@/lib/session";
import { canTouchTask, resolveAssignee, taskInclude, taskUpdateSchema, toTaskRow } from "@/lib/tasks";

type Ctx = { params: Promise<{ id: string }> };

async function load(user: CurrentUser, id: string) {
  const task = await prisma.task.findUnique({ where: { id } });
  if (!task || !canTouchTask(user, task)) throw new HttpError(404, "Task not found");
  return task;
}

export async function PATCH(req: Request, { params }: Ctx) {
  return handle(async () => {
    const user = await requireApiUser("tasks:manage");
    const task = await load(user, (await params).id);
    const input = taskUpdateSchema.parse(await req.json());
    const assignedToId = input.assignedToId && input.assignedToId !== task.assignedToId ? await resolveAssignee(user, input.assignedToId, task) : undefined;
    const updated = await prisma.task.update({
      where: { id: task.id },
      data: {
        ...input,
        assignedToId,
        ...(input.status === "DONE" && task.status !== "DONE" ? { completedAt: new Date() } : {}),
        ...(input.status === "OPEN" ? { completedAt: null } : {}),
      },
      include: taskInclude,
    });
    if (assignedToId) {
      await notify(prisma, [assignedToId], { type: "TASK_ASSIGNED", title: `Task assigned: ${updated.title}`, body: `From ${user.name}`, link: "/tasks" }, user.id);
    }
    return NextResponse.json({ task: toTaskRow(updated, user) });
  });
}

export async function DELETE(_req: Request, { params }: Ctx) {
  return handle(async () => {
    const user = await requireApiUser("tasks:manage");
    const task = await load(user, (await params).id);
    if (user.role !== "ADMIN" && task.createdById !== user.id) throw new HttpError(403, "Only the task's creator or an admin can delete it");
    await prisma.task.delete({ where: { id: task.id } });
    return NextResponse.json({ ok: true });
  });
}
