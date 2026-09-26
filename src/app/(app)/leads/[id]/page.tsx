import Link from "next/link";
import { notFound } from "next/navigation";
import { DetailGrid } from "@/components/detail";
import { History } from "@/components/history";
import { Card, PageBody, PageHeader } from "@/components/layout";
import { Badge } from "@/components/ui";
import { formatDate, formatDateTime } from "@/lib/format";
import { LEAD_SOURCE_LABELS, LEAD_STATUS_LABELS, LEAD_STATUS_TONE } from "@/lib/labels";
import { prisma } from "@/lib/prisma";
import { can, ownsRecord } from "@/lib/rbac";
import { requirePageUser } from "@/lib/session";
import { listRms } from "@/lib/users";
import { LeadActions } from "./lead-actions";

export default async function LeadPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePageUser("leads:view");
  const { id } = await params;
  const lead = await prisma.lead.findUnique({
    where: { id },
    include: {
      assignedRm: { select: { id: true, name: true } },
      createdBy: { select: { name: true } },
      client: { select: { id: true } },
    },
  });
  if (!lead || !ownsRecord(user, lead)) notFound();
  const rms = await listRms();
  const converted = lead.status === "CONVERTED";

  return (
    <>
      <PageHeader
        title={lead.name}
        description={`Lead · created ${formatDate(lead.createdAt)}${lead.createdBy ? ` by ${lead.createdBy.name}` : ""}`}
        actions={
          <LeadActions
            lead={{
              id: lead.id,
              name: lead.name,
              phone: lead.phone,
              email: lead.email,
              source: lead.source,
              status: lead.status,
              notes: lead.notes,
              assignedRmId: lead.assignedRmId,
            }}
            rms={rms}
            permissions={{
              edit: can(user.role, "leads:edit") && !converted,
              assign: can(user.role, "leads:assign"),
              remove: can(user.role, "leads:delete") && !lead.client,
              convert: can(user.role, "leads:convert") && !converted,
            }}
          />
        }
      />
      <PageBody className="space-y-5">
        <Link href="/leads" className="text-xs font-medium text-gray-500 hover:text-gray-900">
          ← All leads
        </Link>
        {lead.client && (
          <div className="flex items-center justify-between rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
            <span>This lead was converted to a client on {formatDateTime(lead.convertedAt)}. The lead record is kept for history.</span>
            <Link href={`/clients/${lead.client.id}`} className="font-medium underline">
              Open client →
            </Link>
          </div>
        )}
        <Card title="Details">
          <DetailGrid
            items={[
              { label: "Status", value: <Badge tone={LEAD_STATUS_TONE[lead.status]}>{LEAD_STATUS_LABELS[lead.status]}</Badge> },
              { label: "Phone", value: lead.phone },
              { label: "Email", value: lead.email },
              { label: "Source", value: LEAD_SOURCE_LABELS[lead.source] },
              { label: "Assigned RM", value: lead.assignedRm?.name ?? "Unassigned" },
              { label: "Last updated", value: formatDateTime(lead.updatedAt) },
            ]}
          />
          {lead.notes && (
            <div className="border-t border-gray-100 px-5 py-4">
              <p className="text-xs text-gray-500">Notes</p>
              <p className="mt-1 whitespace-pre-wrap text-sm text-gray-800">{lead.notes}</p>
            </div>
          )}
        </Card>
        <History entities={[{ type: "Lead", id: lead.id }]} />
      </PageBody>
    </>
  );
}
