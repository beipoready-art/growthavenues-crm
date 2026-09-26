import { Card, PageBody, PageHeader } from "@/components/layout";
import { NewTaskButton, TaskList } from "@/components/tasks";
import { prisma } from "@/lib/prisma";
import { ownedScope } from "@/lib/rbac";
import { requirePageUser } from "@/lib/session";
import { assigneeOptions, bucketTasks, taskInclude, toTaskRow } from "@/lib/tasks";

export default async function MyTasksPage() {
  const user = await requirePageUser("tasks:manage");
  const twoWeeksAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
  const scope = ownedScope(user);
  const [open, done, leads, clients, assignees] = await Promise.all([
    prisma.task.findMany({ where: { assignedToId: user.id, status: "OPEN" }, include: taskInclude, orderBy: { dueAt: "asc" } }),
    prisma.task.findMany({ where: { assignedToId: user.id, status: "DONE", completedAt: { gte: twoWeeksAgo } }, include: taskInclude, orderBy: { completedAt: "desc" } }),
    prisma.lead.findMany({ where: { ...scope, status: { notIn: ["CONVERTED", "LOST"] } }, select: { id: true, name: true }, orderBy: { name: "asc" }, take: 300 }),
    prisma.client.findMany({ where: scope, select: { id: true, name: true }, orderBy: { name: "asc" }, take: 300 }),
    assigneeOptions(user),
  ]);
  const rows = open.map((t) => toTaskRow(t, user));
  const { overdue, today, upcoming } = bucketTasks(rows);
  const related = [
    ...clients.map((c) => ({ value: `client:${c.id}`, label: c.name, group: "Clients" as const })),
    ...leads.map((l) => ({ value: `lead:${l.id}`, label: l.name, group: "Leads" as const })),
  ];

  return (
    <>
      <PageHeader
        title="My tasks"
        description={`${overdue.length} overdue · ${today.length} due today · ${upcoming.length} upcoming`}
        actions={<NewTaskButton size="md" relatedOptions={related} assignees={assignees} />}
      />
      <PageBody className="space-y-5">
        <Card title={`Overdue (${overdue.length})`} className={overdue.length ? "border-red-200" : undefined}>
          <div data-testid="tasks-overdue">
            <TaskList tasks={overdue} tone="overdue" assignees={assignees} emptyTitle="Nothing overdue 🎉" />
          </div>
        </Card>
        <Card title={`Today (${today.length})`}>
          <div data-testid="tasks-today">
            <TaskList tasks={today} assignees={assignees} emptyTitle="Nothing else due today" />
          </div>
        </Card>
        <Card title={`Upcoming (${upcoming.length})`}>
          <div data-testid="tasks-upcoming">
            <TaskList tasks={upcoming} assignees={assignees} emptyTitle="No upcoming tasks" />
          </div>
        </Card>
        <details className="rounded-xl border border-gray-200 bg-white shadow-sm">
          <summary className="cursor-pointer px-5 py-3 text-sm font-semibold text-gray-900">Completed in the last 14 days ({done.length})</summary>
          <div data-testid="tasks-done" className="border-t border-gray-100">
            <TaskList tasks={done.map((t) => toTaskRow(t, user))} assignees={assignees} emptyTitle="No completed tasks" />
          </div>
        </details>
      </PageBody>
    </>
  );
}
