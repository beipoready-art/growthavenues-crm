import type { ConnectedAccount } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { GOOGLE, MICROSOFT } from "./config";
import { apiFetch } from "./oauth";

export type CalendarEventInput = {
  title: string;
  agenda: string | null;
  startAt: Date;
  endAt: Date;
  attendees: { email: string; name?: string | null }[];
  location: string | null;
  /** Add a video meeting (Google Meet / Microsoft Teams) to the event. */
  online: boolean;
};

export type CreatedEvent = { externalEventId: string; joinUrl: string | null };

/** Creates an event in the organiser's calendar; the provider emails the invites. */
export async function createCalendarEvent(account: ConnectedAccount, e: CalendarEventInput): Promise<CreatedEvent> {
  if (account.provider === "GOOGLE") {
    const body = {
      summary: e.title,
      description: e.agenda ?? undefined,
      location: e.location ?? undefined,
      start: { dateTime: e.startAt.toISOString() },
      end: { dateTime: e.endAt.toISOString() },
      attendees: e.attendees.map((a) => ({ email: a.email, displayName: a.name ?? undefined })),
      ...(e.online ? { conferenceData: { createRequest: { requestId: randomUUID(), conferenceSolutionKey: { type: "hangoutsMeet" } } } } : {}),
    };
    const ev = await apiFetch<{ id: string; hangoutLink?: string; conferenceData?: { entryPoints?: { entryPointType: string; uri: string }[] } }>(
      account,
      `${GOOGLE.apiUrl()}/calendar/v3/calendars/primary/events?conferenceDataVersion=1&sendUpdates=all`,
      { method: "POST", body: JSON.stringify(body) },
    );
    const video = ev.hangoutLink ?? ev.conferenceData?.entryPoints?.find((p) => p.entryPointType === "video")?.uri ?? null;
    return { externalEventId: ev.id, joinUrl: video };
  }
  const body = {
    subject: e.title,
    body: { contentType: "text", content: e.agenda ?? "" },
    start: { dateTime: e.startAt.toISOString().replace("Z", ""), timeZone: "UTC" },
    end: { dateTime: e.endAt.toISOString().replace("Z", ""), timeZone: "UTC" },
    location: e.location ? { displayName: e.location } : undefined,
    attendees: e.attendees.map((a) => ({ emailAddress: { address: a.email, name: a.name ?? a.email }, type: "required" })),
    ...(e.online ? { isOnlineMeeting: true, onlineMeetingProvider: "teamsForBusiness" } : {}),
  };
  const ev = await apiFetch<{ id: string; onlineMeeting?: { joinUrl?: string } | null }>(account, `${MICROSOFT.graphUrl()}/me/events`, {
    method: "POST",
    body: JSON.stringify(body),
  });
  return { externalEventId: ev.id, joinUrl: ev.onlineMeeting?.joinUrl ?? null };
}

/** Cancels the event and notifies attendees. */
export async function cancelCalendarEvent(account: ConnectedAccount, externalEventId: string, comment?: string) {
  if (account.provider === "GOOGLE") {
    await apiFetch(account, `${GOOGLE.apiUrl()}/calendar/v3/calendars/primary/events/${encodeURIComponent(externalEventId)}?sendUpdates=all`, { method: "DELETE" });
    return;
  }
  await apiFetch(account, `${MICROSOFT.graphUrl()}/me/events/${encodeURIComponent(externalEventId)}/cancel`, {
    method: "POST",
    body: JSON.stringify({ comment: comment ?? "Meeting cancelled" }),
  });
}
