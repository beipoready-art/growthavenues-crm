import { prisma } from "@/lib/prisma";
import { ownsRecord } from "@/lib/rbac";
import { handle, HttpError, requireApiUser } from "@/lib/session";
import { storage } from "@/lib/storage";

/** Streams a stored document to users allowed to see its client. */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const user = await requireApiUser("clients:view");
    const { id } = await params;
    const doc = await prisma.document.findUnique({ where: { id }, include: { client: { select: { assignedRmId: true } } } });
    if (!doc || !ownsRecord(user, doc.client)) throw new HttpError(404, "Document not found");

    const { body, size } = await storage.get(doc.storageKey);
    const inline = new URL(req.url).searchParams.get("inline") === "1";
    const filename = encodeURIComponent(doc.fileName);
    return new Response(body, {
      headers: {
        "Content-Type": doc.mimeType,
        "Content-Length": String(size),
        "Content-Disposition": `${inline ? "inline" : "attachment"}; filename*=UTF-8''${filename}`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  });
}
