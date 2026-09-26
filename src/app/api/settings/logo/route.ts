import { prisma } from "@/lib/prisma";
import { storage } from "@/lib/storage";

/** Public: the firm logo (shown on the login page too). */
export async function GET() {
  const p = await prisma.companyProfile.findUnique({ where: { id: 1 }, select: { logoKey: true, logoMime: true } });
  if (!p?.logoKey || !p.logoMime) return new Response("Not found", { status: 404 });
  const { body, size } = await storage.get(p.logoKey);
  return new Response(body, {
    headers: {
      "Content-Type": p.logoMime,
      "Content-Length": String(size),
      "Cache-Control": "public, max-age=86400",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
