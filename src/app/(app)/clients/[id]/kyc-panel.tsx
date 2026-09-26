"use client";

import type { DocumentCategory, KycStatus } from "@prisma/client";
import clsx from "clsx";
import { CheckCircle2, Circle, Download, Eye, Upload } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { Card } from "@/components/layout";
import { Badge, Button, ErrorText, Field, Modal, Textarea } from "@/components/ui";
import { api } from "@/lib/api-client";
import { formatBytes, formatDateTime } from "@/lib/format";
import { DOCUMENT_CATEGORY_LABELS, KYC_STATUS_LABELS, KYC_STATUS_TONE } from "@/lib/labels";

export type KycDoc = {
  id: string;
  category: DocumentCategory;
  fileName: string;
  sizeBytes: number;
  createdAt: string;
  uploadedBy: string | null;
};

type Transition = { to: KycStatus; label: string; requiresNote?: boolean };

const STEPS: KycStatus[] = ["PENDING", "SUBMITTED", "UNDER_REVIEW", "VERIFIED"];

export function KycPanel({
  clientId,
  status,
  categories,
  documents,
  transitions,
  canUpload,
  docsEditable,
}: {
  clientId: string;
  status: KycStatus;
  categories: DocumentCategory[];
  documents: KycDoc[];
  transitions: Transition[];
  canUpload: boolean;
  docsEditable: boolean;
}) {
  const router = useRouter();
  const [pending, setPending] = useState<Transition | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  async function upload(category: DocumentCategory, file: File) {
    setError(null);
    setBusy(category);
    const form = new FormData();
    form.set("category", category);
    form.set("file", file);
    try {
      await api(`/api/clients/${clientId}/documents`, "POST", form);
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  const stepIndex = status === "REJECTED" ? 2 : STEPS.indexOf(status);

  return (
    <Card title="KYC" actions={<Badge tone={KYC_STATUS_TONE[status]}>{KYC_STATUS_LABELS[status]}</Badge>}>
      {/* Progress */}
      <ol className="flex items-center gap-2 border-b border-gray-100 px-5 py-3 text-xs">
        {STEPS.map((s, i) => {
          const done = i <= stepIndex && !(status === "REJECTED" && i === 3);
          const label = status === "REJECTED" && i === 3 ? "Rejected" : KYC_STATUS_LABELS[s];
          return (
            <li key={s} className="flex items-center gap-2">
              {i > 0 && <span className={clsx("h-px w-6", done ? "bg-brand-500" : "bg-gray-200")} />}
              <span className={clsx("flex items-center gap-1", status === "REJECTED" && i === 3 ? "text-red-600" : done ? "text-gray-900" : "text-gray-400")}>
                {done ? <CheckCircle2 size={14} className="text-brand-600" /> : <Circle size={14} />}
                {label}
              </span>
            </li>
          );
        })}
      </ol>

      <div className="space-y-3 px-5 py-4">
        <ErrorText>{error}</ErrorText>
        <ul className="divide-y divide-gray-100 rounded-lg border border-gray-100">
          {categories.map((cat) => {
            const versions = documents.filter((d) => d.category === cat);
            const latest = versions[0];
            return (
              <li key={cat} className="px-4 py-3" data-testid={`kyc-doc-${cat}`}>
                <div className="flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900">{DOCUMENT_CATEGORY_LABELS[cat]}</p>
                    {latest ? (
                      <p className="truncate text-xs text-gray-500">
                        {latest.fileName} · {formatBytes(latest.sizeBytes)} · {latest.uploadedBy ?? "Unknown"}, {formatDateTime(latest.createdAt)}
                      </p>
                    ) : (
                      <p className="text-xs text-amber-700">Not uploaded</p>
                    )}
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    {latest && (
                      <>
                        <a href={`/api/documents/${latest.id}?inline=1`} target="_blank" rel="noreferrer" className="rounded p-1.5 text-gray-500 hover:bg-gray-100" title="View">
                          <Eye size={15} />
                        </a>
                        <a href={`/api/documents/${latest.id}`} className="rounded p-1.5 text-gray-500 hover:bg-gray-100" title="Download">
                          <Download size={15} />
                        </a>
                      </>
                    )}
                    {canUpload && docsEditable && <UploadButton loading={busy === cat} label={latest ? "Replace" : "Upload"} onFile={(f) => upload(cat, f)} />}
                  </div>
                </div>
                {versions.length > 1 && (
                  <details className="mt-1.5">
                    <summary className="cursor-pointer text-xs text-gray-500 hover:text-gray-700">{versions.length - 1} previous version(s)</summary>
                    <ul className="mt-1 space-y-0.5 pl-3">
                      {versions.slice(1).map((v) => (
                        <li key={v.id} className="text-xs text-gray-500">
                          <a href={`/api/documents/${v.id}`} className="hover:underline">
                            {v.fileName}
                          </a>{" "}
                          · {v.uploadedBy ?? "Unknown"}, {formatDateTime(v.createdAt)}
                        </li>
                      ))}
                    </ul>
                  </details>
                )}
              </li>
            );
          })}
        </ul>
        {!docsEditable && canUpload && <p className="text-xs text-gray-500">Documents are locked while KYC is with compliance.</p>}
        {transitions.length > 0 && (
          <div className="flex flex-wrap justify-end gap-2 pt-1">
            {transitions.map((t) => (
              <Button key={t.to} variant={t.to === "REJECTED" ? "danger" : t.to === "VERIFIED" ? "primary" : "secondary"} onClick={() => setPending(t)}>
                {t.label}
              </Button>
            ))}
          </div>
        )}
      </div>
      {pending && <TransitionModal clientId={clientId} transition={pending} onClose={() => setPending(null)} />}
    </Card>
  );
}

function UploadButton({ label, loading, onFile }: { label: string; loading: boolean; onFile: (f: File) => void }) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <>
      <input
        ref={ref}
        type="file"
        accept="application/pdf,image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onFile(f);
          e.target.value = "";
        }}
      />
      <Button size="sm" variant="secondary" loading={loading} onClick={() => ref.current?.click()}>
        {!loading && <Upload size={13} />} {label}
      </Button>
    </>
  );
}

function TransitionModal({ clientId, transition, onClose }: { clientId: string; transition: Transition; onClose: () => void }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const note = String(new FormData(e.currentTarget).get("note") ?? "");
    try {
      await api(`/api/clients/${clientId}/kyc`, "POST", { toStatus: transition.to, note });
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
      title={`${transition.label}`}
      description={`KYC status will change to ${KYC_STATUS_LABELS[transition.to]}. This is recorded in the audit trail.`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="kyc-transition" variant={transition.to === "REJECTED" ? "danger" : "primary"} loading={loading}>
            Confirm
          </Button>
        </>
      }
    >
      <form id="kyc-transition" onSubmit={onSubmit} className="space-y-3">
        <ErrorText>{error}</ErrorText>
        <Field label={transition.requiresNote ? "Reason (required)" : "Note (optional)"} htmlFor="kyc-note">
          <Textarea id="kyc-note" name="note" required={transition.requiresNote} autoFocus />
        </Field>
      </form>
    </Modal>
  );
}
