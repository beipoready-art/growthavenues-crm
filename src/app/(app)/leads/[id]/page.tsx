import Link from "next/link";
import { notFound } from "next/navigation";
import { DetailGrid } from "@/components/detail";
import { History } from "@/components/history";
import { InteractionLog } from "@/components/interaction-log";
import { RecordTasks } from "@/components/record-tasks";
import { Card, PageBody, PageHeader } from "@/components/layout";
import { Badge } from "@/components/ui";
import { formatDate, formatDateTime } from "@/lib/format";
import { LEAD_SOURCE_LABELS, LEAD_STATUS_LABELS, LEAD_STATUS_TONE, SERVICE_LABELS } from "@/lib/labels";
import { interactionInclude, timelineWhere, toTimelineEntry } from "@/lib/interactions";
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
  const [rms, interactions] = await Promise.all([
    listRms(),
    prisma.interaction.findMany({ where: timelineWhere({ leadId: lead.id }), include: interactionInclude, orderBy: [{ occurredAt: "desc" }, { createdAt: "desc" }] }),
  ]);
  const converted = lead.status === "CONVERTED";

  return (
    <>
      <PageHeader
        title={lead.companyName}
        description={`Enquiry · ${lead.name}${lead.designation ? `, ${lead.designation}` : ""} · received ${formatDate(lead.createdAt)}${lead.createdBy ? ` · added by ${lead.createdBy.name}` : ""}`}
        actions={
          <LeadActions
            lead={{
              id: lead.id,
              companyName: lead.companyName,
              name: lead.name,
              designation: lead.designation,
              phone: lead.phone,
              email: lead.email,
              city: lead.city,
              sector: lead.sector,
              serviceInterest: lead.serviceInterest,
              revenueCr: lead.revenueCr != null ? Number(lead.revenueCr) : null,
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
              { label: "Contact", value: `${lead.name}${lead.designation ? `, ${lead.designation}` : ""}` },
              { label: "Phone", value: lead.phone },
              { label: "Email", value: lead.email },
              { label: "Service interested in", value: lead.serviceInterest ? SERVICE_LABELS[lead.serviceInterest] : "Not sure yet" },
              { label: "Sector · City", value: [lead.sector, lead.city].filter(Boolean).join(" · ") || "—" },
              { label: "Annual revenue", value: lead.revenueCr != null ? `₹${Number(lead.revenueCr)} Cr` : "—" },
              { label: "Source", value: LEAD_SOURCE_LABELS[lead.source] },
              ...(lead.readinessScore != null ? [{ label: "IPO-ready check score", value: `${lead.readinessScore} / 100` }] : []),
              { label: "Assigned RM", value: lead.assignedRm?.name ?? "Unassigned" },
              { label: "Last updated", value: formatDateTime(lead.updatedAt) },
            ]}
          />
          {lead.readinessAnswers && typeof lead.readinessAnswers === "object" && !Array.isArray(lead.readinessAnswers) && (
            <div className="border-t border-gray-100 px-5 py-4" data-testid="readiness-answers">
              <p className="text-xs text-gray-500">IPO-ready check answers (from the website)</p>
              <dl className="mt-1 grid gap-x-6 gap-y-1 text-sm md:grid-cols-2">
                {Object.entries(lead.readinessAnswers as Record<string, unknown>).map(([q, a]) => (
                  <div key={q} className="flex justify-between gap-3 border-b border-dashed border-gray-100 py-1">
                    <dt className="text-gray-600">{q}</dt>
                    <dd className="text-right font-medium text-gray-900">{String(a)}</dd>
                  </div>
                ))}
              </dl>
            </div>
          )}
          {lead.notes && (
            <div className="border-t border-gray-100 px-5 py-4">
              <p className="text-xs text-gray-500">Notes</p>
              <p className="mt-1 whitespace-pre-wrap text-sm text-gray-800">{lead.notes}</p>
            </div>
          )}
        </Card>
        {!lead.client && <RecordTasks user={user} target={{ leadId: lead.id }} />}
        <InteractionLog
          target={{ leadId: lead.id }}
          entries={interactions.map((i) => toTimelineEntry(i, can(user.role, "interactions:viewRemoved")))}
          canLog={can(user.role, "interactions:log") && !lead.client}
          canAmend={can(user.role, "interactions:amend")}
        />
        <History entities={[{ type: "Lead", id: lead.id }]} />
      </PageBody>
    </>
  );
}
