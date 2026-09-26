"use client";

import type { ClientType, LeadSource } from "@prisma/client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button, ErrorText, Field, Input, Modal, Select, Textarea } from "@/components/ui";
import { api } from "@/lib/api-client";
import { CLIENT_TYPE_LABELS, LEAD_SOURCE_LABELS, options } from "@/lib/labels";

type ClientValues = {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  source: LeadSource;
  panNumber: string | null;
  clientType: ClientType;
  notes: string | null;
  assignedRmId: string | null;
};

export function ClientActions({
  client,
  rms,
  canAssign,
  panLocked,
}: {
  client: ClientValues;
  rms: { id: string; name: string }[];
  canAssign: boolean;
  panLocked: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const body = Object.fromEntries(new FormData(e.currentTarget));
    if (panLocked) delete body.panNumber;
    try {
      await api(`/api/clients/${client.id}`, "PATCH", body);
      setOpen(false);
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Button variant="secondary" onClick={() => setOpen(true)}>
        Edit client
      </Button>
      {open && (
        <Modal
          open
          onClose={() => setOpen(false)}
          title="Edit client"
          footer={
            <>
              <Button variant="secondary" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" form="client-form" loading={loading}>
                Save changes
              </Button>
            </>
          }
        >
          <form id="client-form" onSubmit={onSubmit} className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <ErrorText>{error}</ErrorText>
            </div>
            <div className="col-span-2">
              <Field label="Full name / entity name" htmlFor="cf-name">
                <Input id="cf-name" name="name" defaultValue={client.name} required />
              </Field>
            </div>
            <Field label="Phone" htmlFor="cf-phone">
              <Input id="cf-phone" name="phone" defaultValue={client.phone} required />
            </Field>
            <Field label="Email" htmlFor="cf-email">
              <Input id="cf-email" name="email" type="email" defaultValue={client.email ?? ""} />
            </Field>
            <Field label="PAN number" htmlFor="cf-pan" hint={panLocked ? "Locked while KYC is in review or verified." : undefined}>
              <Input id="cf-pan" name="panNumber" defaultValue={client.panNumber ?? ""} className="uppercase" maxLength={10} disabled={panLocked} />
            </Field>
            <Field label="Client type" htmlFor="cf-type">
              <Select id="cf-type" name="clientType" options={options(CLIENT_TYPE_LABELS)} defaultValue={client.clientType} />
            </Field>
            <Field label="Source" htmlFor="cf-source">
              <Select id="cf-source" name="source" options={options(LEAD_SOURCE_LABELS)} defaultValue={client.source} />
            </Field>
            {canAssign && (
              <Field label="Assigned RM" htmlFor="cf-rm">
                <Select id="cf-rm" name="assignedRmId" options={rms.map((r) => ({ value: r.id, label: r.name }))} placeholder="Unassigned" defaultValue={client.assignedRmId ?? ""} />
              </Field>
            )}
            <div className="col-span-2">
              <Field label="Notes" htmlFor="cf-notes">
                <Textarea id="cf-notes" name="notes" defaultValue={client.notes ?? ""} />
              </Field>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
