import { NextResponse } from "next/server";
import { z } from "zod";
import { audit } from "@/lib/audit";
import { loadClientForUser } from "@/lib/clients";
import { createDocumentVersion } from "@/lib/documents";
import { KYC_DOCUMENT_CATEGORIES, kycDocsEditable } from "@/lib/kyc";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/rbac";
import { handle, HttpError, requireApiUser } from "@/lib/session";
import { ALLOWED_MIME_TYPES, makeStorageKey, MAX_UPLOAD_BYTES, storage } from "@/lib/storage";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(req: Request, { params }: Ctx) {
  return handle(async () => {
    const user = await requireApiUser("clients:view");
    const client = await loadClientForUser(user, (await params).id);
    const latestOnly = new URL(req.url).searchParams.get("latest") === "1";
    const documents = await prisma.document.findMany({
      where: { clientId: client.id, ...(latestOnly ? { isLatest: true } : {}) },
      include: { uploadedBy: { select: { name: true } } },
      orderBy: [{ createdAt: "desc" }, { version: "desc" }],
    });
    return NextResponse.json({ documents });
  });
}

const formSchema = z.object({
  category: z.enum(["KYC_PAN", "KYC_AADHAAR", "KYC_BANK_PROOF", "KYC_PHOTO", "CONTRACT_NOTE", "RISK_DISCLOSURE", "APPLICATION_FORM", "OTHER"]),
  title: z.string().trim().max(200).optional().transform((v) => v || null),
  notes: z.string().trim().max(1000).optional().transform((v) => v || null),
  // Upload as a new version of this document group (general documents).
  replacesGroupId: z.string().optional().transform((v) => v || null),
});

/**
 * Upload a client document. Files are never overwritten: re-uploading adds a
 * new version and keeps the earlier ones downloadable.
 * - KYC categories: one logical document per category; each upload versions it.
 * - General categories: a new document, or a new version via replacesGroupId.
 */
export async function POST(req: Request, { params }: Ctx) {
  return handle(async () => {
    const user = await requireApiUser("clients:view");
    const client = await loadClientForUser(user, (await params).id);
    const form = await req.formData();
    const input = formSchema.parse({
      category: form.get("category"),
      title: form.get("title") ?? undefined,
      notes: form.get("notes") ?? undefined,
      replacesGroupId: form.get("replacesGroupId") ?? undefined,
    });
    const file = form.get("file");

    const isKyc = (KYC_DOCUMENT_CATEGORIES as readonly string[]).includes(input.category);
    if (!can(user.role, isKyc ? "kyc:upload" : "docs:upload")) throw new HttpError(403, "You do not have permission to upload documents");
    if (!(file instanceof File) || file.size === 0) throw new HttpError(400, "Choose a file to upload");
    if (file.size > MAX_UPLOAD_BYTES) throw new HttpError(400, "File is larger than 10 MB");
    if (!ALLOWED_MIME_TYPES[file.type]) throw new HttpError(400, "Only PDF, JPG, PNG or WEBP files are allowed");
    if (isKyc && !kycDocsEditable(client.kycStatus)) throw new HttpError(400, "KYC documents are locked while KYC is submitted, under review or verified");

    let groupId = input.replacesGroupId;
    if (isKyc) {
      const existing = await prisma.document.findFirst({ where: { clientId: client.id, category: input.category, isLatest: true }, select: { groupId: true } });
      groupId = existing?.groupId ?? null;
    } else if (groupId) {
      const target = await prisma.document.findFirst({ where: { groupId, clientId: client.id, isLatest: true } });
      if (!target) throw new HttpError(404, "Document to replace not found");
      if ((KYC_DOCUMENT_CATEGORIES as readonly string[]).includes(target.category)) throw new HttpError(400, "Replace KYC documents from the KYC section");
    }

    const storageKey = makeStorageKey(`clients/${client.id}`, file.type);
    await storage.put(storageKey, Buffer.from(await file.arrayBuffer()), file.type);
    const document = await prisma.$transaction(async (tx) => {
      const doc = await createDocumentVersion(
        tx,
        {
          clientId: client.id,
          category: input.category,
          title: input.title,
          fileName: file.name.slice(0, 255),
          storageKey,
          mimeType: file.type,
          sizeBytes: file.size,
          notes: input.notes,
          uploadedById: user.id,
        },
        groupId,
      );
      await audit(tx, {
        entityType: "Client",
        entityId: client.id,
        action: "document_uploaded",
        userId: user.id,
        metadata: { documentId: doc.id, category: doc.category, fileName: doc.fileName, version: doc.version },
      });
      return doc;
    });
    return NextResponse.json({ document }, { status: 201 });
  });
}
