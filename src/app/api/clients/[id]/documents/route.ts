import { NextResponse } from "next/server";
import { z } from "zod";
import { audit } from "@/lib/audit";
import { loadClientForUser } from "@/lib/clients";
import { KYC_DOCUMENT_CATEGORIES, kycDocsEditable } from "@/lib/kyc";
import { prisma } from "@/lib/prisma";
import { handle, HttpError, requireApiUser } from "@/lib/session";
import { ALLOWED_MIME_TYPES, makeStorageKey, MAX_UPLOAD_BYTES, storage } from "@/lib/storage";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  return handle(async () => {
    const user = await requireApiUser("clients:view");
    const client = await loadClientForUser(user, (await params).id);
    const documents = await prisma.document.findMany({
      where: { clientId: client.id },
      include: { uploadedBy: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json({ documents });
  });
}

const categorySchema = z.enum(KYC_DOCUMENT_CATEGORIES);

export async function POST(req: Request, { params }: Ctx) {
  return handle(async () => {
    const user = await requireApiUser("kyc:upload");
    const client = await loadClientForUser(user, (await params).id);
    const form = await req.formData();
    const category = categorySchema.parse(form.get("category"));
    const file = form.get("file");

    if (!(file instanceof File) || file.size === 0) throw new HttpError(400, "Choose a file to upload");
    if (file.size > MAX_UPLOAD_BYTES) throw new HttpError(400, "File is larger than 10 MB");
    if (!ALLOWED_MIME_TYPES[file.type]) throw new HttpError(400, "Only PDF, JPG, PNG or WEBP files are allowed");
    if (!kycDocsEditable(client.kycStatus)) throw new HttpError(400, "KYC documents are locked while KYC is submitted, under review or verified");

    // Files are never overwritten: a re-upload adds a new document and the
    // previous one stays in the history.
    const storageKey = makeStorageKey(`clients/${client.id}`, file.type);
    await storage.put(storageKey, Buffer.from(await file.arrayBuffer()), file.type);
    const document = await prisma.$transaction(async (tx) => {
      const doc = await tx.document.create({
        data: {
          clientId: client.id,
          category,
          fileName: file.name.slice(0, 255),
          storageKey,
          mimeType: file.type,
          sizeBytes: file.size,
          uploadedById: user.id,
        },
      });
      await audit(tx, { entityType: "Client", entityId: client.id, action: "document_uploaded", userId: user.id, metadata: { documentId: doc.id, category, fileName: doc.fileName } });
      return doc;
    });
    return NextResponse.json({ document }, { status: 201 });
  });
}
