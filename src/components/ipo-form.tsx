"use client";

import type { IpoStatus } from "@prisma/client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button, ErrorText, Field, Input, Modal, Select, Textarea } from "@/components/ui";
import { api } from "@/lib/api-client";
import { toDateInput } from "@/lib/format";
import { IPO_STATUS_LABELS, options } from "@/lib/labels";

export type IpoFormValues = {
  id: string;
  companyName: string;
  symbol: string | null;
  exchange: string | null;
  priceBandLow: number;
  priceBandHigh: number;
  lotSize: number;
  openDate: string;
  closeDate: string;
  listingDate: string | null;
  status: IpoStatus;
  notes: string | null;
};

export function IpoFormModal({ ipo, onClose }: { ipo?: IpoFormValues; onClose: () => void }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const body = Object.fromEntries(new FormData(e.currentTarget));
    try {
      if (ipo) {
        await api(`/api/ipos/${ipo.id}`, "PATCH", body);
        router.refresh();
      } else {
        const { ipo: created } = await api<{ ipo: { id: string } }>("/api/ipos", "POST", body);
        router.push(`/ipos/${created.id}`);
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
      title={ipo ? "Edit IPO" : "New IPO"}
      width="max-w-xl"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="ipo-form" loading={loading}>
            {ipo ? "Save changes" : "Create IPO"}
          </Button>
        </>
      }
    >
      <form id="ipo-form" onSubmit={onSubmit} className="grid grid-cols-6 gap-3">
        <div className="col-span-6">
          <ErrorText>{error}</ErrorText>
        </div>
        <div className="col-span-6">
          <Field label="Company name" htmlFor="ipo-company">
            <Input id="ipo-company" name="companyName" defaultValue={ipo?.companyName} required autoFocus />
          </Field>
        </div>
        <div className="col-span-3">
          <Field label="Symbol" htmlFor="ipo-symbol">
            <Input id="ipo-symbol" name="symbol" defaultValue={ipo?.symbol ?? ""} placeholder="Optional" />
          </Field>
        </div>
        <div className="col-span-3">
          <Field label="Exchange" htmlFor="ipo-exchange">
            <Input id="ipo-exchange" name="exchange" defaultValue={ipo?.exchange ?? "NSE, BSE"} />
          </Field>
        </div>
        <div className="col-span-2">
          <Field label="Price band low (₹)" htmlFor="ipo-low">
            <Input id="ipo-low" name="priceBandLow" type="number" step="0.01" min="0.01" defaultValue={ipo?.priceBandLow} required />
          </Field>
        </div>
        <div className="col-span-2">
          <Field label="Price band high (₹)" htmlFor="ipo-high">
            <Input id="ipo-high" name="priceBandHigh" type="number" step="0.01" min="0.01" defaultValue={ipo?.priceBandHigh} required />
          </Field>
        </div>
        <div className="col-span-2">
          <Field label="Lot size (shares)" htmlFor="ipo-lot">
            <Input id="ipo-lot" name="lotSize" type="number" step="1" min="1" defaultValue={ipo?.lotSize} required />
          </Field>
        </div>
        <div className="col-span-2">
          <Field label="Open date" htmlFor="ipo-open">
            <Input id="ipo-open" name="openDate" type="date" defaultValue={toDateInput(ipo?.openDate)} required />
          </Field>
        </div>
        <div className="col-span-2">
          <Field label="Close date" htmlFor="ipo-close">
            <Input id="ipo-close" name="closeDate" type="date" defaultValue={toDateInput(ipo?.closeDate)} required />
          </Field>
        </div>
        <div className="col-span-2">
          <Field label="Listing date" htmlFor="ipo-listing">
            <Input id="ipo-listing" name="listingDate" type="date" defaultValue={toDateInput(ipo?.listingDate)} />
          </Field>
        </div>
        <div className="col-span-3">
          <Field label="Status" htmlFor="ipo-status">
            <Select id="ipo-status" name="status" options={options(IPO_STATUS_LABELS)} defaultValue={ipo?.status ?? "UPCOMING"} />
          </Field>
        </div>
        <div className="col-span-6">
          <Field label="Notes" htmlFor="ipo-notes">
            <Textarea id="ipo-notes" name="notes" defaultValue={ipo?.notes ?? ""} placeholder="GMP, anchor details, RHP link…" />
          </Field>
        </div>
      </form>
    </Modal>
  );
}

export function NewIpoButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button onClick={() => setOpen(true)}>+ New IPO</Button>
      {open && <IpoFormModal onClose={() => setOpen(false)} />}
    </>
  );
}

export function EditIpoButton({ ipo }: { ipo: IpoFormValues }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="secondary" onClick={() => setOpen(true)}>
        Edit IPO
      </Button>
      {open && <IpoFormModal ipo={ipo} onClose={() => setOpen(false)} />}
    </>
  );
}
