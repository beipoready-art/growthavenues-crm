"use client";

import type { InteractionType } from "@prisma/client";
import clsx from "clsx";
import { Mail, MessageCircle, Phone, StickyNote, Users, type LucideIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Card, EmptyState } from "@/components/layout";
import { Button, ErrorText, Field, Input, Modal, Select, Textarea } from "@/components/ui";
import { api } from "@/lib/api-client";
import { formatDateTime } from "@/lib/format";
import type { TimelineEntry } from "@/lib/interactions";
import { INTERACTION_TYPE_LABELS, options } from "@/lib/labels";

const ICONS: Record<InteractionType, LucideIcon> = { CALL: Phone, EMAIL: Mail, MEETING: Users, WHATSAPP: MessageCircle, NOTE: StickyNote };
const ICON_STYLE: Record<InteractionType, string> = {
  CALL: "bg-blue-50 text-blue-600",
  EMAIL: "bg-violet-50 text-violet-600",
  MEETING: "bg-amber-50 text-amber-700",
  WHATSAPP: "bg-emerald-50 text-emerald-600",
  NOTE: "bg-gray-100 text-gray-600",
};
const TYPES = Object.keys(INTERACTION_TYPE_LABELS) as InteractionType[];

/** Local "now" formatted for <input type="datetime-local">. */
function nowLocal() {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
}
function toLocalInput(iso: string) {
  const d = new Date(iso);
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
}

export function InteractionLog({
  target,
  entries,
  canLog,
  canAmend,
}: {
  target: { leadId?: string; clientId?: string };
  entries: TimelineEntry[];
  canLog: boolean;
  canAmend: boolean;
}) {
  const router = useRouter();
  const [filter, setFilter] = useState<InteractionType | "">("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [amend, setAmend] = useState<{ entry: TimelineEntry; mode: "edit" | "delete" } | null>(null);
  const [formKey, setFormKey] = useState(0);

  const visible = filter ? entries.filter((e) => e.type === filter) : entries;
  const counts = Object.fromEntries(TYPES.map((t) => [t, entries.filter((e) => e.type === t).length]));

  async function onLog(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const f = new FormData(e.currentTarget);
    try {
      await api("/api/interactions", "POST", {
        ...target,
        type: f.get("type"),
        occurredAt: new Date(String(f.get("occurredAt"))).toISOString(),
        summary: f.get("summary"),
      });
      setFormKey((k) => k + 1);
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card title="Interaction log" actions={<span className="text-xs text-gray-400">Permanent record</span>}>
      {canLog && (
        <form key={formKey} onSubmit={onLog} className="space-y-2 border-b border-gray-100 px-5 py-4" data-testid="log-interaction">
          <ErrorText>{error}</ErrorText>
          <div className="grid grid-cols-2 gap-2">
            <Select name="type" aria-label="Interaction type" options={options(INTERACTION_TYPE_LABELS)} defaultValue="CALL" />
            <Input name="occurredAt" aria-label="When" type="datetime-local" defaultValue={nowLocal()} max={nowLocal()} required />
          </div>
          <Textarea name="summary" aria-label="Summary" placeholder="What was discussed? Outcome and next step…" required minLength={3} rows={2} />
          <div className="flex items-center justify-between">
            <p className="text-xs text-gray-400">Logged as you. Entries can’t be deleted.</p>
            <Button type="submit" size="sm" loading={saving}>
              Log interaction
            </Button>
          </div>
        </form>
      )}

      <div className="flex flex-wrap gap-1.5 border-b border-gray-100 px-5 py-2.5" role="group" aria-label="Filter by type">
        {[["", "All", entries.length] as const, ...TYPES.map((t) => [t, INTERACTION_TYPE_LABELS[t], counts[t]] as const)].map(([value, label, n]) => (
          <button
            key={value || "all"}
            onClick={() => setFilter(value as InteractionType | "")}
            aria-pressed={filter === value}
            className={clsx(
              "rounded-full px-2.5 py-1 text-xs font-medium transition-colors",
              filter === value ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200",
            )}
          >
            {label} <span className="opacity-60">{n}</span>
          </button>
        ))}
      </div>

      {visible.length === 0 ? (
        <EmptyState title={filter ? `No ${INTERACTION_TYPE_LABELS[filter].toLowerCase()} entries` : "No interactions logged yet"} />
      ) : (
        <ol className="space-y-4 px-5 py-4" data-testid="timeline">
          {visible.map((e) => {
            const Icon = ICONS[e.type];
            return (
              <li key={e.id} className="flex gap-3" data-testid="timeline-entry">
                <span className={clsx("mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full", e.deletedAt ? "bg-gray-100 text-gray-400" : ICON_STYLE[e.type])}>
                  <Icon size={14} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline gap-x-2 text-xs text-gray-500">
                    <span className="font-medium text-gray-900">{INTERACTION_TYPE_LABELS[e.type]}</span>
                    <span>{formatDateTime(e.occurredAt)}</span>
                    <span>· logged by {e.loggedBy}</span>
                    {e.fromLead && <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] uppercase tracking-wide">lead stage</span>}
                  </div>
                  {e.deletedAt ? (
                    <div className="mt-1 rounded-md border border-dashed border-gray-200 px-2.5 py-1.5 text-xs text-gray-500">
                      Removed by {e.deletedBy} on {formatDateTime(e.deletedAt)} — reason: {e.deleteReason}
                      {e.summary && <p className="mt-1 whitespace-pre-wrap text-gray-400 line-through">{e.summary}</p>}
                    </div>
                  ) : (
                    <p className="mt-0.5 whitespace-pre-wrap text-sm text-gray-800">{e.summary}</p>
                  )}
                  {e.editedAt && !e.deletedAt && (
                    <details className="mt-1 text-xs text-gray-500">
                      <summary className="cursor-pointer hover:text-gray-700">
                        Edited by {e.editedBy} on {formatDateTime(e.editedAt)} · {e.revisions.length} earlier version(s)
                      </summary>
                      <ul className="mt-1 space-y-1.5 border-l-2 border-gray-100 pl-3">
                        {e.revisions.map((r) => (
                          <li key={r.id}>
                            <p className="text-gray-400">
                              Before edit by {r.editedBy}, {formatDateTime(r.createdAt)} — reason: {r.reason}
                            </p>
                            <p className="whitespace-pre-wrap text-gray-600">
                              [{INTERACTION_TYPE_LABELS[r.previousType]}, {formatDateTime(r.previousOccurredAt)}] {r.previousSummary}
                            </p>
                          </li>
                        ))}
                      </ul>
                    </details>
                  )}
                  {canAmend && !e.deletedAt && (
                    <div className="mt-1 flex gap-2 text-xs">
                      <button className="text-gray-500 hover:text-gray-900" onClick={() => setAmend({ entry: e, mode: "edit" })}>
                        Edit
                      </button>
                      <button className="text-red-600 hover:text-red-700" onClick={() => setAmend({ entry: e, mode: "delete" })}>
                        Remove
                      </button>
                    </div>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      )}
      {amend && <AmendModal entry={amend.entry} mode={amend.mode} onClose={() => setAmend(null)} />}
    </Card>
  );
}

function AmendModal({ entry, mode, onClose }: { entry: TimelineEntry; mode: "edit" | "delete"; onClose: () => void }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const f = new FormData(e.currentTarget);
    try {
      if (mode === "edit") {
        await api(`/api/interactions/${entry.id}`, "PATCH", {
          type: f.get("type"),
          occurredAt: new Date(String(f.get("occurredAt"))).toISOString(),
          summary: f.get("summary"),
          reason: f.get("reason"),
        });
      } else {
        await api(`/api/interactions/${entry.id}`, "DELETE", { reason: f.get("reason") });
      }
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
      title={mode === "edit" ? "Edit interaction" : "Remove interaction"}
      description={
        mode === "edit"
          ? "The original text is kept in the entry's history."
          : "The entry stays in the log, marked as removed with your reason. Compliance can still read it."
      }
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="amend-interaction" variant={mode === "delete" ? "danger" : "primary"} loading={loading}>
            {mode === "edit" ? "Save edit" : "Remove"}
          </Button>
        </>
      }
    >
      <form id="amend-interaction" onSubmit={onSubmit} className="space-y-3">
        <ErrorText>{error}</ErrorText>
        {mode === "edit" && (
          <>
            <div className="grid grid-cols-2 gap-2">
              <Field label="Type" htmlFor="am-type">
                <Select id="am-type" name="type" options={options(INTERACTION_TYPE_LABELS)} defaultValue={entry.type} />
              </Field>
              <Field label="When" htmlFor="am-when">
                <Input id="am-when" name="occurredAt" type="datetime-local" defaultValue={toLocalInput(entry.occurredAt)} required />
              </Field>
            </div>
            <Field label="Summary" htmlFor="am-summary">
              <Textarea id="am-summary" name="summary" defaultValue={entry.summary ?? ""} required />
            </Field>
          </>
        )}
        <Field label="Reason (required)" htmlFor="am-reason">
          <Textarea id="am-reason" name="reason" required minLength={5} rows={2} />
        </Field>
      </form>
    </Modal>
  );
}
