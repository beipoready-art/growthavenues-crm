import type { NotificationType, Prisma } from "@prisma/client";
import { formatDate } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { endOfZonedDay, zonedDateString } from "@/lib/tz";

type Db = Prisma.TransactionClient | typeof prisma;

export type NewNotification = { type: NotificationType; title: string; body?: string | null; link?: string | null; dedupeKey?: string };

/**
 * Sends a notification to each recipient except the actor (people aren't
 * notified about their own actions). Duplicate dedupe keys are ignored.
 */
export async function notify(db: Db, recipients: (string | null | undefined)[], n: NewNotification, actorId?: string | null) {
  const ids = [...new Set(recipients.filter((r): r is string => !!r && r !== actorId))];
  if (!ids.length) return;
  await db.notification.createMany({
    data: ids.map((userId) => ({ userId, type: n.type, title: n.title, body: n.body ?? null, link: n.link ?? null, dedupeKey: n.dedupeKey ?? null })),
    skipDuplicates: true,
  });
}

export async function complianceOfficerIds(db: Db = prisma) {
  const users = await db.user.findMany({ where: { role: "COMPLIANCE", active: true }, select: { id: true } });
  return users.map((u) => u.id);
}

/** Days before a mandate's target date when "target date approaching" reminders start. */
export const MANDATE_DUE_WINDOW_DAYS = 7;

/**
 * Creates time-based reminders for one user (idempotent via dedupe keys):
 * - tasks assigned to them that are due today or overdue
 * - active mandates they lead whose target date is within MANDATE_DUE_WINDOW_DAYS
 * Runs on page load for the signed-in user; `syncAllNotifications` can be
 * called from a scheduled job to cover users who aren't signed in.
 */
export async function syncNotificationsForUser(userId: string, now = new Date()) {
  const endToday = endOfZonedDay(now);
  const tasks = await prisma.task.findMany({
    where: { assignedToId: userId, status: "OPEN", dueAt: { lte: endToday } },
    select: { id: true, title: true, dueAt: true, leadId: true, clientId: true },
  });
  const taskNotes = tasks.map((t) => {
    const overdue = t.dueAt < now;
    return {
      userId,
      type: "TASK_DUE" as const,
      // Separate keys so a task that was "due today" alerts again once overdue.
      dedupeKey: `task-${overdue ? "overdue" : "due"}:${t.id}`,
      title: overdue ? `Overdue: ${t.title}` : `Due today: ${t.title}`,
      body: `Due ${formatDate(t.dueAt)}`,
      link: t.clientId ? `/clients/${t.clientId}` : `/leads/${t.leadId}`,
    };
  });

  const today = new Date(zonedDateString(now) + "T00:00:00Z");
  const horizon = new Date(today.getTime() + MANDATE_DUE_WINDOW_DAYS * 86_400_000);
  const mandates = await prisma.mandate.findMany({
    where: { leadAdvisorId: userId, targetDate: { lte: horizon }, stage: { notIn: ["LISTED", "COMPLETED", "DROPPED", "ON_HOLD"] } },
    select: { id: true, code: true, title: true, targetDate: true, client: { select: { name: true } } },
  });
  const mandateNotes = mandates.map((m) => {
    const overdue = m.targetDate! < today;
    return {
      userId,
      type: "MANDATE_DUE" as const,
      dedupeKey: `mandate-${overdue ? "overdue" : "due"}:${m.id}:${m.targetDate!.toISOString().slice(0, 10)}`,
      title: `${m.code} target ${overdue ? "passed" : "approaching"}: ${formatDate(m.targetDate)}`,
      body: `${m.client.name} · ${m.title}`,
      link: `/mandates/${m.id}`,
    };
  });

  const data = [...taskNotes, ...mandateNotes];
  if (data.length) await prisma.notification.createMany({ data, skipDuplicates: true });
}

export async function syncAllNotifications(now = new Date()) {
  const users = await prisma.user.findMany({ where: { active: true }, select: { id: true } });
  for (const u of users) await syncNotificationsForUser(u.id, now);
  return users.length;
}

export function unreadCount(userId: string) {
  return prisma.notification.count({ where: { userId, readAt: null } });
}
