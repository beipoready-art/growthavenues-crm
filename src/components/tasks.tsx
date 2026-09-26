"use client";

import type { TaskPriority } from "@prisma/client";
import clsx from "clsx";
import { Check } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { EmptyState } from "@/components/layout";
import { Badge, Button, ErrorText, Field, Input, Modal, Select, Textarea } from "@/components/ui";
import { api } from "@/lib/api-client";
import { formatDateTime } from "@/lib/format";
import { options, TASK_PRIORITY_LABELS, TASK_PRIORITY_TONE } from "@/lib/labels";
import type { TaskRow } from "@/lib/tasks";

type Option = { value: string; label: string };
export type RelatedOption = { value: string; label: string; group: "Leads" | "Clients" };

function toLocalInput(d: Date) {
  const x = new Date(d);
  x.setMinutes(x.getMinutes() - x.getTimezoneOffset());
  return x.toISOString().slice(0, 16);
}
function tomorrowAt10() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(10, 0, 0, 0);
  return toLocalInput(d);
}

export function TaskList({
  tasks,
  showRelated = true,
  showAssignee = false,
  assignees = [],
  emptyTitle = "No tasks",
  tone,
}: {
  tasks: TaskRow[];
  showRelated?: boolean;
  showAssignee?: boolean;
  assignees?: Option[];
  emptyTitle?: string;
  tone?: "overdue";
}) {
  const router = useRouter();
  const [editing, setEditing] = useState<TaskRow | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  async function toggle(t: TaskRow) {
    setBusy(t.id);
    try {
      await api(`/api/tasks/${t.id}`, "PATCH", { status: t.status === "OPEN" ? "DONE" : "OPEN" });
      router.refresh();
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  if (tasks.length === 0) return <EmptyState title={emptyTitle} />;
  return (
    <>
      <ul className="divide-y divide-gray-100">
        {tasks.map((t) => (
          <li key={t.id} className="flex items-start gap-3 px-5 py-3" data-testid="task-row">
            <button
              onClick={() => toggle(t)}
              disabled={!t.canEdit || busy === t.id}
              aria-label={t.status === "OPEN" ? `Complete ${t.title}` : `Reopen ${t.title}`}
              className={clsx(
                "mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors",
                t.status === "DONE" ? "border-emerald-500 bg-emerald-500 text-white" : "border-gray-300 hover:border-brand-500",
              )}
            >
              {t.status === "DONE" && <Check size={12} strokeWidth={3} />}
            </button>
            <div className="min-w-0 flex-1">
              <p className={clsx("text-sm font-medium", t.status === "DONE" ? "text-gray-400 line-through" : "text-gray-900")}>{t.title}</p>
              <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-gray-500">
                <span className={clsx(tone === "overdue" && t.status === "OPEN" && "font-medium text-red-600")}>Due {formatDateTime(t.dueAt)}</span>
                {showRelated && t.related && (
                  <Link href={`/${t.related.kind === "lead" ? "leads" : "clients"}/${t.related.id}`} className="text-brand-600 hover:underline">
                    {t.related.kind === "lead" ? "Lead" : "Client"}: {t.related.name}
                  </Link>
                )}
                {showAssignee && <span>· {t.assignedTo.name}</span>}
              </p>
              {t.description && <p className="mt-1 whitespace-pre-wrap text-xs text-gray-600">{t.description}</p>}
            </div>
            <Badge tone={TASK_PRIORITY_TONE[t.priority]}>{TASK_PRIORITY_LABELS[t.priority]}</Badge>
            {t.canEdit && (
              <Button size="sm" variant="ghost" onClick={() => setEditing(t)}>
                Edit
              </Button>
            )}
          </li>
        ))}
      </ul>
      {editing && <TaskFormModal task={editing} assignees={assignees} onClose={() => setEditing(null)} />}
    </>
  );
}

export function TaskFormModal({
  task,
  target,
  relatedOptions,
  assignees = [],
  onClose,
}: {
  task?: TaskRow;
  target?: { leadId?: string; clientId?: string };
  relatedOptions?: RelatedOption[];
  assignees?: Option[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const f = new FormData(e.currentTarget);
    const body: Record<string, unknown> = {
      title: f.get("title"),
      description: f.get("description"),
      dueAt: new Date(String(f.get("dueAt"))).toISOString(),
      priority: f.get("priority"),
    };
    if (f.get("assignedToId")) body.assignedToId = f.get("assignedToId");
    try {
      if (task) {
        await api(`/api/tasks/${task.id}`, "PATCH", body);
      } else {
        const related = String(f.get("related") ?? "");
        const [kind, id] = related.split(":");
        const parent = target ?? (kind === "lead" ? { leadId: id } : kind === "client" ? { clientId: id } : {});
        await api("/api/tasks", "POST", { ...body, ...parent });
      }
      onClose();
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
      setLoading(false);
    }
  }

  async function remove() {
    if (!task || !confirm(`Delete task "${task.title}"?`)) return;
    try {
      await api(`/api/tasks/${task.id}`, "DELETE");
      onClose();
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={task ? "Edit task" : "New follow-up task"}
      footer={
        <>
          {task && (
            <Button variant="ghost" className="mr-auto text-red-600" onClick={remove}>
              Delete
            </Button>
          )}
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="task-form" loading={loading}>
            {task ? "Save" : "Create task"}
          </Button>
        </>
      }
    >
      <form id="task-form" onSubmit={onSubmit} className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <ErrorText>{error}</ErrorText>
        </div>
        <div className="col-span-2">
          <Field label="Task" htmlFor="tf-title">
            <Input id="tf-title" name="title" defaultValue={task?.title} placeholder="Call back about Kaveri Fintech IPO" required minLength={3} autoFocus />
          </Field>
        </div>
        {!task && !target && relatedOptions && (
          <div className="col-span-2">
            <Field label="Related to" htmlFor="tf-related">
              <select id="tf-related" name="related" required className="block h-9 w-full rounded-md border border-gray-200 bg-white px-3 text-sm shadow-sm">
                <option value="">Choose a lead or client…</option>
                {(["Clients", "Leads"] as const).map((g) => (
                  <optgroup key={g} label={g}>
                    {relatedOptions
                      .filter((o) => o.group === g)
                      .map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                  </optgroup>
                ))}
              </select>
            </Field>
          </div>
        )}
        <Field label="Due" htmlFor="tf-due">
          <Input id="tf-due" name="dueAt" type="datetime-local" defaultValue={task ? toLocalInput(new Date(task.dueAt)) : tomorrowAt10()} required />
        </Field>
        <Field label="Priority" htmlFor="tf-priority">
          <Select id="tf-priority" name="priority" options={options(TASK_PRIORITY_LABELS)} defaultValue={(task?.priority ?? "MEDIUM") as TaskPriority} />
        </Field>
        {assignees.length > 0 && (
          <div className="col-span-2">
            <Field label="Assign to" htmlFor="tf-assignee">
              <Select id="tf-assignee" name="assignedToId" options={assignees} defaultValue={task?.assignedTo.id} placeholder="Me" />
            </Field>
          </div>
        )}
        <div className="col-span-2">
          <Field label="Details" htmlFor="tf-desc">
            <Textarea id="tf-desc" name="description" defaultValue={task?.description ?? ""} rows={2} />
          </Field>
        </div>
      </form>
    </Modal>
  );
}

export function NewTaskButton(props: { target?: { leadId?: string; clientId?: string }; relatedOptions?: RelatedOption[]; assignees?: Option[]; size?: "sm" | "md" }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button size={props.size ?? "sm"} onClick={() => setOpen(true)}>
        + Add task
      </Button>
      {open && <TaskFormModal target={props.target} relatedOptions={props.relatedOptions} assignees={props.assignees} onClose={() => setOpen(false)} />}
    </>
  );
}
