import { NextResponse } from "next/server";
import { z } from "zod";
import { notify } from "@/lib/notifications";
import { prisma } from "@/lib/prisma";
import { handle, HttpError, requireApiUser } from "@/lib/session";

const schema = z.object({
  fromRmId: z.string().min(1),
  toRmId: z.string().min(1),
  leads: z.boolean().default(true), // unconverted leads
  clients: z.boolean().default(true), // clients (their originating leads move with them)
  tasks: z.boolean().default(true), // open tasks on the moved records assigned to the old RM
});

/** Moves an RM's book (leads, clients, open follow-ups) to another RM. */
export async function POST(req: Request) {
  return handle(async () => {
    const admin = await requireApiUser("users:manage");
    const input = schema.parse(await req.json());
    if (input.fromRmId === input.toRmId) throw new HttpError(400, "Choose a different RM to reassign to");
    const [from, to] = await Promise.all([
      prisma.user.findFirst({ where: { id: input.fromRmId, role: "RM" } }),
      prisma.user.findFirst({ where: { id: input.toRmId, role: "RM", active: true } }),
    ]);
    if (!from) throw new HttpError(404, "RM not found");
    if (!to) throw new HttpError(400, "Reassign to an active Relationship Manager");

    const result = await prisma.$transaction(async (tx) => {
      const leads = input.leads ? await tx.lead.findMany({ where: { assignedRmId: from.id, status: { not: "CONVERTED" } }, select: { id: true } }) : [];
      const clients = input.clients ? await tx.client.findMany({ where: { assignedRmId: from.id }, select: { id: true, leadId: true } }) : [];
      const originLeadIds = clients.map((c) => c.leadId).filter((x): x is string => !!x);
      const leadIds = [...leads.map((l) => l.id), ...originLeadIds];
      const clientIds = clients.map((c) => c.id);

      await tx.lead.updateMany({ where: { id: { in: leadIds } }, data: { assignedRmId: to.id } });
      await tx.client.updateMany({ where: { id: { in: clientIds } }, data: { assignedRmId: to.id } });
      const tasks = input.tasks
        ? await tx.task.updateMany({
            where: { assignedToId: from.id, status: "OPEN", OR: [{ leadId: { in: leadIds } }, { clientId: { in: clientIds } }] },
            data: { assignedToId: to.id },
          })
        : { count: 0 };

      const metadata = { assignedRmId: { from: from.id, to: to.id }, bulk: true };
      await tx.auditLog.createMany({
        data: [
          ...leadIds.map((id) => ({ entityType: "Lead", entityId: id, action: "reassigned", userId: admin.id, metadata })),
          ...clientIds.map((id) => ({ entityType: "Client", entityId: id, action: "reassigned", userId: admin.id, metadata })),
          { entityType: "User", entityId: from.id, action: "book_reassigned", userId: admin.id, metadata: { to: to.id, leads: leads.length, clients: clientIds.length, tasks: tasks.count } },
        ],
      });
      const parts = [leads.length && `${leads.length} lead${leads.length > 1 ? "s" : ""}`, clientIds.length && `${clientIds.length} client${clientIds.length > 1 ? "s" : ""}`, tasks.count && `${tasks.count} open task${tasks.count > 1 ? "s" : ""}`].filter(Boolean);
      if (parts.length) {
        await notify(tx, [to.id], { type: clientIds.length ? "CLIENT_ASSIGNED" : "LEAD_ASSIGNED", title: `${parts.join(", ")} reassigned to you`, body: `From ${from.name}'s book, by ${admin.name}`, link: "/clients" }, admin.id);
      }
      return { leads: leads.length, clients: clientIds.length, tasks: tasks.count };
    });
    return NextResponse.json(result);
  });
}
