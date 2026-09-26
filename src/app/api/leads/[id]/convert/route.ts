import { NextResponse } from "next/server";
import { audit } from "@/lib/audit";
import { convertLeadSchema } from "@/lib/clients";
import { prisma } from "@/lib/prisma";
import { ownsRecord } from "@/lib/rbac";
import { handle, HttpError, requireApiUser } from "@/lib/session";

/**
 * Converts a company enquiry (lead) into a client company. The client copies
 * the company details, the enquiry's contact person becomes the primary
 * contact, and the client links back to the lead, which is kept (status
 * CONVERTED) so its history stays intact.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const user = await requireApiUser("leads:convert");
    const { id } = await params;
    const input = convertLeadSchema.parse(await req.json());

    const client = await prisma.$transaction(async (tx) => {
      const lead = await tx.lead.findUnique({ where: { id }, include: { client: true } });
      if (!lead || !ownsRecord(user, lead)) throw new HttpError(404, "Lead not found");
      if (lead.client || lead.status === "CONVERTED") throw new HttpError(409, "This lead has already been converted");
      if (lead.status === "LOST") throw new HttpError(400, "Reopen this lost lead before converting it");

      const now = new Date();
      const created = await tx.client.create({
        data: {
          name: lead.companyName,
          city: lead.city,
          sector: lead.sector,
          revenueCr: lead.revenueCr,
          source: lead.source,
          notes: lead.notes,
          assignedRmId: lead.assignedRmId ?? (user.role === "RM" ? user.id : null),
          leadId: lead.id,
          entityType: input.entityType,
          cin: input.cin,
          panNumber: input.panNumber,
          kycStatus: "PENDING",
          contacts: {
            create: [
              { name: lead.name, designation: lead.designation, email: lead.email, phone: lead.phone, isPrimary: true },
              // Any extra people captured on the lead come along too.
              ...(await tx.contact.findMany({ where: { leadId: lead.id } })).map((c) => ({ name: c.name, designation: c.designation, email: c.email, phone: c.phone })),
            ],
          },
        },
      });
      await tx.lead.update({ where: { id: lead.id }, data: { status: "CONVERTED", convertedAt: now } });
      await tx.kycStatusChange.create({ data: { clientId: created.id, fromStatus: null, toStatus: "PENDING", changedById: user.id, note: "Client created from lead" } });
      await audit(tx, { entityType: "Lead", entityId: lead.id, action: "converted", userId: user.id, metadata: { clientId: created.id, status: { from: lead.status, to: "CONVERTED" } } });
      await audit(tx, { entityType: "Client", entityId: created.id, action: "created", userId: user.id, metadata: { fromLeadId: lead.id } });
      return created;
    });
    return NextResponse.json({ client }, { status: 201 });
  });
}
