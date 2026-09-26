import { clientWhere } from "@/lib/clients";
import { csvDate, csvResponse, toCsv } from "@/lib/csv";
import { ENTITY_TYPE_LABELS, KYC_STATUS_LABELS, LEAD_SOURCE_LABELS } from "@/lib/labels";
import { prisma } from "@/lib/prisma";
import { handle, requireApiUser } from "@/lib/session";

/** Client companies with onboarding KYC status. Accepts the same filters as the Clients page. */
export async function GET(req: Request) {
  return handle(async () => {
    const user = await requireApiUser("reports:view");
    const clients = await prisma.client.findMany({
      where: clientWhere(user, new URL(req.url).searchParams),
      include: {
        assignedRm: { select: { name: true } },
        contacts: { where: { isPrimary: true }, take: 1 },
        kycStatusChanges: { orderBy: { createdAt: "desc" }, take: 1, include: { changedBy: { select: { name: true } } } },
      },
      orderBy: { name: "asc" },
    });
    const csv = toCsv(
      [
        "Company", "CIN", "PAN", "GSTIN", "Entity type", "Sector", "City", "Primary contact", "Contact email", "Contact phone",
        "FY", "Revenue (INR Cr)", "EBITDA (INR Cr)", "PAT (INR Cr)", "Net worth (INR Cr)",
        "Source", "KYC status", "KYC last changed", "KYC changed by", "Assigned RM", "Client since",
      ],
      clients.map((c) => {
        const last = c.kycStatusChanges[0];
        const contact = c.contacts[0];
        return [
          c.name, c.cin, c.panNumber, c.gstin, ENTITY_TYPE_LABELS[c.entityType], c.sector, c.city,
          contact?.name, contact?.email, contact?.phone,
          c.financialYear, c.revenueCr?.toString(), c.ebitdaCr?.toString(), c.patCr?.toString(), c.netWorthCr?.toString(),
          LEAD_SOURCE_LABELS[c.source], KYC_STATUS_LABELS[c.kycStatus], last?.createdAt, last?.changedBy?.name,
          c.assignedRm?.name ?? "Unassigned", csvDate(c.createdAt),
        ];
      }),
    );
    return csvResponse("client-companies", csv);
  });
}
