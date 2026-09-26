import { prisma } from "@/lib/prisma";
import { meetingInclude, toMeetingRow } from "@/lib/meetings";
import type { CurrentUser } from "@/lib/session";

/** Meetings, captured emails and the user's connected accounts for a lead / client page. */
export async function loadRecordComms(user: CurrentUser, target: { leadId?: string; clientId?: string }) {
  const [meetings, emails, accounts] = await Promise.all([
    prisma.meeting.findMany({ where: target, include: meetingInclude, orderBy: { startAt: "asc" } }),
    prisma.emailMessage.findMany({ where: target, include: { user: { select: { name: true } } }, orderBy: { sentAt: "desc" }, take: 300 }),
    prisma.connectedAccount.findMany({ where: { userId: user.id }, select: { provider: true } }),
  ]);
  return {
    meetings: meetings.map((m) => toMeetingRow(m, user)),
    emails: emails.map((e) => ({
      id: e.id,
      threadId: e.threadId,
      subject: e.subject,
      snippet: e.snippet,
      bodyText: e.bodyText,
      fromEmail: e.fromEmail,
      fromName: e.fromName,
      toEmails: e.toEmails,
      ccEmails: e.ccEmails,
      sentAt: e.sentAt.toISOString(),
      direction: e.direction,
      mailbox: e.user.name,
    })),
    connected: { google: accounts.some((a) => a.provider === "GOOGLE"), microsoft: accounts.some((a) => a.provider === "MICROSOFT") },
  };
}
