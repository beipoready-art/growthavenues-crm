"use client";

import type { EntityType, LeadSource } from "@prisma/client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button, ErrorText, Field, Input, Modal, Select, Textarea } from "@/components/ui";
import { api } from "@/lib/api-client";
import { ENTITY_TYPE_LABELS, LEAD_SOURCE_LABELS, options } from "@/lib/labels";

export type ClientValues = {
  id: string;
  name: string;
  cin: string | null;
  panNumber: string | null;
  gstin: string | null;
  entityType: EntityType;
  sector: string | null;
  incorporationYear: number | null;
  city: string | null;
  state: string | null;
  website: string | null;
  phone: string | null;
  email: string | null;
  source: LeadSource;
  financialYear: string | null;
  revenueCr: number | null;
  ebitdaCr: number | null;
  patCr: number | null;
  netWorthCr: number | null;
  notes: string | null;
  assignedRmId: string | null;
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <fieldset className="col-span-6 grid grid-cols-6 gap-3">
      <legend className="col-span-6 mb-1 text-[11px] font-semibold uppercase tracking-wider text-gray-400">{title}</legend>
      {children}
    </fieldset>
  );
}

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

  const v = (x: string | number | null) => (x == null ? "" : String(x));

  return (
    <>
      <Button variant="secondary" onClick={() => setOpen(true)}>
        Edit company
      </Button>
      {open && (
        <Modal
          open
          onClose={() => setOpen(false)}
          title="Edit company"
          width="max-w-2xl"
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
          <form id="client-form" onSubmit={onSubmit} className="grid max-h-[65vh] grid-cols-6 gap-3 overflow-y-auto pr-1">
            <div className="col-span-6">
              <ErrorText>{error}</ErrorText>
            </div>
            <Section title="Company">
              <div className="col-span-4">
                <Field label="Registered name" htmlFor="cf-name">
                  <Input id="cf-name" name="name" defaultValue={client.name} required />
                </Field>
              </div>
              <div className="col-span-2">
                <Field label="Entity type" htmlFor="cf-type">
                  <Select id="cf-type" name="entityType" options={options(ENTITY_TYPE_LABELS)} defaultValue={client.entityType} />
                </Field>
              </div>
              <div className="col-span-2">
                <Field label="Sector" htmlFor="cf-sector">
                  <Input id="cf-sector" name="sector" defaultValue={v(client.sector)} />
                </Field>
              </div>
              <div className="col-span-2">
                <Field label="Incorporated (year)" htmlFor="cf-year">
                  <Input id="cf-year" name="incorporationYear" type="number" defaultValue={v(client.incorporationYear)} />
                </Field>
              </div>
              <div className="col-span-2">
                <Field label="Source" htmlFor="cf-source">
                  <Select id="cf-source" name="source" options={options(LEAD_SOURCE_LABELS)} defaultValue={client.source} />
                </Field>
              </div>
              <div className="col-span-2">
                <Field label="City" htmlFor="cf-city">
                  <Input id="cf-city" name="city" defaultValue={v(client.city)} />
                </Field>
              </div>
              <div className="col-span-2">
                <Field label="State" htmlFor="cf-state">
                  <Input id="cf-state" name="state" defaultValue={v(client.state)} />
                </Field>
              </div>
              <div className="col-span-2">
                <Field label="Website" htmlFor="cf-website">
                  <Input id="cf-website" name="website" defaultValue={v(client.website)} />
                </Field>
              </div>
              <div className="col-span-3">
                <Field label="Company phone" htmlFor="cf-phone">
                  <Input id="cf-phone" name="phone" defaultValue={v(client.phone)} />
                </Field>
              </div>
              <div className="col-span-3">
                <Field label="Company email" htmlFor="cf-email">
                  <Input id="cf-email" name="email" type="email" defaultValue={v(client.email)} />
                </Field>
              </div>
            </Section>
            <Section title="Identifiers">
              <div className="col-span-3">
                <Field label="CIN" htmlFor="cf-cin">
                  <Input id="cf-cin" name="cin" defaultValue={v(client.cin)} className="uppercase" maxLength={21} />
                </Field>
              </div>
              <div className="col-span-3">
                <Field label="GSTIN" htmlFor="cf-gstin">
                  <Input id="cf-gstin" name="gstin" defaultValue={v(client.gstin)} className="uppercase" maxLength={15} />
                </Field>
              </div>
              <div className="col-span-3">
                <Field label="Company PAN" htmlFor="cf-pan" hint={panLocked ? "Locked while KYC is in review or verified." : undefined}>
                  <Input id="cf-pan" name="panNumber" defaultValue={v(client.panNumber)} className="uppercase" maxLength={10} disabled={panLocked} />
                </Field>
              </div>
              {canAssign && (
                <div className="col-span-3">
                  <Field label="Assigned RM" htmlFor="cf-rm">
                    <Select id="cf-rm" name="assignedRmId" options={rms.map((r) => ({ value: r.id, label: r.name }))} placeholder="Unassigned" defaultValue={client.assignedRmId ?? ""} />
                  </Field>
                </div>
              )}
            </Section>
            <Section title="Latest financials (₹ crore)">
              <div className="col-span-2">
                <Field label="Financial year" htmlFor="cf-fy">
                  <Input id="cf-fy" name="financialYear" defaultValue={v(client.financialYear)} placeholder="FY2025-26" />
                </Field>
              </div>
              <div className="col-span-2">
                <Field label="Revenue" htmlFor="cf-rev">
                  <Input id="cf-rev" name="revenueCr" type="number" step="0.01" defaultValue={v(client.revenueCr)} />
                </Field>
              </div>
              <div className="col-span-2">
                <Field label="EBITDA" htmlFor="cf-ebitda">
                  <Input id="cf-ebitda" name="ebitdaCr" type="number" step="0.01" defaultValue={v(client.ebitdaCr)} />
                </Field>
              </div>
              <div className="col-span-3">
                <Field label="PAT" htmlFor="cf-pat">
                  <Input id="cf-pat" name="patCr" type="number" step="0.01" defaultValue={v(client.patCr)} />
                </Field>
              </div>
              <div className="col-span-3">
                <Field label="Net worth" htmlFor="cf-nw">
                  <Input id="cf-nw" name="netWorthCr" type="number" step="0.01" defaultValue={v(client.netWorthCr)} />
                </Field>
              </div>
            </Section>
            <div className="col-span-6">
              <Field label="Notes" htmlFor="cf-notes">
                <Textarea id="cf-notes" name="notes" defaultValue={v(client.notes)} />
              </Field>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
