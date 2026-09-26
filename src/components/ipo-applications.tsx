"use client";

import type { IpoApplicationStatus } from "@prisma/client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { EmptyState, Table, Td, Th } from "@/components/layout";
import { Badge, Button, ErrorText, Field, Input, Modal, Select, Textarea } from "@/components/ui";
import { api } from "@/lib/api-client";
import { formatDate, formatINR, toDateInput } from "@/lib/format";
import { IPO_APP_STATUS_LABELS, IPO_APP_STATUS_TONE, options } from "@/lib/labels";

export type ApplicationRow = {
  id: string;
  ipo: { id: string; companyName: string };
  client: { id: string; name: string; rm: string | null };
  lotsApplied: number;
  lotsAllotted: number | null;
  amount: number;
  applicationDate: string;
  status: IpoApplicationStatus;
  notes: string | null;
  canEdit: boolean;
};

/** Applications table, used on both the client profile (show IPO) and the IPO page (show client). */
export function ApplicationsTable({ rows, show }: { rows: ApplicationRow[]; show: "ipo" | "client" }) {
  const [editing, setEditing] = useState<ApplicationRow | null>(null);
  if (rows.length === 0) return <EmptyState title="No IPO applications yet" />;
  return (
    <>
      <Table>
        <thead>
          <tr>
            {show === "ipo" ? <Th>IPO</Th> : <Th>Client</Th>}
            {show === "client" && <Th>RM</Th>}
            <Th className="text-right">Lots</Th>
            <Th className="text-right">Amount</Th>
            <Th>Applied on</Th>
            <Th>Status</Th>
            <Th />
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {rows.map((a) => (
            <tr key={a.id} className="hover:bg-gray-50/60">
              <Td>
                {show === "ipo" ? (
                  <Link href={`/ipos/${a.ipo.id}`} className="font-medium text-gray-900 hover:text-brand-600">
                    {a.ipo.companyName}
                  </Link>
                ) : (
                  <Link href={`/clients/${a.client.id}`} className="font-medium text-gray-900 hover:text-brand-600">
                    {a.client.name}
                  </Link>
                )}
              </Td>
              {show === "client" && <Td>{a.client.rm ?? "—"}</Td>}
              <Td className="text-right tabular-nums">
                {a.lotsAllotted != null ? `${a.lotsAllotted} / ${a.lotsApplied}` : a.lotsApplied}
              </Td>
              <Td className="text-right tabular-nums">{formatINR(a.amount)}</Td>
              <Td>{formatDate(a.applicationDate)}</Td>
              <Td>
                <Badge tone={IPO_APP_STATUS_TONE[a.status]}>{IPO_APP_STATUS_LABELS[a.status]}</Badge>
              </Td>
              <Td className="text-right">
                {a.canEdit && (
                  <Button size="sm" variant="ghost" onClick={() => setEditing(a)}>
                    Update
                  </Button>
                )}
              </Td>
            </tr>
          ))}
        </tbody>
      </Table>
      {editing && <UpdateApplicationModal app={editing} onClose={() => setEditing(null)} />}
    </>
  );
}

function UpdateApplicationModal({ app, onClose }: { app: ApplicationRow; onClose: () => void }) {
  const router = useRouter();
  const [status, setStatus] = useState<IpoApplicationStatus>(app.status);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const body = Object.fromEntries(new FormData(e.currentTarget));
    try {
      await api(`/api/ipo-applications/${app.id}`, "PATCH", body);
      onClose();
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
      title="Update IPO application"
      description={`${app.client.name} · ${app.ipo.companyName}`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="app-update" loading={loading}>
            Save
          </Button>
        </>
      }
    >
      <form id="app-update" onSubmit={onSubmit} className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <ErrorText>{error}</ErrorText>
        </div>
        <div className="col-span-2">
          <Field label="Status" htmlFor="au-status">
            <Select id="au-status" name="status" options={options(IPO_APP_STATUS_LABELS)} value={status} onChange={(e) => setStatus(e.target.value as IpoApplicationStatus)} />
          </Field>
        </div>
        {status === "PARTIALLY_ALLOTTED" && (
          <div className="col-span-2">
            <Field label={`Lots allotted (of ${app.lotsApplied})`} htmlFor="au-allotted">
              <Input id="au-allotted" name="lotsAllotted" type="number" min={1} max={app.lotsApplied - 1} defaultValue={app.lotsAllotted ?? 1} required />
            </Field>
          </div>
        )}
        {status === "APPLIED" && app.status === "APPLIED" && (
          <>
            <Field label="Lots applied" htmlFor="au-lots">
              <Input id="au-lots" name="lotsApplied" type="number" min={1} defaultValue={app.lotsApplied} />
            </Field>
            <Field label="Amount (₹)" htmlFor="au-amount">
              <Input id="au-amount" name="amount" type="number" step="0.01" defaultValue={app.amount} />
            </Field>
          </>
        )}
        <div className="col-span-2">
          <Field label="Notes" htmlFor="au-notes">
            <Textarea id="au-notes" name="notes" defaultValue={app.notes ?? ""} />
          </Field>
        </div>
      </form>
    </Modal>
  );
}

export type IpoOption = { id: string; companyName: string; lotSize: number; priceBandHigh: number; status: string; applied: boolean };

export function LogApplicationButton({ clientId, ipos, disabledReason }: { clientId: string; ipos: IpoOption[]; disabledReason?: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const available = ipos.filter((i) => !i.applied);
  const [ipoId, setIpoId] = useState(available[0]?.id ?? "");
  const [lots, setLots] = useState(1);
  const [amount, setAmount] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const ipo = available.find((i) => i.id === ipoId);
  const computed = useMemo(() => (ipo ? lots * ipo.lotSize * ipo.priceBandHigh : 0), [ipo, lots]);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const body = { ...Object.fromEntries(new FormData(e.currentTarget)), clientId };
    try {
      await api("/api/ipo-applications", "POST", body);
      setOpen(false);
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  const reason = disabledReason ?? (available.length === 0 ? "No open IPOs to apply to" : undefined);
  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)} disabled={!!reason} title={reason}>
        + Log application
      </Button>
      {open && (
        <Modal
          open
          onClose={() => setOpen(false)}
          title="Log IPO application"
          description="Records a bid placed for this client. Amount defaults to the upper price band (cut-off)."
          footer={
            <>
              <Button variant="secondary" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" form="log-app" loading={loading}>
                Log application
              </Button>
            </>
          }
        >
          <form id="log-app" onSubmit={onSubmit} className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <ErrorText>{error}</ErrorText>
            </div>
            <div className="col-span-2">
              <Field label="IPO" htmlFor="la-ipo">
                <Select id="la-ipo" name="ipoId" options={available.map((i) => ({ value: i.id, label: `${i.companyName} (${i.status.toLowerCase()})` }))} value={ipoId} onChange={(e) => setIpoId(e.target.value)} />
              </Field>
            </div>
            <Field label="Lots" htmlFor="la-lots" hint={ipo ? `${lots * ipo.lotSize} shares` : undefined}>
              <Input id="la-lots" name="lotsApplied" type="number" min={1} value={lots} onChange={(e) => setLots(Math.max(1, Number(e.target.value) || 1))} required />
            </Field>
            <Field label="Application date" htmlFor="la-date">
              <Input id="la-date" name="applicationDate" type="date" defaultValue={toDateInput(new Date())} required />
            </Field>
            <div className="col-span-2">
              <Field label="Amount (₹)" htmlFor="la-amount" hint={`Calculated at cut-off: ${formatINR(computed)}. Leave blank to use it.`}>
                <Input id="la-amount" name="amount" type="number" step="0.01" min="0.01" value={amount} placeholder={String(computed)} onChange={(e) => setAmount(e.target.value)} />
              </Field>
            </div>
            <div className="col-span-2">
              <Field label="Notes" htmlFor="la-notes">
                <Textarea id="la-notes" name="notes" placeholder="UPI mandate, category (retail/HNI)…" />
              </Field>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
