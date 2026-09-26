import type { Prisma } from "@prisma/client";
import { Card, EmptyState } from "@/components/layout";
import { formatDateTime, formatINR } from "@/lib/format";
import { DOCUMENT_CATEGORY_LABELS, ENTITY_TYPE_LABELS, IPO_STATUS_LABELS, LISTING_BOARD_LABELS, MANDATE_STAGE_LABELS, SERVICE_LABELS, KYC_STATUS_LABELS, LEAD_SOURCE_LABELS, LEAD_STATUS_LABELS } from "@/lib/labels";
import { prisma } from "@/lib/prisma";

const FIELD_LABELS: Record<string, string> = {
  name: "name",
  phone: "phone",
  email: "email",
  source: "source",
  status: "status",
  notes: "notes",
  assignedRmId: "assigned RM",
  panNumber: "PAN",
  entityType: "entity type",
  companyName: "company",
  designation: "designation",
  city: "city",
  state: "state",
  sector: "sector",
  serviceInterest: "service interest",
  cin: "CIN",
  gstin: "GSTIN",
  website: "website",
  incorporationYear: "incorporation year",
  financialYear: "financial year",
  revenueCr: "revenue (₹ Cr)",
  ebitdaCr: "EBITDA (₹ Cr)",
  patCr: "PAT (₹ Cr)",
  netWorthCr: "net worth (₹ Cr)",
  title: "title",
  service: "service",
  board: "board",
  stage: "stage",
  issueSizeCr: "issue size (₹ Cr)",
  retainerFee: "retainer",
  successFeePct: "success fee %",
  expectedFee: "expected fee",
  targetDate: "target date",
  leadAdvisorId: "lead advisor",
  kycStatus: "KYC status",
  symbol: "symbol",
  exchange: "exchange",
  priceBandLow: "price band low",
  priceBandHigh: "price band high",
  lotSize: "lot size",
  openDate: "open date",
  closeDate: "close date",
  listingDate: "listing date",
  lotsApplied: "lots applied",
  lotsAllotted: "lots allotted",
  amount: "amount",
};

const VALUE_LABELS: Record<string, string> = {
  ...LEAD_STATUS_LABELS,
  ...LEAD_SOURCE_LABELS,
  ...ENTITY_TYPE_LABELS,
  ...SERVICE_LABELS,
  ...LISTING_BOARD_LABELS,
  ...MANDATE_STAGE_LABELS,
  ...KYC_STATUS_LABELS,
  ...IPO_STATUS_LABELS,
};

type Change = { from: unknown; to: unknown };

/** Human-readable activity history for any entity recorded in AuditLog. */
export async function History({ entities, title = "History" }: { entities: { type: string; id: string }[]; title?: string }) {
  const logs = await prisma.auditLog.findMany({
    where: { OR: entities.map((e) => ({ entityType: e.type, entityId: e.id })) },
    include: { user: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  // Resolve user ids that appear in "assigned RM" changes.
  const ids = new Set<string>();
  for (const l of logs) {
    const m = l.metadata as Record<string, Change> | null;
    const c = m?.assignedRmId ?? m?.leadAdvisorId;
    if (c) [c.from, c.to].forEach((v) => typeof v === "string" && ids.add(v));
    const to = (l.metadata as Record<string, unknown> | null)?.to;
    if (typeof to === "string") ids.add(to);
  }
  const users = ids.size ? await prisma.user.findMany({ where: { id: { in: [...ids] } }, select: { id: true, name: true } }) : [];
  const names = Object.fromEntries(users.map((u) => [u.id, u.name]));

  const fmt = (field: string, v: unknown) => {
    if (v === null || v === undefined || v === "") return "none";
    if (field === "assignedRmId" || field === "leadAdvisorId") return names[v as string] ?? "unknown user";
    if (field === "retainerFee" || field === "expectedFee") return formatINR(Number(v));
    if (field === "notes") return "…";
    if (field === "amount") return formatINR(Number(v));
    if (typeof v === "string" && /^\d{4}-\d{2}-\d{2}T00:00:00.000Z$/.test(v)) return v.slice(0, 10);
    return VALUE_LABELS[v as string] ?? String(v);
  };

  function describe(entityType: string, action: string, metadata: Prisma.JsonValue) {
    const m = (metadata ?? {}) as Record<string, unknown>;
    const noun = entityType === "Ipo" ? "IPO" : entityType.toLowerCase();
    switch (action) {
      case "created":
        return m.via === "website" ? `received this enquiry from the website (${String(m.type).replace("_", " ")})` : `created the ${noun}`;
      case "website_resubmission":
        return `submitted the website form again (${String(m.type).replace("_", " ")})`;
      case "converted":
        return "converted the lead into a client";
      case "mandate_created":
        return `opened mandate ${m.code} — ${m.title}`;
      case "meeting_scheduled":
        return `scheduled a meeting: ${m.title}`;
      case "meeting_cancelled":
        return `cancelled the meeting "${m.title}"${m.reason ? ` — ${m.reason}` : ""}`;
      case "contact_added":
        return `added contact ${m.name}`;
      case "contact_removed":
        return `removed contact ${m.name}`;
      case "contact_updated":
        return `updated contact ${m.contact}`;
      case "book_reassigned":
        return `reassigned this RM's book (${m.leads} leads, ${m.clients} clients, ${m.tasks} tasks) to ${names[m.to as string] ?? "another RM"}`;
      case "document_uploaded":
        return `uploaded ${m.category ? (DOCUMENT_CATEGORY_LABELS[m.category as keyof typeof DOCUMENT_CATEGORY_LABELS] ?? "a document") : "a document"} (${m.fileName ?? "file"}${Number(m.version) > 1 ? `, version ${m.version}` : ""})`;
      case "deleted":
        return `deleted the ${noun}`;
      case "status_changed":
      case "updated":
      case "reassigned": {
        const parts = Object.entries(m)
          .filter(([k]) => k in FIELD_LABELS)
          .map(([k, c]) => `${FIELD_LABELS[k]} ${fmt(k, (c as Change).from)} → ${fmt(k, (c as Change).to)}`);
        return parts.length ? `changed ${parts.join(", ")}` : `updated the ${noun}`;
      }
      default:
        return action.replace(/_/g, " ");
    }
  }

  return (
    <Card title={title}>
      {logs.length === 0 ? (
        <EmptyState title="No activity yet" />
      ) : (
        <ol className="space-y-3 px-5 py-4">
          {logs.map((l) => (
            <li key={l.id} className="flex gap-3 text-sm">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-gray-300" />
              <div>
                <p className="text-gray-700">
                  <span className="font-medium text-gray-900">{l.user?.name ?? ((l.metadata as Record<string, unknown> | null)?.via === "website" || l.action === "website_resubmission" ? "Website" : "System")}</span>{" "}
                  {entities.length > 1 && <span className="text-gray-400">[{l.entityType}] </span>}
                  {describe(l.entityType, l.action, l.metadata)}
                </p>
                <p className="text-xs text-gray-400">{formatDateTime(l.createdAt)}</p>
              </div>
            </li>
          ))}
        </ol>
      )}
    </Card>
  );
}
