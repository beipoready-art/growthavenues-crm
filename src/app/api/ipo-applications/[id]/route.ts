import { NextResponse } from "next/server";
import { audit, diff } from "@/lib/audit";
import { applicationInclude, applicationUpdateSchema } from "@/lib/ipo-applications";
import { prisma } from "@/lib/prisma";
import { ownsRecord } from "@/lib/rbac";
import { handle, HttpError, requireApiUser } from "@/lib/session";

/** Updates allotment status (and, while still APPLIED, the bid itself). */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const user = await requireApiUser("ipoApps:manage");
    const { id } = await params;
    const app = await prisma.ipoApplication.findUnique({ where: { id }, include: { client: { select: { id: true, name: true, assignedRmId: true } }, ipo: true } });
    if (!app || !ownsRecord(user, app.client)) throw new HttpError(404, "Application not found");
    const input = applicationUpdateSchema.parse(await req.json());

    if ((input.lotsApplied !== undefined && input.lotsApplied !== app.lotsApplied) || (input.amount != null && input.amount !== Number(app.amount))) {
      if (app.status !== "APPLIED") throw new HttpError(400, "Lots and amount can only be changed while the application is in Applied status");
    }
    const status = input.status ?? app.status;
    const lotsApplied = input.lotsApplied ?? app.lotsApplied;
    let lotsAllotted: number | null = input.lotsAllotted ?? app.lotsAllotted;
    if (status === "ALLOTTED") lotsAllotted = input.lotsAllotted ?? lotsApplied;
    if (status === "PARTIALLY_ALLOTTED" && (lotsAllotted == null || lotsAllotted < 1 || lotsAllotted >= lotsApplied)) {
      throw new HttpError(400, `Partially allotted needs lots allotted between 1 and ${lotsApplied - 1}`);
    }
    if (status === "ALLOTTED" && lotsAllotted !== lotsApplied) throw new HttpError(400, "Fully allotted means all applied lots were allotted");
    if (status === "APPLIED" || status === "REJECTED" || status === "REFUNDED") lotsAllotted = null;

    const data = {
      status,
      lotsApplied,
      lotsAllotted,
      ...(input.amount != null ? { amount: input.amount } : {}),
      ...(input.notes !== undefined ? { notes: input.notes } : {}),
    };
    const changes = diff({ ...app, amount: Number(app.amount) } as Record<string, unknown>, data);
    const updated = await prisma.$transaction(async (tx) => {
      const u = await tx.ipoApplication.update({ where: { id }, data, include: applicationInclude });
      if (Object.keys(changes).length) {
        const metadata = { applicationId: id, ipo: app.ipo.companyName, client: app.client.name, ...changes };
        await audit(tx, { entityType: "Client", entityId: app.client.id, action: "ipo_application_updated", userId: user.id, metadata });
        await audit(tx, { entityType: "Ipo", entityId: app.ipo.id, action: "ipo_application_updated", userId: user.id, metadata });
      }
      return u;
    });
    return NextResponse.json({ application: updated });
  });
}
