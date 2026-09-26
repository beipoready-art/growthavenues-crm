import { NextResponse } from "next/server";
import { audit } from "@/lib/audit";
import { loadClientForUser } from "@/lib/clients";
import { applicationCreateSchema, applicationInclude, applicationWhere, defaultAmount, IPO_ACCEPTING_APPLICATIONS } from "@/lib/ipo-applications";
import { prisma } from "@/lib/prisma";
import { handle, HttpError, requireApiUser } from "@/lib/session";

export async function GET(req: Request) {
  return handle(async () => {
    const user = await requireApiUser("ipos:view");
    const applications = await prisma.ipoApplication.findMany({
      where: applicationWhere(user, new URL(req.url).searchParams),
      include: applicationInclude,
      orderBy: { applicationDate: "desc" },
    });
    return NextResponse.json({ applications });
  });
}

export async function POST(req: Request) {
  return handle(async () => {
    const user = await requireApiUser("ipoApps:manage");
    const input = applicationCreateSchema.parse(await req.json());
    const client = await loadClientForUser(user, input.clientId);
    const ipo = await prisma.ipo.findUnique({ where: { id: input.ipoId } });
    if (!ipo) throw new HttpError(404, "IPO not found");

    if (client.kycStatus !== "VERIFIED") throw new HttpError(400, "Client KYC must be verified before applying to an IPO");
    if (!(IPO_ACCEPTING_APPLICATIONS as readonly string[]).includes(ipo.status)) {
      throw new HttpError(400, "Applications can only be logged for open or recently closed IPOs");
    }

    const amount = input.amount ?? defaultAmount(input.lotsApplied, ipo.lotSize, ipo.priceBandHigh);
    const application = await prisma.$transaction(async (tx) => {
      const created = await tx.ipoApplication.create({
        data: { ...input, amount, createdById: user.id },
        include: applicationInclude,
      });
      const metadata = { applicationId: created.id, ipo: ipo.companyName, lots: input.lotsApplied, amount };
      await audit(tx, { entityType: "Client", entityId: client.id, action: "ipo_applied", userId: user.id, metadata });
      await audit(tx, { entityType: "Ipo", entityId: ipo.id, action: "application_logged", userId: user.id, metadata: { ...metadata, client: client.name } });
      return created;
    }).catch((e) => {
      if (e?.code === "P2002") throw new HttpError(409, "This client has already applied to this IPO");
      throw e;
    });
    return NextResponse.json({ application }, { status: 201 });
  });
}
