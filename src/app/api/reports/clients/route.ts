import { clientWhere } from "@/lib/clients";
import { csvDate, csvResponse, toCsv } from "@/lib/csv";
import { CLIENT_TYPE_LABELS, KYC_STATUS_LABELS, LEAD_SOURCE_LABELS } from "@/lib/labels";
import { prisma } from "@/lib/prisma";
import { handle, requireApiUser } from "@/lib/session";

/** Client list with KYC status. Accepts the same filters as the Clients page. */
export async function GET(req: Request) {
  return handle(async () => {
    const user = await requireApiUser("reports:view");
    const clients = await prisma.client.findMany({
      where: clientWhere(user, new URL(req.url).searchParams),
      include: {
        assignedRm: { select: { name: true } },
        kycStatusChanges: { orderBy: { createdAt: "desc" }, take: 1, include: { changedBy: { select: { name: true } } } },
      },
      orderBy: { name: "asc" },
    });
    const csv = toCsv(
      ["Client", "Phone", "Email", "PAN", "Client type", "Source", "KYC status", "KYC last changed", "KYC changed by", "Assigned RM", "Client since"],
      clients.map((c) => {
        const last = c.kycStatusChanges[0];
        return [
          c.name,
          c.phone,
          c.email,
          c.panNumber,
          CLIENT_TYPE_LABELS[c.clientType],
          LEAD_SOURCE_LABELS[c.source],
          KYC_STATUS_LABELS[c.kycStatus],
          last?.createdAt,
          last?.changedBy?.name,
          c.assignedRm?.name ?? "Unassigned",
          csvDate(c.createdAt),
        ];
      }),
    );
    return csvResponse("clients-kyc", csv);
  });
}
