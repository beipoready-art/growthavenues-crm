import clsx from "clsx";
import { Check } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { DetailGrid } from "@/components/detail";
import { History } from "@/components/history";
import { Card, EmptyState, PageBody, PageHeader } from "@/components/layout";
import { EditMandateButton } from "@/components/mandate-form";
import { StageProgress } from "@/components/mandate-list";
import { Badge } from "@/components/ui";
import { formatDate, formatDateTime, formatINR } from "@/lib/format";
import { formatPriceBand } from "@/lib/ipos";
import { DOCUMENT_CATEGORY_LABELS, IPO_STATUS_LABELS, IPO_STATUS_TONE, LISTING_BOARD_LABELS, MANDATE_STAGE_LABELS, mandateStageTone, SERVICE_LABELS } from "@/lib/labels";
import { allowedNextStages, canSeeMandate, lastActiveStage, PIPELINES } from "@/lib/mandates";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/rbac";
import { requirePageUser } from "@/lib/session";
import { advisorOptions } from "@/lib/users";
import { IpoLinker, StageMover } from "./stage-mover";

const num = (d: { toString(): string } | null) => (d == null ? null : Number(d.toString()));

export default async function MandatePage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePageUser("mandates:view");
  const { id } = await params;
  const m = await prisma.mandate.findUnique({
    where: { id },
    include: {
      client: { select: { id: true, name: true, assignedRmId: true, sector: true, assignedRm: { select: { name: true } } } },
      leadAdvisor: { select: { id: true, name: true } },
      ipo: true,
      stageChanges: { include: { changedBy: { select: { name: true } } }, orderBy: { createdAt: "desc" } },
      documents: { where: { isLatest: true }, include: { uploadedBy: { select: { name: true } } }, orderBy: { createdAt: "desc" } },
    },
  });
  if (!m || !canSeeMandate(user, m)) notFound();
  const canManage = can(user.role, "mandates:manage");
  const [advisors, resumeTo, ipoOptions] = await Promise.all([
    advisorOptions(),
    lastActiveStage(m.id),
    canManage && (m.service === "SME_IPO" || m.service === "MAINBOARD_IPO")
      ? prisma.ipo.findMany({ where: { OR: [{ mandate: null }, { id: m.ipoId ?? "" }] }, select: { id: true, companyName: true }, orderBy: { openDate: "desc" } })
      : Promise.resolve([]),
  ]);

  const pipeline = PIPELINES[m.service];
  const allowed = canManage ? allowedNextStages(m.service, m.stage, resumeTo) : [];
  const idx = pipeline.indexOf(m.stage);
  const suggested = idx >= 0 && idx < pipeline.length - 1 ? pipeline[idx + 1] : m.stage === "ON_HOLD" || m.stage === "DROPPED" ? resumeTo : null;
  const reachedAt = (stage: string) => [...m.stageChanges].reverse().find((c) => c.toStage === stage)?.createdAt;
  const effectiveIdx = idx >= 0 ? idx : resumeTo ? pipeline.indexOf(resumeTo) : -1;

  return (
    <>
      <PageHeader
        title={m.title}
        description={`${m.code} · ${m.client.name} · ${SERVICE_LABELS[m.service]}`}
        actions={
          canManage && (
            <EditMandateButton
              advisors={advisors}
              mandate={{
                id: m.id,
                title: m.title,
                service: m.service,
                board: m.board,
                issueSizeCr: num(m.issueSizeCr),
                retainerFee: num(m.retainerFee),
                successFeePct: num(m.successFeePct),
                targetDate: m.targetDate?.toISOString() ?? null,
                notes: m.notes,
                leadAdvisorId: m.leadAdvisorId,
                serviceLocked: m.stage !== "PROPOSAL",
              }}
            />
          )
        }
      />
      <PageBody className="space-y-5">
        <Link href="/mandates" className="text-xs font-medium text-gray-500 hover:text-gray-900">
          ← All mandates
        </Link>

        <Card title="Pipeline" actions={<Badge tone={mandateStageTone(m.stage)}>{MANDATE_STAGE_LABELS[m.stage]}</Badge>}>
          <ol className="flex flex-wrap gap-x-1 gap-y-3 px-5 py-4" data-testid="stepper">
            {pipeline.map((s, i) => {
              const done = i < effectiveIdx || (i === effectiveIdx && (s === "LISTED" || s === "COMPLETED"));
              const current = s === m.stage;
              const at = reachedAt(s);
              return (
                <li key={s} className="flex items-center gap-1">
                  <div className="flex flex-col items-center text-center" style={{ width: 92 }}>
                    <span
                      className={clsx(
                        "flex h-6 w-6 items-center justify-center rounded-full border text-[10px] font-semibold",
                        done && "border-gold-500 bg-gold-500 text-white",
                        current && !done && "border-brand-600 bg-brand-600 text-white",
                        !done && !current && "border-gray-300 bg-white text-gray-400",
                      )}
                      data-current={current || undefined}
                    >
                      {done ? <Check size={12} strokeWidth={3} /> : i + 1}
                    </span>
                    <span className={clsx("mt-1 text-[11px] leading-tight", current ? "font-semibold text-gray-900" : "text-gray-500")}>{MANDATE_STAGE_LABELS[s]}</span>
                    {at && <span className="text-[10px] text-gray-400">{formatDate(at)}</span>}
                  </div>
                  {i < pipeline.length - 1 && <span className={clsx("mb-8 h-px w-3", i < effectiveIdx ? "bg-gold-500" : "bg-gray-200")} />}
                </li>
              );
            })}
          </ol>
          {(m.stage === "ON_HOLD" || m.stage === "DROPPED") && (
            <p className="border-t border-gray-100 bg-red-50/50 px-5 py-2.5 text-sm text-red-800">
              {MANDATE_STAGE_LABELS[m.stage]} since {formatDate(m.stageChangedAt)}
              {resumeTo && ` · last active stage: ${MANDATE_STAGE_LABELS[resumeTo]}`}
            </p>
          )}
        </Card>

        <div className="grid gap-5 xl:grid-cols-5">
          <div className="space-y-5 xl:col-span-3">
            <Card title="Engagement">
              <DetailGrid
                items={[
                  {
                    label: "Client",
                    value: (
                      <Link href={`/clients/${m.client.id}`} className="text-brand-600 hover:underline">
                        {m.client.name}
                      </Link>
                    ),
                  },
                  { label: "Service", value: SERVICE_LABELS[m.service] },
                  { label: "Listing board", value: LISTING_BOARD_LABELS[m.board] },
                  { label: "Issue / raise size", value: m.issueSizeCr != null ? `₹${num(m.issueSizeCr)} Cr` : "—" },
                  { label: "Retainer", value: formatINR(m.retainerFee) },
                  { label: "Success fee", value: m.successFeePct != null ? `${num(m.successFeePct)}%` : "—" },
                  { label: "Expected fee", value: <span className="font-semibold">{formatINR(m.expectedFee)}</span> },
                  { label: "Target date", value: formatDate(m.targetDate) },
                  { label: "Lead advisor", value: m.leadAdvisor?.name ?? "—" },
                  { label: "Client RM", value: m.client.assignedRm?.name ?? "—" },
                  { label: "Mandate signed", value: formatDate(m.signedAt) },
                  { label: "Closed", value: formatDate(m.closedAt) },
                ]}
              />
              <div className="border-t border-gray-100 px-5 py-3">
                <StageProgress service={m.service} stage={m.stage} />
              </div>
              {m.notes && (
                <div className="border-t border-gray-100 px-5 py-4">
                  <p className="text-xs text-gray-500">Notes</p>
                  <p className="mt-1 whitespace-pre-wrap text-sm text-gray-800">{m.notes}</p>
                </div>
              )}
            </Card>

            {(m.service === "SME_IPO" || m.service === "MAINBOARD_IPO") && (
              <Card title="IPO issue">
                {m.ipo ? (
                  <DetailGrid
                    items={[
                      {
                        label: "Issue",
                        value: (
                          <Link href={`/ipos/${m.ipo.id}`} className="text-brand-600 hover:underline">
                            {m.ipo.companyName}
                          </Link>
                        ),
                      },
                      { label: "Status", value: <Badge tone={IPO_STATUS_TONE[m.ipo.status]}>{IPO_STATUS_LABELS[m.ipo.status]}</Badge> },
                      { label: "Price band", value: formatPriceBand(m.ipo.priceBandLow, m.ipo.priceBandHigh) },
                      { label: "Lot size", value: `${m.ipo.lotSize} shares` },
                      { label: "Subscription", value: `${formatDate(m.ipo.openDate)} – ${formatDate(m.ipo.closeDate)}` },
                      { label: "Listing", value: formatDate(m.ipo.listingDate) },
                    ]}
                  />
                ) : (
                  <p className="px-5 pt-4 text-sm text-gray-500">No issue record linked yet. Once the IPO is announced, an admin adds it under IPO issues; link it here.</p>
                )}
                {canManage && (
                  <div className="border-t border-gray-100 px-5 py-4">
                    <IpoLinker mandateId={m.id} current={m.ipoId} options={ipoOptions.map((i) => ({ value: i.id, label: i.companyName }))} />
                  </div>
                )}
              </Card>
            )}

            <Card
              title={`Documents (${m.documents.length})`}
              actions={
                <Link href={`/clients/${m.client.id}`} className="text-xs font-medium text-brand-600 hover:underline">
                  Upload on client page →
                </Link>
              }
            >
              {m.documents.length === 0 ? (
                <EmptyState title="No documents filed under this mandate" />
              ) : (
                <ul className="divide-y divide-gray-100">
                  {m.documents.map((d) => (
                    <li key={d.id} className="flex items-center justify-between gap-3 px-5 py-2.5 text-sm">
                      <div className="min-w-0">
                        <a href={`/api/documents/${d.id}`} className="font-medium text-gray-900 hover:text-brand-600">
                          {d.title ?? d.fileName}
                        </a>
                        <p className="text-xs text-gray-500">
                          {DOCUMENT_CATEGORY_LABELS[d.category]} · v{d.version} · {d.uploadedBy?.name ?? "—"}, {formatDate(d.createdAt)}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>

          <div className="space-y-5 xl:col-span-2">
            {canManage && (
              <Card title="Update stage">
                <StageMover mandateId={m.id} allowed={allowed} suggested={suggested && allowed.includes(suggested) ? suggested : null} />
              </Card>
            )}
            <Card title="Stage history">
              <ol className="space-y-3 px-5 py-4" data-testid="stage-history">
                {m.stageChanges.map((c) => (
                  <li key={c.id} className="text-sm">
                    <div className="flex flex-wrap items-center gap-1.5">
                      {c.fromStage && (
                        <>
                          <Badge tone={mandateStageTone(c.fromStage)}>{MANDATE_STAGE_LABELS[c.fromStage]}</Badge>
                          <span className="text-gray-400">→</span>
                        </>
                      )}
                      <Badge tone={mandateStageTone(c.toStage)}>{MANDATE_STAGE_LABELS[c.toStage]}</Badge>
                    </div>
                    <p className="mt-1 text-xs text-gray-500">
                      {c.changedBy?.name ?? "System"} · {formatDateTime(c.createdAt)}
                    </p>
                    {c.note && <p className="mt-1 rounded bg-gray-50 px-2 py-1 text-xs text-gray-700">{c.note}</p>}
                  </li>
                ))}
              </ol>
            </Card>
            <History entities={[{ type: "Mandate", id: m.id }]} title="Changes" />
          </div>
        </div>
      </PageBody>
    </>
  );
}
