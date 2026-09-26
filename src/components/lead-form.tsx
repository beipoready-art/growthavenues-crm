"use client";

import type { LeadSource, LeadStatus, ServiceLine } from "@prisma/client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button, ErrorText, Field, Input, Modal, Select, Textarea } from "@/components/ui";
import { api } from "@/lib/api-client";
import { LEAD_SOURCE_LABELS, LEAD_STATUS_LABELS, options, SERVICE_LABELS } from "@/lib/labels";

export type LeadFormValues = {
  id?: string;
  companyName: string;
  name: string;
  designation: string | null;
  phone: string;
  email: string | null;
  city: string | null;
  sector: string | null;
  serviceInterest: ServiceLine | null;
  revenueCr: number | null;
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
      title={lead?.id ? "Edit enquiry" : "New company enquiry"}
      width="max-w-xl"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="lead-form" loading={loading}>
            {lead?.id ? "Save changes" : "Create enquiry"}
          </Button>
        </>
      }
    >
      <form id="lead-form" onSubmit={onSubmit} className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <ErrorText>{error}</ErrorText>
        </div>
        <div className="col-span-2">
          <Field label="Company name" htmlFor="lf-company">
            <Input id="lf-company" name="companyName" defaultValue={lead?.companyName} placeholder="Sahyadri Renewables Pvt Ltd" required autoFocus />
          </Field>
        </div>
        <Field label="Contact person" htmlFor="lf-name">
          <Input id="lf-name" name="name" defaultValue={lead?.name} required />
        </Field>
        <Field label="Designation" htmlFor="lf-designation">
          <Input id="lf-designation" name="designation" defaultValue={lead?.designation ?? ""} placeholder="Promoter & MD, CFO…" />
        </Field>
        <Field label="Phone" htmlFor="lf-phone">
          <Input id="lf-phone" name="phone" defaultValue={lead?.phone} placeholder="+91 98xxx xxxxx" required />
        </Field>
        <Field label="Email" htmlFor="lf-email">
          <Input id="lf-email" name="email" type="email" defaultValue={lead?.email ?? ""} />
        </Field>
        <Field label="Sector" htmlFor="lf-sector">
          <Input id="lf-sector" name="sector" defaultValue={lead?.sector ?? ""} placeholder="Manufacturing, EV, FMCG…" />
        </Field>
        <Field label="City" htmlFor="lf-city">
          <Input id="lf-city" name="city" defaultValue={lead?.city ?? ""} />
        </Field>
        <Field label="Service interested in" htmlFor="lf-service">
          <Select id="lf-service" name="serviceInterest" options={options(SERVICE_LABELS)} placeholder="Not sure yet" defaultValue={lead?.serviceInterest ?? ""} />
        </Field>
        <Field label="Annual revenue (₹ Cr)" htmlFor="lf-revenue">
          <Input id="lf-revenue" name="revenueCr" type="number" step="0.01" defaultValue={lead?.revenueCr ?? ""} placeholder="e.g. 45" />
        </Field>
        <Field label="Source" htmlFor="lf-source">
          <Select id="lf-source" name="source" options={options(LEAD_SOURCE_LABELS)} defaultValue={lead?.source ?? "WEBSITE"} />
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
      <Button onClick={() => setOpen(true)}>+ New enquiry</Button>
      {open && <LeadFormModal rms={rms} canAssign={canAssign} onClose={() => setOpen(false)} />}
    </>
  );
}
