import type { Prisma, TaskPriority } from "@prisma/client";
import { z } from "zod";
import { assertCanAccessParent } from "@/lib/interactions";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/rbac";
import { HttpError, type CurrentUser } from "@/lib/session";
import { endOfZonedDay } from "@/lib/tz";
import { optionalText } from "@/lib/validation";

export const TASK_PRIORITIES = ["HIGH", "MEDIUM", "LOW"] as const satisfies readonly TaskPriority[];

const dueAt = z
  .string()
  .min(1, "Choose a due date")
  .transform((s) => new Date(s))
  .refine((d) => !isNaN(d.getTime()), "Enter a valid due date");

export const taskCreateSchema = z
  .object({
    title: z.string().trim().min(3, "Give the task a title").max(200),
    description: optionalText(2000),
    dueAt,
    priority: z.enum(TASK_PRIORITIES).default("MEDIUM"),
    leadId: z.string().optional().nullable().transform((v) => v || null),
    clientId: z.string().optional().nullable().transform((v) => v || null),
    assignedToId: z.string().optional().nullable().transform((v) => v || null),
  })
  .refine((v) => !!v.leadId !== !!v.clientId, "Link the task to a lead or a client");

export const taskUpdateSchema = z.object({
  title: z.string().trim().min(3).max(200).optional(),
  description: optionalText(2000),
  dueAt: dueAt.optional(),
  priority: z.enum(TASK_PRIORITIES).optional(),
  status: z.enum(["OPEN", "DONE"]).optional(),
  assignedToId: z.string().optional(),
});

export const taskInclude = {
  lead: { select: { id: true, companyName: true } },
  client: { select: { id: true, name: true } },
  assignedTo: { select: { id: true, name: true } },
  createdBy: { select: { name: true } },
} as const satisfies Prisma.TaskInclude;

/** Who may see / change a task: its assignee, its creator, or an admin. */
export function canTouchTask(user: CurrentUser, task: { assignedToId: string; createdById: string | null }) {
  return user.role === "ADMIN" || task.assignedToId === user.id || task.createdById === user.id;
}

/** Validates an assignee: self, or (admins only) any active user who can manage tasks. */
export async function resolveAssignee(user: CurrentUser, assignedToId: string | null | undefined, parent: { leadId?: string | null; clientId?: string | null }) {
  if (!assignedToId || assignedToId === user.id) return user.id;
  if (!can(user.role, "tasks:assignOthers")) throw new HttpError(403, "You can only assign tasks to yourself");
  const assignee = await prisma.user.findFirst({ where: { id: assignedToId, active: true } });
  if (!assignee || !can(assignee.role, "tasks:manage")) throw new HttpError(400, "Assignee must be an active RM, Compliance Officer or Admin");
  // The assignee must be able to see the linked record.
  await assertCanAccessParent({ id: assignee.id, name: assignee.name, email: assignee.email, role: assignee.role }, parent).catch(() => {
    throw new HttpError(400, `${assignee.name} cannot access this record`);
  });
  return assignee.id;
}

/** Open tasks for a user bucketed into overdue / today / upcoming (app timezone). */
export function bucketTasks<T extends { dueAt: Date | string; status: string }>(tasks: T[], now = new Date()) {
  const endToday = endOfZonedDay(now).getTime();
  const open = tasks.filter((t) => t.status === "OPEN");
  const due = (t: T) => new Date(t.dueAt).getTime();
  return {
    overdue: open.filter((t) => due(t) < now.getTime()),
    today: open.filter((t) => due(t) >= now.getTime() && due(t) <= endToday),
    upcoming: open.filter((t) => due(t) > endToday),
  };
}

/** Count for the sidebar badge: my open tasks that are overdue or due by end of today. */
export function dueTaskCount(userId: string, now = new Date()) {
  return prisma.task.count({ where: { assignedToId: userId, status: "OPEN", dueAt: { lte: endOfZonedDay(now) } } });
}

type Row = Prisma.TaskGetPayload<{ include: typeof taskInclude }>;
export function toTaskRow(t: Row, user: CurrentUser) {
  return {
    id: t.id,
    title: t.title,
    description: t.description,
    dueAt: t.dueAt.toISOString(),
    priority: t.priority,
    status: t.status,
    completedAt: t.completedAt?.toISOString() ?? null,
    related: t.lead ? { kind: "lead" as const, id: t.lead.id, name: t.lead.companyName } : t.client ? { kind: "client" as const, id: t.client.id, name: t.client.name } : null,
    assignedTo: t.assignedTo,
    createdBy: t.createdBy?.name ?? null,
    canEdit: canTouchTask(user, t),
  };
}
export type TaskRow = ReturnType<typeof toTaskRow>;

/** Assignee choices for admins (empty for everyone else, who can only assign themselves). */
export async function assigneeOptions(user: CurrentUser) {
  if (!can(user.role, "tasks:assignOthers")) return [];
  const users = await prisma.user.findMany({
    where: { active: true, role: { in: ["ADMIN", "COMPLIANCE", "RM"] } },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
  return users.map((u) => ({ value: u.id, label: u.name }));
}
