"use client";

import type { MeetingProvider } from "@prisma/client";
import clsx from "clsx";
import { CalendarCheck, MapPin, Phone, Video } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Card, EmptyState } from "@/components/layout";
import { Badge, Button, ErrorText, Field, Input, Modal, Select, Textarea } from "@/components/ui";
import { api } from "@/lib/api-client";
import { formatDateTime } from "@/lib/format";
import type { MeetingRow } from "@/lib/meetings";

const PROVIDER_LABELS: Record<MeetingProvider, string> = {
  GOOGLE_MEET: "Google Meet",
  TEAMS: "Microsoft Teams",
  ZOOM: "Zoom (paste link)",
  PHONE: "Phone call",
  IN_PERSON: "In person",
  OTHER: "Other",
};

type ContactOption = { name: string; email: string | null };
type Parent = { leadId?: string; clientId?: string };

function nextSlot() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(11, 0, 0, 0);
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
}

export function MeetingList({ meetings, showRelated = false }: { meetings: MeetingRow[]; showRelated?: boolean }) {
  const router = useRouter();
  const [closing, setClosing] = useState<{ m: MeetingRow; action: "complete" | "cancel" } | null>(null);
  if (meetings.length === 0) return <EmptyState title="No meetings" />;
  return (
    <>
      <ul className="divide-y divide-gray-100" data-testid="meetings">
        {meetings.map((m) => {
          const Icon = m.provider === "PHONE" ? Phone : m.provider === "IN_PERSON" ? MapPin : Video;
          return (
            <li key={m.id} className="px-5 py-3" data-testid="meeting-row">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className={clsx("text-sm font-medium", m.status === "CANCELLED" ? "text-gray-400 line-through" : "text-gray-900")}>{m.title}</p>
                  <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-gray-500">
                    <span className="inline-flex items-center gap-1">
                      <Icon size={12} /> {PROVIDER_LABELS[m.provider].replace(" (paste link)", "")}
                    </span>
                    <span>{formatDateTime(m.startAt)}</span>
                    <span>· {m.organizer}</span>
                    {m.inCalendar && (
                      <span className="inline-flex items-center gap-0.5 text-emerald-700">
                        <CalendarCheck size={11} /> invite sent
                      </span>
                    )}
                    {showRelated && m.related && (
                      <Link href={`/${m.related.kind === "lead" ? "leads" : "clients"}/${m.related.id}`} className="text-brand-600 hover:underline">
                        {m.related.name}
                      </Link>
                    )}
                  </p>
                  {m.attendees.length > 0 && <p className="mt-0.5 truncate text-xs text-gray-500">With {m.attendees.map((a) => a.name || a.email).join(", ")}</p>}
                  {m.outcome && <p className="mt-1 whitespace-pre-wrap rounded bg-gray-50 px-2 py-1 text-xs text-gray-700">{m.outcome}</p>}
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  {m.status === "SCHEDULED" ? (
                    m.joinUrl ? (
                      <a href={m.joinUrl} target="_blank" rel="noreferrer" className="rounded-md bg-brand-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-brand-700" data-testid="join-link">
                        Join
                      </a>
                    ) : null
                  ) : (
                    <Badge tone={m.status === "COMPLETED" ? "green" : "gray"}>{m.status === "COMPLETED" ? "Completed" : "Cancelled"}</Badge>
                  )}
                  {m.status === "SCHEDULED" && m.canManage && (
                    <div className="flex gap-1 text-xs">
                      <button className="text-gray-500 hover:text-gray-900" onClick={() => setClosing({ m, action: "complete" })}>
                        Complete
                      </button>
                      <span className="text-gray-300">·</span>
                      <button className="text-red-600 hover:text-red-700" onClick={() => setClosing({ m, action: "cancel" })}>
                        Cancel
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ul>
      {closing && <CloseMeetingModal {...closing} onClose={() => setClosing(null)} onDone={() => router.refresh()} />}
    </>
  );
}

function CloseMeetingModal({ m, action, onClose, onDone }: { m: MeetingRow; action: "complete" | "cancel"; onClose: () => void; onDone: () => void }) {
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await api(`/api/meetings/${m.id}`, "PATCH", action === "complete" ? { action, outcome: text } : { action, reason: text });
      onClose();
      onDone();
    } catch (err) {
      setError((err as Error).message);
      setLoading(false);
    }
  }
  return (
    <Modal
      open
      onClose={onClose}
      title={action === "complete" ? "Meeting outcome" : "Cancel meeting"}
      description={action === "complete" ? "Saved to the interaction log as a permanent record." : m.inCalendar ? "Attendees get a cancellation from your calendar." : undefined}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Back
          </Button>
          <Button type="submit" form="close-meeting" variant={action === "cancel" ? "danger" : "primary"} loading={loading}>
            {action === "complete" ? "Save outcome" : "Cancel meeting"}
          </Button>
        </>
      }
    >
      <form id="close-meeting" onSubmit={submit} className="space-y-3">
        <ErrorText>{error}</ErrorText>
        <Field label={action === "complete" ? "What was discussed and agreed? Next steps?" : "Reason (optional)"} htmlFor="cm-text">
          <Textarea id="cm-text" value={text} onChange={(e) => setText(e.target.value)} rows={4} required={action === "complete"} minLength={action === "complete" ? 3 : undefined} />
        </Field>
      </form>
    </Modal>
  );
}

function ScheduleModal({
  parent,
  contacts,
  mandates,
  connected,
  onClose,
}: {
  parent: Parent;
  contacts: ContactOption[];
  mandates: { id: string; code: string; title: string }[];
  connected: { google: boolean; microsoft: boolean };
  onClose: () => void;
}) {
  const router = useRouter();
  const [provider, setProvider] = useState<MeetingProvider>(connected.google ? "GOOGLE_MEET" : connected.microsoft ? "TEAMS" : "ZOOM");
  const [selected, setSelected] = useState<Set<string>>(new Set(contacts.filter((c) => c.email).slice(0, 1).map((c) => c.email!)));
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const autoLink = (provider === "GOOGLE_MEET" && connected.google) || (provider === "TEAMS" && connected.microsoft);
  const needsLink = provider === "ZOOM" || provider === "OTHER" || ((provider === "GOOGLE_MEET" || provider === "TEAMS") && !autoLink);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const f = new FormData(e.currentTarget);
    const extra = String(f.get("extra") ?? "")
      .split(/[,\s]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    const attendees = [
      ...contacts.filter((c) => c.email && selected.has(c.email)).map((c) => ({ email: c.email!, name: c.name })),
      ...extra.map((email) => ({ email })),
    ];
    try {
      await api("/api/meetings", "POST", {
        ...parent,
        title: f.get("title"),
        agenda: f.get("agenda"),
        startAt: new Date(String(f.get("startAt"))).toISOString(),
        durationMin: Number(f.get("durationMin")),
        provider,
        attendees,
        location: f.get("location") ?? "",
        joinUrl: f.get("joinUrl") ?? "",
        mandateId: f.get("mandateId") ?? "",
        addToCalendar: f.get("addToCalendar") === "on",
      });
      onClose();
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
      setLoading(false);
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Schedule meeting"
      width="max-w-xl"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="schedule-meeting" loading={loading}>
            Schedule
          </Button>
        </>
      }
    >
      <form id="schedule-meeting" onSubmit={submit} className="grid grid-cols-6 gap-3">
        <div className="col-span-6">
          <ErrorText>{error}</ErrorText>
        </div>
        <div className="col-span-6">
          <Field label="Title" htmlFor="mt-title">
            <Input id="mt-title" name="title" defaultValue="IPO readiness discussion" required autoFocus />
          </Field>
        </div>
        <div className="col-span-3">
          <Field label="Starts" htmlFor="mt-start">
            <Input id="mt-start" name="startAt" type="datetime-local" defaultValue={nextSlot()} required />
          </Field>
        </div>
        <div className="col-span-3">
          <Field label="Duration" htmlFor="mt-duration">
            <Select id="mt-duration" name="durationMin" defaultValue="30" options={[15, 30, 45, 60, 90, 120].map((n) => ({ value: String(n), label: `${n} min` }))} />
          </Field>
        </div>
        <div className="col-span-6">
          <Field
            label="Where"
            htmlFor="mt-provider"
            hint={
              autoLink
                ? `A ${provider === "TEAMS" ? "Teams" : "Meet"} link is created in your calendar and invites are emailed to attendees.`
                : provider === "GOOGLE_MEET" || provider === "TEAMS"
                  ? `Connect your ${provider === "TEAMS" ? "Microsoft" : "Google"} account under My account to create links automatically, or paste one below.`
                  : undefined
            }
          >
            <Select id="mt-provider" value={provider} onChange={(e) => setProvider(e.target.value as MeetingProvider)} options={Object.entries(PROVIDER_LABELS).map(([value, label]) => ({ value, label }))} />
          </Field>
        </div>
        {needsLink && (
          <div className="col-span-6">
            <Field label="Meeting link" htmlFor="mt-link">
              <Input id="mt-link" name="joinUrl" type="url" placeholder="https://…" required={provider === "ZOOM"} />
            </Field>
          </div>
        )}
        {(provider === "IN_PERSON" || provider === "PHONE") && (
          <div className="col-span-6">
            <Field label={provider === "PHONE" ? "Dial-in / number" : "Location"} htmlFor="mt-location">
              <Input id="mt-location" name="location" />
            </Field>
          </div>
        )}
        <div className="col-span-6">
          <p className="mb-1.5 text-xs font-medium text-gray-700">Attendees</p>
          <div className="space-y-1">
            {contacts.filter((c) => c.email).length === 0 && <p className="text-xs text-gray-500">No contacts with an email yet — add emails below.</p>}
            {contacts
              .filter((c) => c.email)
              .map((c) => (
                <label key={c.email} className="flex items-center gap-2 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    className="rounded border-gray-300"
                    checked={selected.has(c.email!)}
                    onChange={(e) =>
                      setSelected((s) => {
                        const n = new Set(s);
                        if (e.target.checked) n.add(c.email!);
                        else n.delete(c.email!);
                        return n;
                      })
                    }
                  />
                  {c.name} <span className="text-xs text-gray-400">{c.email}</span>
                </label>
              ))}
          </div>
          <Input name="extra" aria-label="Other attendee emails" placeholder="Other emails (comma separated), e.g. your colleague" className="mt-2" />
        </div>
        {mandates.length > 0 && (
          <div className="col-span-6">
            <Field label="Mandate" htmlFor="mt-mandate">
              <Select id="mt-mandate" name="mandateId" options={mandates.map((m) => ({ value: m.id, label: `${m.code} · ${m.title}` }))} placeholder="Not linked" />
            </Field>
          </div>
        )}
        <div className="col-span-6">
          <Field label="Agenda" htmlFor="mt-agenda">
            <Textarea id="mt-agenda" name="agenda" rows={2} />
          </Field>
        </div>
        {(connected.google || connected.microsoft) && (
          <label className="col-span-6 flex items-center gap-2 text-sm text-gray-700">
            <input type="checkbox" name="addToCalendar" defaultChecked className="rounded border-gray-300" /> Add to my calendar and email invites
          </label>
        )}
      </form>
    </Modal>
  );
}

export function MeetingsCard({
  parent,
  meetings,
  contacts,
  mandates = [],
  connected,
  canSchedule,
}: {
  parent: Parent;
  meetings: MeetingRow[];
  contacts: ContactOption[];
  mandates?: { id: string; code: string; title: string }[];
  connected: { google: boolean; microsoft: boolean };
  canSchedule: boolean;
}) {
  const [open, setOpen] = useState(false);
  const now = Date.now();
  const upcoming = meetings.filter((m) => m.status === "SCHEDULED" && new Date(m.endAt).getTime() >= now);
  const past = meetings.filter((m) => !(m.status === "SCHEDULED" && new Date(m.endAt).getTime() >= now)).reverse();
  return (
    <Card
      title={`Meetings${upcoming.length ? ` · ${upcoming.length} upcoming` : ""}`}
      actions={
        canSchedule && (
          <Button size="sm" onClick={() => setOpen(true)}>
            + Schedule
          </Button>
        )
      }
    >
      {upcoming.length > 0 ? <MeetingList meetings={upcoming} /> : <EmptyState title="No upcoming meetings" />}
      {past.length > 0 && (
        <details className="border-t border-gray-100">
          <summary className="cursor-pointer px-5 py-2.5 text-xs font-medium text-gray-500 hover:text-gray-800">Past & cancelled ({past.length})</summary>
          <MeetingList meetings={past} />
        </details>
      )}
      {open && <ScheduleModal parent={parent} contacts={contacts} mandates={mandates} connected={connected} onClose={() => setOpen(false)} />}
    </Card>
  );
}
