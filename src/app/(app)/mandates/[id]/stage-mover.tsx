"use client";

import type { MandateStage } from "@prisma/client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button, ErrorText, Field, Select, Textarea } from "@/components/ui";
import { api } from "@/lib/api-client";
import { MANDATE_STAGE_LABELS } from "@/lib/labels";

/** Move the mandate to another allowed stage, with an optional (or required) note. */
export function StageMover({ mandateId, allowed, suggested }: { mandateId: string; allowed: MandateStage[]; suggested: MandateStage | null }) {
  const router = useRouter();
  const [to, setTo] = useState<MandateStage | "">(suggested ?? "");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const needsNote = to === "ON_HOLD" || to === "DROPPED";

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!to) return;
    setLoading(true);
    setError(null);
    try {
      await api(`/api/mandates/${mandateId}/stage`, "POST", { toStage: to, note });
      setNote("");
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  if (allowed.length === 0) return <p className="px-5 py-4 text-sm text-gray-500">This mandate is closed.</p>;
  return (
    <form onSubmit={submit} className="space-y-3 px-5 py-4" data-testid="stage-mover">
      <ErrorText>{error}</ErrorText>
      <Field label="Move to" htmlFor="sm-to">
        <Select
          id="sm-to"
          value={to}
          onChange={(e) => setTo(e.target.value as MandateStage)}
          placeholder="Choose a stage…"
          options={allowed.map((s) => ({ value: s, label: `${MANDATE_STAGE_LABELS[s]}${s === suggested ? " (next)" : ""}` }))}
        />
      </Field>
      <Field label={needsNote ? "Reason (required)" : "Note (optional)"} htmlFor="sm-note">
        <Textarea id="sm-note" rows={2} value={note} onChange={(e) => setNote(e.target.value)} required={needsNote} placeholder="e.g. Engagement letter signed on 12 Oct" />
      </Field>
      <div className="flex justify-end">
        <Button type="submit" loading={loading} disabled={!to} variant={to === "DROPPED" ? "danger" : "primary"}>
          Update stage
        </Button>
      </div>
    </form>
  );
}

/** Link the mandate to its IPO issue record (price band, lot size, dates). */
export function IpoLinker({ mandateId, current, options }: { mandateId: string; current: string | null; options: { value: string; label: string }[] }) {
  const router = useRouter();
  const [value, setValue] = useState(current ?? "");
  const [error, setError] = useState<string | null>(null);
  async function save() {
    setError(null);
    try {
      await api(`/api/mandates/${mandateId}`, "PATCH", { ipoId: value });
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    }
  }
  return (
    <div className="space-y-2">
      <ErrorText>{error}</ErrorText>
      <div className="flex gap-2">
        <Select aria-label="IPO issue" value={value} onChange={(e) => setValue(e.target.value)} options={options} placeholder="Not linked" />
        <Button type="button" variant="secondary" onClick={save} disabled={value === (current ?? "")}>
          Save
        </Button>
      </div>
    </div>
  );
}
