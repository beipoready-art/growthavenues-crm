import { NextResponse } from "next/server";
import { audit } from "@/lib/audit";
import { cancelCalendarEvent } from "@/lib/integrations/calendar";
import { loadMeetingForUser, meetingInclude, meetingUpdateSchema, toMeetingRow } from "@/lib/meetings";
import { prisma } from "@/lib/prisma";
import { handle, HttpError, requireApiUser } from "@/lib/session";

/** Complete (logs the outcome to the permanent interaction log) or cancel a meeting. */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const user = await requireApiUser("meetings:manage");
    const m = await loadMeetingForUser(user, (await params).id);
    if (user.role !== "ADMIN" && m.organizerId !== user.id) throw new HttpError(403, "Only the organiser or an admin can update this meeting");
    if (m.status !== "SCHEDULED") throw new HttpError(400, "This meeting is already closed");
    const input = meetingUpdateSchema.parse(await req.json());
    const parent = { entityType: m.clientId ? "Client" : "Lead", entityId: (m.clientId ?? m.leadId)! };

    if (input.action === "cancel") {
      if (m.externalEventId && m.externalProvider) {
        const account = await prisma.connectedAccount.findUnique({ where: { userId_provider: { userId: m.organizerId, provider: m.externalProvider } } });
        if (account) await cancelCalendarEvent(account, m.externalEventId, input.reason ?? undefined).catch(() => undefined);
      }
      const updated = await prisma.$transaction(async (tx) => {
        const u = await tx.meeting.update({ where: { id: m.id }, data: { status: "CANCELLED", outcome: input.reason }, include: meetingInclude });
        await audit(tx, { ...parent, action: "meeting_cancelled", userId: user.id, metadata: { meetingId: m.id, title: m.title, reason: input.reason } });
        return u;
      });
      return NextResponse.json({ meeting: toMeetingRow(updated, user) });
    }

    const updated = await prisma.$transaction(async (tx) => {
      const u = await tx.meeting.update({ where: { id: m.id }, data: { status: "COMPLETED", outcome: input.outcome }, include: meetingInclude });
      await tx.interaction.create({
        data: {
          type: "MEETING",
          occurredAt: m.startAt,
          summary: `${m.title}\n${input.outcome}`,
          clientId: m.clientId,
          leadId: m.leadId,
          loggedById: user.id,
        },
      });
      return u;
    });
    return NextResponse.json({ meeting: toMeetingRow(updated, user) });
  });
}
