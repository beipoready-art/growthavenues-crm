"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { LeadFormModal, type LeadFormValues } from "@/components/lead-form";
import { Button, ErrorText, Field, Input, Modal, Select } from "@/components/ui";
import { api } from "@/lib/api-client";
import { CLIENT_TYPE_LABELS, options } from "@/lib/labels";

export function LeadActions({
  lead,
  rms,
  permissions,
}: {
  lead: LeadFormValues & { id: string };
  rms: { id: string; name: string }[];
  permissions: { edit: boolean; assign: boolean; remove: boolean; convert: boolean };
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [converting, setConverting] = useState(false);

  async function remove() {
    if (!confirm(`Delete lead "${lead.name}"? This cannot be undone.`)) return;
    try {
      await api(`/api/leads/${lead.id}`, "DELETE");
      router.push("/leads");
      router.refresh();
    } catch (e) {
      alert((e as Error).message);
    }
  }

  return (
    <>
      {permissions.remove && (
        <Button variant="ghost" onClick={remove}>
          Delete
        </Button>
      )}
      {permissions.edit && (
        <Button variant="secondary" onClick={() => setEditing(true)}>
          Edit
        </Button>
      )}
      {permissions.convert && <Button onClick={() => setConverting(true)}>Convert to client</Button>}
      {converting && <ConvertModal lead={lead} onClose={() => setConverting(false)} />}
      {editing && <LeadFormModal lead={lead} rms={rms} canAssign={permissions.assign} onClose={() => setEditing(false)} />}
    </>
  );
}

function ConvertModal({ lead, onClose }: { lead: { id: string; name: string }; onClose: () => void }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const { client } = await api<{ client: { id: string } }>(`/api/leads/${lead.id}/convert`, "POST", Object.fromEntries(new FormData(e.currentTarget)));
      router.push(`/clients/${client.id}`);
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
      title={`Convert ${lead.name} to a client`}
      description="Creates a client record linked to this lead. The lead and its history are kept. KYC starts as Pending."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="convert-form" loading={loading}>
            Convert
          </Button>
        </>
      }
    >
      <form id="convert-form" onSubmit={onSubmit} className="space-y-3">
        <ErrorText>{error}</ErrorText>
        <Field label="Client type" htmlFor="cv-type">
          <Select id="cv-type" name="clientType" options={options(CLIENT_TYPE_LABELS)} defaultValue="INDIVIDUAL" />
        </Field>
        <Field label="PAN number" htmlFor="cv-pan" hint="Optional now, required before KYC can be submitted.">
          <Input id="cv-pan" name="panNumber" placeholder="ABCDE1234F" className="uppercase" maxLength={10} />
        </Field>
      </form>
    </Modal>
  );
}
