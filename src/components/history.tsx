import type { Prisma } from "@prisma/client";
import { Card, EmptyState } from "@/components/layout";
import { formatDateTime, formatINR } from "@/lib/format";
import { CLIENT_TYPE_LABELS, DOCUMENT_CATEGORY_LABELS, IPO_APP_STATUS_LABELS, IPO_STATUS_LABELS, KYC_STATUS_LABELS, LEAD_SOURCE_LABELS, LEAD_STATUS_LABELS } from "@/lib/labels";
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
  clientType: "client type",
  kycStatus: "KYC status",
  companyName: "company",
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
  ...CLIENT_TYPE_LABELS,
  ...KYC_STATUS_LABELS,
  ...IPO_STATUS_LABELS,
  ...IPO_APP_STATUS_LABELS,
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
    const c = m?.assignedRmId;
    if (c) [c.from, c.to].forEach((v) => typeof v === "string" && ids.add(v));
  }
  const users = ids.size ? await prisma.user.findMany({ where: { id: { in: [...ids] } }, select: { id: true, name: true } }) : [];
  const names = Object.fromEntries(users.map((u) => [u.id, u.name]));

  const fmt = (field: string, v: unknown) => {
    if (v === null || v === undefined || v === "") return "none";
    if (field === "assignedRmId") return names[v as string] ?? "unknown user";
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
        return `created the ${noun}`;
      case "converted":
        return "converted the lead into a client";
      case "ipo_applied":
        return `logged an IPO application: ${m.ipo} · ${m.lots} lot(s) · ${formatINR(Number(m.amount))}`;
      case "application_logged":
        return `logged an application for ${m.client} · ${m.lots} lot(s) · ${formatINR(Number(m.amount))}`;
      case "ipo_application_updated": {
        const parts = Object.entries(m)
          .filter(([k]) => k in FIELD_LABELS)
          .map(([k, c]) => `${FIELD_LABELS[k]} ${fmt(k, (c as Change).from)} → ${fmt(k, (c as Change).to)}`);
        return `updated ${entityType === "Ipo" ? `${m.client}'s` : `the ${m.ipo}`} application${parts.length ? `: ${parts.join(", ")}` : ""}`;
      }
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
                  <span className="font-medium text-gray-900">{l.user?.name ?? "System"}</span>{" "}
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
