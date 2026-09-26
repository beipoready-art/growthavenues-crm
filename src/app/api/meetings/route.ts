import type { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { audit } from "@/lib/audit";
import { assertCanAccessParent } from "@/lib/interactions";
import { createCalendarEvent } from "@/lib/integrations/calendar";
import { IntegrationError } from "@/lib/integrations/oauth";
import { MEETING_PROVIDER_LABELS, meetingCreateSchema, meetingInclude, REQUIRED_ACCOUNT, toMeetingRow } from "@/lib/meetings";
import { prisma } from "@/lib/prisma";
import { handle, HttpError, requireApiUser } from "@/lib/session";

/** ?leadId= / ?clientId= for a record's meetings; otherwise the signed-in user's upcoming meetings. */
export async function GET(req: Request) {
  return handle(async () => {
    const user = await requireApiUser("leads:view");
    const sp = new URL(req.url).searchParams;
    const leadId = sp.get("leadId");
    const clientId = sp.get("clientId");
    let where: Prisma.MeetingWhereInput;
    if (leadId || clientId) {
      await assertCanAccessParent(user, { leadId, clientId });
      where = { leadId: leadId ?? undefined, clientId: clientId ?? undefined };
    } else {
      where = { organizerId: user.id, status: "SCHEDULED", endAt: { gte: new Date() } };
    }
    const meetings = await prisma.meeting.findMany({ where, include: meetingInclude, orderBy: { startAt: "asc" } });
    return NextResponse.json({ meetings: meetings.map((m) => toMeetingRow(m, user)) });
  });
}

export async function POST(req: Request) {
  return handle(async () => {
    const user = await requireApiUser("meetings:manage");
    const input = meetingCreateSchema.parse(await req.json());
    await assertCanAccessParent(user, input);
    if (input.mandateId && !(await prisma.mandate.findFirst({ where: { id: input.mandateId, clientId: input.clientId ?? "" } }))) {
      throw new HttpError(400, "That mandate belongs to another client");
    }
    const endAt = new Date(input.startAt.getTime() + input.durationMin * 60_000);
    const accounts = await prisma.connectedAccount.findMany({ where: { userId: user.id } });

    // Pick the calendar: the one the video provider needs, else any connected calendar.
    const needed = REQUIRED_ACCOUNT[input.provider];
    let account = needed ? accounts.find((a) => a.provider === needed) : accounts[0];
    if (needed && !account && !input.joinUrl) {
      throw new HttpError(400, `Connect your ${needed === "GOOGLE" ? "Google" : "Microsoft"} account under My account to create ${MEETING_PROVIDER_LABELS[input.provider]} links, or paste a link.`);
    }
    if (!input.addToCalendar) account = undefined;

    let externalEventId: string | null = null;
    let joinUrl = input.joinUrl;
    if (account) {
      try {
        const ev = await createCalendarEvent(account, {
          title: input.title,
          agenda: [input.agenda, joinUrl && !needed ? `Join: ${joinUrl}` : null].filter(Boolean).join("\n\n") || null,
          startAt: input.startAt,
          endAt,
          attendees: input.attendees,
          location: input.location,
          online: !!needed && !input.joinUrl,
        });
        externalEventId = ev.externalEventId;
        joinUrl = joinUrl ?? ev.joinUrl;
      } catch (err) {
        if (err instanceof IntegrationError) throw new HttpError(502, `Calendar: ${err.message}`);
        throw err;
      }
    }

    const meeting = await prisma.$transaction(async (tx) => {
      const m = await tx.meeting.create({
        data: {
          title: input.title,
          agenda: input.agenda,
          startAt: input.startAt,
          endAt,
          provider: input.provider,
          joinUrl,
          location: input.location,
          attendees: input.attendees,
          externalEventId,
          externalProvider: externalEventId ? account!.provider : null,
          leadId: input.leadId,
          clientId: input.clientId,
          mandateId: input.mandateId,
          organizerId: user.id,
        },
        include: meetingInclude,
      });
      await audit(tx, {
        entityType: input.clientId ? "Client" : "Lead",
        entityId: (input.clientId ?? input.leadId)!,
        action: "meeting_scheduled",
        userId: user.id,
        metadata: { meetingId: m.id, title: m.title, startAt: m.startAt.toISOString(), provider: m.provider },
      });
      return m;
    });
    return NextResponse.json({ meeting: toMeetingRow(meeting, user) }, { status: 201 });
  });
}
