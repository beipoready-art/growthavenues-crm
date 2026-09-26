"use client";

import type { LeadSource, LeadStatus } from "@prisma/client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button, ErrorText, Field, Input, Modal, Select, Textarea } from "@/components/ui";
import { api } from "@/lib/api-client";
import { LEAD_SOURCE_LABELS, LEAD_STATUS_LABELS, options } from "@/lib/labels";

export type LeadFormValues = {
  id?: string;
  name: string;
  phone: string;
  email: string | null;
  source: LeadSource;
  status: LeadStatus;
  notes: string | null;
  assignedRmId: string | null;
};

const statusOptions = options(LEAD_STATUS_LABELS).filter((o) => o.value !== "CONVERTED");

export function LeadFormModal({
  lead,
  rms,
  canAssign,
  onClose,
}: {
  lead?: LeadFormValues;
  rms: { id: string; name: string }[];
  canAssign: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const body = Object.fromEntries(new FormData(e.currentTarget));
    try {
      if (lead?.id) {
        await api(`/api/leads/${lead.id}`, "PATCH", body);
        router.refresh();
      } else {
        const { lead: created } = await api<{ lead: { id: string } }>("/api/leads", "POST", body);
        router.push(`/leads/${created.id}`);
      }
      onClose();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={lead?.id ? "Edit lead" : "New lead"}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="lead-form" loading={loading}>
            {lead?.id ? "Save changes" : "Create lead"}
          </Button>
        </>
      }
    >
      <form id="lead-form" onSubmit={onSubmit} className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <ErrorText>{error}</ErrorText>
        </div>
        <div className="col-span-2">
          <Field label="Full name" htmlFor="lf-name">
            <Input id="lf-name" name="name" defaultValue={lead?.name} required autoFocus />
          </Field>
        </div>
        <Field label="Phone" htmlFor="lf-phone">
          <Input id="lf-phone" name="phone" defaultValue={lead?.phone} placeholder="+91 98xxx xxxxx" required />
        </Field>
        <Field label="Email" htmlFor="lf-email">
          <Input id="lf-email" name="email" type="email" defaultValue={lead?.email ?? ""} />
        </Field>
        <Field label="Source" htmlFor="lf-source">
          <Select id="lf-source" name="source" options={options(LEAD_SOURCE_LABELS)} defaultValue={lead?.source ?? "REFERRAL"} />
        </Field>
        <Field label="Status" htmlFor="lf-status">
          <Select id="lf-status" name="status" options={statusOptions} defaultValue={lead?.status ?? "NEW"} />
        </Field>
        {canAssign && (
          <div className="col-span-2">
            <Field label="Assigned RM" htmlFor="lf-rm">
              <Select
                id="lf-rm"
                name="assignedRmId"
                options={rms.map((r) => ({ value: r.id, label: r.name }))}
                placeholder="Unassigned"
                defaultValue={lead?.assignedRmId ?? ""}
              />
            </Field>
          </div>
        )}
        <div className="col-span-2">
          <Field label="Notes" htmlFor="lf-notes">
            <Textarea id="lf-notes" name="notes" defaultValue={lead?.notes ?? ""} />
          </Field>
        </div>
      </form>
    </Modal>
  );
}

export function NewLeadButton({ rms, canAssign }: { rms: { id: string; name: string }[]; canAssign: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button onClick={() => setOpen(true)}>+ New lead</Button>
      {open && <LeadFormModal rms={rms} canAssign={canAssign} onClose={() => setOpen(false)} />}
    </>
  );
}
