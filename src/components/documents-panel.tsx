"use client";

import type { DocumentCategory } from "@prisma/client";
import { ChevronDown, ChevronRight, Download, Eye, Upload } from "lucide-react";
import { useRouter } from "next/navigation";
import { Fragment, useMemo, useState } from "react";
import { Card, EmptyState, Table, Td, Th } from "@/components/layout";
import { Badge, Button, ErrorText, Field, Input, Modal, Select, Textarea } from "@/components/ui";
import { api } from "@/lib/api-client";
import { formatBytes, formatDateTime } from "@/lib/format";
import { DOCUMENT_CATEGORY_LABELS } from "@/lib/labels";

export type DocRow = {
  id: string;
  groupId: string;
  version: number;
  isLatest: boolean;
  category: DocumentCategory;
  title: string | null;
  fileName: string;
  sizeBytes: number;
  notes: string | null;
  createdAt: string;
  uploadedBy: string | null;
};

const KYC = new Set<DocumentCategory>(["KYC_PAN", "KYC_AADHAAR", "KYC_BANK_PROOF", "KYC_PHOTO"]);
const GENERAL: DocumentCategory[] = ["CONTRACT_NOTE", "RISK_DISCLOSURE", "APPLICATION_FORM", "OTHER"];

/** All documents for a client: latest version per document, with expandable version history. */
export function DocumentsPanel({ clientId, documents, canUpload }: { clientId: string; documents: DocRow[]; canUpload: boolean }) {
  const [category, setCategory] = useState<string>("");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [uploading, setUploading] = useState<{ replaces?: DocRow } | null>(null);

  const groups = useMemo(() => {
    const byGroup = new Map<string, DocRow[]>();
    for (const d of documents) byGroup.set(d.groupId, [...(byGroup.get(d.groupId) ?? []), d]);
    return [...byGroup.values()]
      .map((versions) => versions.sort((a, b) => b.version - a.version))
      .filter((v) => !category || v[0].category === category)
      .sort((a, b) => b[0].createdAt.localeCompare(a[0].createdAt));
  }, [documents, category]);

  const toggle = (g: string) =>
    setExpanded((s) => {
      const n = new Set(s);
      if (n.has(g)) n.delete(g);
      else n.add(g);
      return n;
    });

  return (
    <Card
      title="Documents"
      actions={
        <div className="flex items-center gap-2">
          <Select
            aria-label="Filter documents by category"
            className="!h-8 !w-auto text-xs"
            options={Object.entries(DOCUMENT_CATEGORY_LABELS).map(([value, label]) => ({ value, label }))}
            placeholder="All categories"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          />
          {canUpload && (
            <Button size="sm" onClick={() => setUploading({})}>
              <Upload size={13} /> Upload
            </Button>
          )}
        </div>
      }
    >
      {groups.length === 0 ? (
        <EmptyState title="No documents" description={category ? "Nothing in this category yet." : "Upload contract notes, risk disclosures, application forms and more."} />
      ) : (
        <Table>
          <thead>
            <tr>
              <Th>Document</Th>
              <Th>Category</Th>
              <Th>Version</Th>
              <Th>Uploaded</Th>
              <Th>Uploaded by</Th>
              <Th />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100" data-testid="documents">
            {groups.map((versions) => {
              const d = versions[0];
              const open = expanded.has(d.groupId);
              return (
                <Fragment key={d.groupId}>
                  <tr className="hover:bg-gray-50/60" data-testid="document-row">
                    <Td className="max-w-[16rem]">
                      <div className="flex items-start gap-1.5">
                        {versions.length > 1 ? (
                          <button onClick={() => toggle(d.groupId)} className="mt-0.5 text-gray-400 hover:text-gray-700" aria-label={open ? "Hide versions" : "Show versions"}>
                            {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                          </button>
                        ) : (
                          <span className="w-[14px]" />
                        )}
                        <div className="min-w-0">
                          <p className="truncate font-medium text-gray-900">{d.title ?? d.fileName}</p>
                          <p className="truncate text-xs text-gray-500">
                            {d.fileName} · {formatBytes(d.sizeBytes)}
                          </p>
                        </div>
                      </div>
                    </Td>
                    <Td>
                      <Badge tone={KYC.has(d.category) ? "violet" : "gray"}>{DOCUMENT_CATEGORY_LABELS[d.category]}</Badge>
                    </Td>
                    <Td>
                      v{d.version}
                      {versions.length > 1 && <span className="text-xs text-gray-400"> ({versions.length} versions)</span>}
                    </Td>
                    <Td>{formatDateTime(d.createdAt)}</Td>
                    <Td>{d.uploadedBy ?? "—"}</Td>
                    <Td className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <DocLinks id={d.id} />
                        {canUpload && !KYC.has(d.category) && (
                          <Button size="sm" variant="ghost" onClick={() => setUploading({ replaces: d })}>
                            New version
                          </Button>
                        )}
                      </div>
                    </Td>
                  </tr>
                  {open &&
                    versions.slice(1).map((v) => (
                      <tr key={v.id} className="bg-gray-50/60 text-gray-500" data-testid="document-version">
                        <Td className="pl-10 text-xs">{v.fileName}</Td>
                        <Td />
                        <Td className="text-xs">v{v.version}</Td>
                        <Td className="text-xs">{formatDateTime(v.createdAt)}</Td>
                        <Td className="text-xs">{v.uploadedBy ?? "—"}</Td>
                        <Td className="text-right">
                          <div className="flex justify-end">
                            <DocLinks id={v.id} />
                          </div>
                        </Td>
                      </tr>
                    ))}
                </Fragment>
              );
            })}
          </tbody>
        </Table>
      )}
      {uploading && <UploadModal clientId={clientId} replaces={uploading.replaces} onClose={() => setUploading(null)} />}
    </Card>
  );
}

function DocLinks({ id }: { id: string }) {
  return (
    <>
      <a href={`/api/documents/${id}?inline=1`} target="_blank" rel="noreferrer" className="rounded p-1.5 text-gray-500 hover:bg-gray-100" title="View">
        <Eye size={15} />
      </a>
      <a href={`/api/documents/${id}`} className="rounded p-1.5 text-gray-500 hover:bg-gray-100" title="Download">
        <Download size={15} />
      </a>
    </>
  );
}

function UploadModal({ clientId, replaces, onClose }: { clientId: string; replaces?: DocRow; onClose: () => void }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const form = new FormData(e.currentTarget);
    if (replaces) {
      form.set("replacesGroupId", replaces.groupId);
      form.set("category", replaces.category);
    }
    try {
      await api(`/api/clients/${clientId}/documents`, "POST", form);
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
      title={replaces ? `New version of "${replaces.title ?? replaces.fileName}"` : "Upload document"}
      description={replaces ? `The current version (v${replaces.version}) stays available in the history.` : "PDF, JPG, PNG or WEBP up to 10 MB. KYC documents are uploaded in the KYC section."}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="doc-upload" loading={loading}>
            Upload
          </Button>
        </>
      }
    >
      <form id="doc-upload" onSubmit={onSubmit} className="space-y-3">
        <ErrorText>{error}</ErrorText>
        {!replaces && (
          <Field label="Category" htmlFor="du-category">
            <Select id="du-category" name="category" options={GENERAL.map((c) => ({ value: c, label: DOCUMENT_CATEGORY_LABELS[c] }))} defaultValue="CONTRACT_NOTE" />
          </Field>
        )}
        {!replaces && (
          <Field label="Title" htmlFor="du-title" hint="Optional, e.g. “Contract note 24 Sep 2026”. Defaults to the file name.">
            <Input id="du-title" name="title" />
          </Field>
        )}
        <Field label="File" htmlFor="du-file">
          <Input id="du-file" name="file" type="file" accept="application/pdf,image/jpeg,image/png,image/webp" required className="py-1.5" />
        </Field>
        <Field label="Notes" htmlFor="du-notes">
          <Textarea id="du-notes" name="notes" rows={2} />
        </Field>
      </form>
    </Modal>
  );
}
