import type { DocumentCategory, Prisma } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { HttpError } from "@/lib/session";

export const GENERAL_DOCUMENT_CATEGORIES = [
  "NDA",
  "PROPOSAL",
  "ENGAGEMENT_LETTER",
  "FINANCIALS",
  "ITR",
  "DUE_DILIGENCE",
  "VALUATION_REPORT",
  "PITCH_DECK",
  "DRHP",
  "RHP",
  "OTHER",
] as const satisfies readonly DocumentCategory[];

type NewVersion = {
  clientId: string;
  category: DocumentCategory;
  title: string | null;
  fileName: string;
  storageKey: string;
  mimeType: string;
  sizeBytes: number;
  notes: string | null;
  mandateId?: string | null;
  uploadedById: string;
};

/**
 * Stores an upload as a new document, or as the next version of an existing
 * one (`groupId`). The previous latest version is kept, only un-flagged.
 */
export async function createDocumentVersion(tx: Prisma.TransactionClient, data: NewVersion, groupId?: string | null) {
  if (!groupId) {
    const id = randomUUID();
    return tx.document.create({ data: { ...data, id, groupId: id, version: 1, isLatest: true } });
  }
  const latest = await tx.document.findFirst({ where: { groupId, isLatest: true } });
  if (!latest) throw new HttpError(404, "Document to replace not found");
  if (latest.clientId !== data.clientId) throw new HttpError(400, "Document belongs to another client");
  await tx.document.updateMany({ where: { groupId, isLatest: true }, data: { isLatest: false } });
  return tx.document.create({
    data: { ...data, category: latest.category, title: data.title ?? latest.title, groupId, version: latest.version + 1, isLatest: true },
  });
}
