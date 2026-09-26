import { NextResponse } from "next/server";
import { audit, diff } from "@/lib/audit";
import { companyProfileSchema, LOGO_MIME_TYPES, MAX_LOGO_BYTES } from "@/lib/company";
import { prisma } from "@/lib/prisma";
import { handle, HttpError, requireApiUser } from "@/lib/session";
import { makeStorageKey, storage } from "@/lib/storage";

/** Update the firm profile. Multipart form: text fields + optional `logo` file (+ `removeLogo=1`). */
export async function PUT(req: Request) {
  return handle(async () => {
    const user = await requireApiUser("settings:manage");
    const form = await req.formData();
    const input = companyProfileSchema.parse(Object.fromEntries([...form.entries()].filter(([, v]) => typeof v === "string")));

    let logo: { logoKey: string | null; logoMime: string | null } | undefined;
    const file = form.get("logo");
    if (file instanceof File && file.size > 0) {
      if (!LOGO_MIME_TYPES.includes(file.type)) throw new HttpError(400, "Logo must be a PNG, JPG or WEBP image");
      if (file.size > MAX_LOGO_BYTES) throw new HttpError(400, "Logo must be smaller than 1 MB");
      const key = makeStorageKey("branding", file.type);
      await storage.put(key, Buffer.from(await file.arrayBuffer()), file.type);
      logo = { logoKey: key, logoMime: file.type };
    } else if (form.get("removeLogo") === "1") {
      logo = { logoKey: null, logoMime: null };
    }

    const before = await prisma.companyProfile.findUnique({ where: { id: 1 } });
    const data = { ...input, ...logo, updatedById: user.id };
    const profile = await prisma.companyProfile.upsert({ where: { id: 1 }, create: { id: 1, ...data }, update: data });
    const changes = before ? diff(before as unknown as Record<string, unknown>, input) : input;
    await audit(prisma, { entityType: "Settings", entityId: "company", action: "updated", userId: user.id, metadata: { ...changes, ...(logo ? { logo: logo.logoKey ? "replaced" : "removed" } : {}) } as object });
    return NextResponse.json({ profile });
  });
}
