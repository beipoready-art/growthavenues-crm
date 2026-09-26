"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { LeadFormModal, type LeadFormValues } from "@/components/lead-form";
import { Button } from "@/components/ui";
import { api } from "@/lib/api-client";

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
      {editing && <LeadFormModal lead={lead} rms={rms} canAssign={permissions.assign} onClose={() => setEditing(false)} />}
    </>
  );
}
