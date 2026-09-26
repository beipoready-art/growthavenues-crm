import Link from "next/link";
import { notFound } from "next/navigation";
import { DetailGrid } from "@/components/detail";
import { DocumentsPanel } from "@/components/documents-panel";
import { History } from "@/components/history";
import { InteractionLog } from "@/components/interaction-log";
import { ApplicationsTable, LogApplicationButton } from "@/components/ipo-applications";
import { Card, EmptyState, PageBody, PageHeader } from "@/components/layout";
import { Badge } from "@/components/ui";
import { formatDate, formatDateTime } from "@/lib/format";
import { KYC_DOCUMENT_CATEGORIES, KYC_TRANSITIONS, kycDocsEditable } from "@/lib/kyc";
import { CLIENT_TYPE_LABELS, KYC_STATUS_LABELS, KYC_STATUS_TONE, LEAD_SOURCE_LABELS } from "@/lib/labels";
import { applicationInclude, IPO_ACCEPTING_APPLICATIONS, toApplicationRow } from "@/lib/ipo-applications";
import { interactionInclude, timelineWhere, toTimelineEntry } from "@/lib/interactions";
import { prisma } from "@/lib/prisma";
import { can, ownsRecord } from "@/lib/rbac";
import { requirePageUser } from "@/lib/session";
import { listRms } from "@/lib/users";
import { ClientActions } from "./client-actions";
import { KycPanel } from "./kyc-panel";

export default async function ClientPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePageUser("clients:view");
  const { id } = await params;
  const client = await prisma.client.findUnique({
    where: { id },
    include: {
      assignedRm: { select: { id: true, name: true } },
      lead: { select: { id: true, createdAt: true } },
      documents: {
        include: { uploadedBy: { select: { name: true } } },
        orderBy: [{ createdAt: "desc" }, { version: "desc" }],
      },
      kycStatusChanges: { include: { changedBy: { select: { name: true } } }, orderBy: { createdAt: "desc" } },
    },
  });
  if (!client || !ownsRecord(user, client)) notFound();
  const [rms, applications, openIpos, interactions] = await Promise.all([
    listRms(),
    prisma.ipoApplication.findMany({ where: { clientId: client.id }, include: applicationInclude, orderBy: { applicationDate: "desc" } }),
    prisma.ipo.findMany({ where: { status: { in: [...IPO_ACCEPTING_APPLICATIONS] } }, orderBy: { closeDate: "asc" } }),
    prisma.interaction.findMany({
      where: timelineWhere({ clientId: client.id, originLeadId: client.leadId }),
      include: interactionInclude,
      orderBy: [{ occurredAt: "desc" }, { createdAt: "desc" }],
    }),
  ]);
  const appliedIpoIds = new Set(applications.map((a) => a.ipoId));

  const transitions = KYC_TRANSITIONS.filter((t) => t.from === client.kycStatus && can(user.role, t.permission)).map(({ to, label, requiresNote }) => ({
    to,
    label,
    requiresNote,
  }));

  return (
    <>
      <PageHeader
        title={client.name}
        description={`${CLIENT_TYPE_LABELS[client.clientType]} client · since ${formatDate(client.createdAt)}`}
        actions={
          can(user.role, "clients:edit") && (
            <ClientActions
              client={{
                id: client.id,
                name: client.name,
                phone: client.phone,
                email: client.email,
                source: client.source,
                panNumber: client.panNumber,
                clientType: client.clientType,
                notes: client.notes,
                assignedRmId: client.assignedRmId,
              }}
              rms={rms}
              canAssign={can(user.role, "clients:assign")}
              panLocked={!kycDocsEditable(client.kycStatus)}
            />
          )
        }
      />
      <PageBody className="space-y-5">
        <Link href="/clients" className="text-xs font-medium text-gray-500 hover:text-gray-900">
          ← All clients
        </Link>
        <div className="grid gap-5 xl:grid-cols-5">
          <div className="space-y-5 xl:col-span-3">
            <Card title="Details">
              <DetailGrid
                items={[
                  { label: "Phone", value: client.phone },
                  { label: "Email", value: client.email },
                  { label: "PAN", value: client.panNumber ? <span className="font-mono">{client.panNumber}</span> : <span className="text-amber-700">Not provided</span> },
                  { label: "Client type", value: CLIENT_TYPE_LABELS[client.clientType] },
                  { label: "Source", value: LEAD_SOURCE_LABELS[client.source] },
                  { label: "Assigned RM", value: client.assignedRm?.name ?? "Unassigned" },
                  {
                    label: "Originating lead",
                    value: client.lead ? (
                      <Link href={`/leads/${client.lead.id}`} className="text-brand-600 hover:underline">
                        View lead ({formatDate(client.lead.createdAt)})
                      </Link>
                    ) : (
                      "—"
                    ),
                  },
                  { label: "Last updated", value: formatDateTime(client.updatedAt) },
                ]}
              />
              {client.notes && (
                <div className="border-t border-gray-100 px-5 py-4">
                  <p className="text-xs text-gray-500">Notes</p>
                  <p className="mt-1 whitespace-pre-wrap text-sm text-gray-800">{client.notes}</p>
                </div>
              )}
            </Card>
            <KycPanel
              clientId={client.id}
              status={client.kycStatus}
              categories={[...KYC_DOCUMENT_CATEGORIES]}
              documents={client.documents.filter((d) => (KYC_DOCUMENT_CATEGORIES as readonly string[]).includes(d.category)).map((d) => ({
                id: d.id,
                category: d.category,
                fileName: d.fileName,
                sizeBytes: d.sizeBytes,
                createdAt: d.createdAt.toISOString(),
                uploadedBy: d.uploadedBy?.name ?? null,
              }))}
              transitions={transitions}
              canUpload={can(user.role, "kyc:upload")}
              docsEditable={kycDocsEditable(client.kycStatus)}
            />
            <Card
              title="IPO applications"
              actions={
                can(user.role, "ipoApps:manage") && (
                  <LogApplicationButton
                    clientId={client.id}
                    ipos={openIpos.map((i) => ({
                      id: i.id,
                      companyName: i.companyName,
                      lotSize: i.lotSize,
                      priceBandHigh: Number(i.priceBandHigh),
                      status: i.status,
                      applied: appliedIpoIds.has(i.id),
                    }))}
                    disabledReason={client.kycStatus !== "VERIFIED" ? "KYC must be verified before applying to IPOs" : undefined}
                  />
                )
              }
            >
              <ApplicationsTable rows={applications.map((a) => toApplicationRow(a, user))} show="ipo" />
            </Card>
          </div>
          <div className="space-y-5 xl:col-span-2">
            <InteractionLog
              target={{ clientId: client.id }}
              entries={interactions.map((i) => toTimelineEntry(i, can(user.role, "interactions:viewRemoved")))}
              canLog={can(user.role, "interactions:log")}
              canAmend={can(user.role, "interactions:amend")}
            />
            <Card title="KYC audit trail">
              {client.kycStatusChanges.length === 0 ? (
                <EmptyState title="No KYC changes yet" />
              ) : (
                <ol className="space-y-3 px-5 py-4" data-testid="kyc-audit">
                  {client.kycStatusChanges.map((c) => (
                    <li key={c.id} className="text-sm">
                      <div className="flex flex-wrap items-center gap-1.5">
                        {c.fromStatus && (
                          <>
                            <Badge tone={KYC_STATUS_TONE[c.fromStatus]}>{KYC_STATUS_LABELS[c.fromStatus]}</Badge>
                            <span className="text-gray-400">→</span>
                          </>
                        )}
                        <Badge tone={KYC_STATUS_TONE[c.toStatus]}>{KYC_STATUS_LABELS[c.toStatus]}</Badge>
                      </div>
                      <p className="mt-1 text-xs text-gray-500">
                        {c.changedBy?.name ?? "System"} · {formatDateTime(c.createdAt)}
                      </p>
                      {c.note && <p className="mt-1 rounded bg-gray-50 px-2 py-1 text-xs text-gray-700">{c.note}</p>}
                    </li>
                  ))}
                </ol>
              )}
            </Card>
            <History entities={[{ type: "Client", id: client.id }, ...(client.lead ? [{ type: "Lead", id: client.lead.id }] : [])]} title="Activity (client & lead)" />
          </div>
        </div>
        <DocumentsPanel
          clientId={client.id}
          canUpload={can(user.role, "docs:upload")}
          documents={client.documents.map((d) => ({
            id: d.id,
            groupId: d.groupId,
            version: d.version,
            isLatest: d.isLatest,
            category: d.category,
            title: d.title,
            fileName: d.fileName,
            sizeBytes: d.sizeBytes,
            notes: d.notes,
            createdAt: d.createdAt.toISOString(),
            uploadedBy: d.uploadedBy?.name ?? null,
          }))}
        />
      </PageBody>
    </>
  );
}
