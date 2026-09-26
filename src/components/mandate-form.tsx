"use client";

import type { ListingBoard, ServiceLine } from "@prisma/client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button, ErrorText, Field, Input, Modal, Select, Textarea } from "@/components/ui";
import { api } from "@/lib/api-client";
import { toDateInput } from "@/lib/format";
import { LISTING_BOARD_LABELS, options, SERVICE_LABELS } from "@/lib/labels";

type Option = { value: string; label: string };

export type MandateFormValues = {
  id: string;
  title: string;
  service: ServiceLine;
  board: ListingBoard;
  issueSizeCr: number | null;
  retainerFee: number | null;
  successFeePct: number | null;
  targetDate: string | null;
  notes: string | null;
  leadAdvisorId: string | null;
  serviceLocked: boolean;
};

const BOARD_FOR: Record<ServiceLine, ListingBoard> = {
  SME_IPO: "NSE_EMERGE",
  MAINBOARD_IPO: "MAINBOARD",
  PRE_IPO: "NOT_APPLICABLE",
  FUND_RAISING: "NOT_APPLICABLE",
  VALUATION_RESTRUCTURING: "NOT_APPLICABLE",
};

export function MandateFormModal({
  mandate,
  clientId,
  clients,
  advisors,
  onClose,
}: {
  mandate?: MandateFormValues;
  clientId?: string;
  clients?: Option[];
  advisors: Option[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [service, setService] = useState<ServiceLine>(mandate?.service ?? "SME_IPO");
  const [board, setBoard] = useState<ListingBoard>(mandate?.board ?? "NSE_EMERGE");
  const [size, setSize] = useState(mandate?.issueSizeCr?.toString() ?? "");
  const [retainer, setRetainer] = useState(mandate?.retainerFee?.toString() ?? "");
  const [pct, setPct] = useState(mandate?.successFeePct?.toString() ?? "");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const fee = (Number(retainer) || 0) + (Number(size) || 0) * 1e7 * ((Number(pct) || 0) / 100);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const body: Record<string, unknown> = Object.fromEntries(new FormData(e.currentTarget));
    try {
      if (mandate) {
        await api(`/api/mandates/${mandate.id}`, "PATCH", body);
        router.refresh();
      } else {
        const { mandate: created } = await api<{ mandate: { id: string } }>("/api/mandates", "POST", { ...body, clientId: clientId ?? body.clientId });
        router.push(`/mandates/${created.id}`);
      }
      onClose();
    } catch (err) {
      setError((err as Error).message);
      setLoading(false);
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={mandate ? "Edit mandate" : "New mandate"}
      description={mandate ? undefined : "Starts at Proposal. Move it through the pipeline from the mandate page or the board."}
      width="max-w-xl"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="mandate-form" loading={loading}>
            {mandate ? "Save changes" : "Create mandate"}
          </Button>
        </>
      }
    >
      <form id="mandate-form" onSubmit={onSubmit} className="grid grid-cols-6 gap-3">
        <div className="col-span-6">
          <ErrorText>{error}</ErrorText>
        </div>
        {!mandate && !clientId && clients && (
          <div className="col-span-6">
            <Field label="Client company" htmlFor="mf-client">
              <Select id="mf-client" name="clientId" options={clients} placeholder="Choose a client…" required />
            </Field>
          </div>
        )}
        <div className="col-span-6">
          <Field label="Title" htmlFor="mf-title">
            <Input id="mf-title" name="title" defaultValue={mandate?.title} placeholder="SME IPO on NSE Emerge" required autoFocus />
          </Field>
        </div>
        <div className="col-span-3">
          <Field label="Service" htmlFor="mf-service" hint={mandate?.serviceLocked ? "Fixed once past Proposal." : undefined}>
            <Select
              id="mf-service"
              name="service"
              options={options(SERVICE_LABELS)}
              value={service}
              disabled={mandate?.serviceLocked}
              onChange={(e) => {
                const s = e.target.value as ServiceLine;
                setService(s);
                setBoard(BOARD_FOR[s]);
              }}
            />
          </Field>
          {mandate?.serviceLocked && <input type="hidden" name="service" value={service} />}
        </div>
        <div className="col-span-3">
          <Field label="Listing board" htmlFor="mf-board">
            <Select id="mf-board" name="board" options={options(LISTING_BOARD_LABELS)} value={board} onChange={(e) => setBoard(e.target.value as ListingBoard)} />
          </Field>
        </div>
        <div className="col-span-2">
          <Field label="Issue / raise size (₹ Cr)" htmlFor="mf-size">
            <Input id="mf-size" name="issueSizeCr" type="number" step="0.01" min="0" value={size} onChange={(e) => setSize(e.target.value)} />
          </Field>
        </div>
        <div className="col-span-2">
          <Field label="Retainer (₹)" htmlFor="mf-retainer">
            <Input id="mf-retainer" name="retainerFee" type="number" step="1" min="0" value={retainer} onChange={(e) => setRetainer(e.target.value)} />
          </Field>
        </div>
        <div className="col-span-2">
          <Field label="Success fee (%)" htmlFor="mf-pct">
            <Input id="mf-pct" name="successFeePct" type="number" step="0.01" min="0" max="100" value={pct} onChange={(e) => setPct(e.target.value)} />
          </Field>
        </div>
        <p className="col-span-6 -mt-1 text-xs text-gray-500" data-testid="fee-estimate">
          Expected fee: <span className="font-medium text-gray-900">{fee > 0 ? new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(fee) : "—"}</span> (retainer + success fee on the target size)
        </p>
        <div className="col-span-3">
          <Field label="Target listing / closing date" htmlFor="mf-target">
            <Input id="mf-target" name="targetDate" type="date" defaultValue={toDateInput(mandate?.targetDate)} />
          </Field>
        </div>
        <div className="col-span-3">
          <Field label="Lead advisor" htmlFor="mf-advisor">
            <Select id="mf-advisor" name="leadAdvisorId" options={advisors} placeholder="Client's RM" defaultValue={mandate?.leadAdvisorId ?? ""} />
          </Field>
        </div>
        <div className="col-span-6">
          <Field label="Notes" htmlFor="mf-notes">
            <Textarea id="mf-notes" name="notes" defaultValue={mandate?.notes ?? ""} rows={2} />
          </Field>
        </div>
      </form>
    </Modal>
  );
}

export function NewMandateButton(props: { clientId?: string; clients?: Option[]; advisors: Option[]; size?: "sm" | "md" }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button size={props.size ?? "sm"} onClick={() => setOpen(true)}>
        + New mandate
      </Button>
      {open && <MandateFormModal clientId={props.clientId} clients={props.clients} advisors={props.advisors} onClose={() => setOpen(false)} />}
    </>
  );
}

export function EditMandateButton({ mandate, advisors }: { mandate: MandateFormValues; advisors: Option[] }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="secondary" onClick={() => setOpen(true)}>
        Edit mandate
      </Button>
      {open && <MandateFormModal mandate={mandate} advisors={advisors} onClose={() => setOpen(false)} />}
    </>
  );
}
