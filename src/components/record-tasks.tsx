import { Card } from "@/components/layout";
import { NewTaskButton, TaskList } from "@/components/tasks";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/rbac";
import type { CurrentUser } from "@/lib/session";
import { assigneeOptions, taskInclude, toTaskRow } from "@/lib/tasks";

/** Follow-up tasks card for a lead or client profile. */
export async function RecordTasks({ user, target }: { user: CurrentUser; target: { leadId?: string; clientId?: string } }) {
  const [tasks, assignees] = await Promise.all([
    prisma.task.findMany({ where: { ...target, status: "OPEN" }, include: taskInclude, orderBy: { dueAt: "asc" } }),
    assigneeOptions(user),
  ]);
  return (
    <Card title={`Follow-up tasks (${tasks.length})`} actions={can(user.role, "tasks:manage") && <NewTaskButton target={target} assignees={assignees} />}>
      <TaskList tasks={tasks.map((t) => toTaskRow(t, user))} showRelated={false} showAssignee assignees={assignees} emptyTitle="No open tasks" />
    </Card>
  );
}
