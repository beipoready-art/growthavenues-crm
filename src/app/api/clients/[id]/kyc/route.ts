import { NextResponse } from "next/server";
import { z } from "zod";
import { loadClientForUser } from "@/lib/clients";
import { findTransition, KYC_DOCUMENT_CATEGORIES, KYC_STATUSES } from "@/lib/kyc";
import { KYC_STATUS_LABELS } from "@/lib/labels";
import { complianceOfficerIds, notify } from "@/lib/notifications";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/rbac";
import { handle, HttpError, requireApiUser } from "@/lib/session";
import { optionalText } from "@/lib/validation";

const schema = z.object({ toStatus: z.enum(KYC_STATUSES), note: optionalText(1000) });

/** Moves a client's KYC to a new status and records who did it and when. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const user = await requireApiUser("clients:view");
    const client = await loadClientForUser(user, (await params).id);
    const { toStatus, note } = schema.parse(await req.json());

    const t = findTransition(client.kycStatus, toStatus);
    if (!t) throw new HttpError(400, `KYC cannot move from ${KYC_STATUS_LABELS[client.kycStatus]} to ${KYC_STATUS_LABELS[toStatus]}`);
    if (!can(user.role, t.permission)) {
      throw new HttpError(403, t.permission === "kyc:review" ? "Only Compliance or Admin can review KYC" : "You cannot submit KYC for this client");
    }
    if (t.requiresNote && !note) throw new HttpError(400, "A reason is required");

    if (toStatus === "SUBMITTED") {
      if (!client.panNumber) throw new HttpError(400, "Add the client's PAN number before submitting KYC");
      const present = await prisma.document.findMany({
        where: { clientId: client.id, category: { in: [...KYC_DOCUMENT_CATEGORIES] } },
        select: { category: true },
        distinct: ["category"],
      });
      if (present.length < KYC_DOCUMENT_CATEGORIES.length) throw new HttpError(400, "Upload all four KYC documents before submitting");
    }

    const [updated, change] = await prisma.$transaction(async (tx) => {
      // Conditional update guards against two reviewers acting at once.
      const res = await tx.client.updateMany({ where: { id: client.id, kycStatus: client.kycStatus }, data: { kycStatus: toStatus } });
      if (res.count === 0) throw new HttpError(409, "KYC status changed in the meantime. Refresh and try again.");
      const change = await tx.kycStatusChange.create({
        data: { clientId: client.id, fromStatus: client.kycStatus, toStatus, note, changedById: user.id },
      });
      // Notify the client's RM of every change; compliance when KYC lands in their queue.
      const recipients = [client.assignedRmId, ...(toStatus === "SUBMITTED" ? await complianceOfficerIds(tx) : [])];
      await notify(
        tx,
        recipients,
        {
          type: "KYC_STATUS",
          title: `KYC ${KYC_STATUS_LABELS[toStatus].toLowerCase()}: ${client.name}`,
          body: `${KYC_STATUS_LABELS[client.kycStatus]} → ${KYC_STATUS_LABELS[toStatus]} by ${user.name}${note ? ` — ${note}` : ""}`,
          link: `/clients/${client.id}`,
        },
        user.id,
      );
      return [await tx.client.findUniqueOrThrow({ where: { id: client.id } }), change];
    });
    return NextResponse.json({ client: updated, change });
  });
}
