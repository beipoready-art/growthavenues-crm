import type { MandateStage, ServiceLine } from "@prisma/client";
import Link from "next/link";
import { EmptyState } from "@/components/layout";
import { Badge } from "@/components/ui";
import { formatDate, formatINR } from "@/lib/format";
import { MANDATE_STAGE_LABELS, mandateStageTone, SERVICE_SHORT_LABELS } from "@/lib/labels";
import { stageProgress } from "@/lib/mandates";

export type MandateListRow = {
  id: string;
  code: string;
  title: string;
  service: ServiceLine;
  stage: MandateStage;
  expectedFee: number | null;
  issueSizeCr: number | null;
  targetDate: Date | null;
  client?: { id: string; name: string };
  leadAdvisor?: { name: string } | null;
};

export function StageProgress({ service, stage }: { service: ServiceLine; stage: MandateStage }) {
  const pct = Math.round(stageProgress(service, stage) * 100);
  const paused = stage === "ON_HOLD" || stage === "DROPPED";
  return (
    <div className="h-1.5 w-full rounded-full bg-gray-100" title={`${pct}% through the ${SERVICE_SHORT_LABELS[service]} pipeline`}>
      <div className={`h-1.5 rounded-full ${paused ? "bg-gray-300" : "bg-gold-500"}`} style={{ width: `${Math.max(pct, 4)}%` }} />
    </div>
  );
}

export function MandateList({ mandates, showClient = false }: { mandates: MandateListRow[]; showClient?: boolean }) {
  if (mandates.length === 0) return <EmptyState title="No mandates yet" />;
  return (
    <ul className="divide-y divide-gray-100" data-testid="mandate-list">
      {mandates.map((m) => (
        <li key={m.id}>
          <Link href={`/mandates/${m.id}`} className="block px-5 py-3 hover:bg-gray-50">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-gray-900">
                  <span className="font-mono text-xs text-gray-400">{m.code}</span> {m.title}
                </p>
                <p className="text-xs text-gray-500">
                  {showClient && m.client ? `${m.client.name} · ` : ""}
                  {SERVICE_SHORT_LABELS[m.service]}
                  {m.issueSizeCr != null && ` · ₹${m.issueSizeCr} Cr`}
                  {m.targetDate && ` · target ${formatDate(m.targetDate)}`}
                  {m.leadAdvisor && ` · ${m.leadAdvisor.name}`}
                </p>
              </div>
              <div className="shrink-0 text-right">
                <Badge tone={mandateStageTone(m.stage)}>{MANDATE_STAGE_LABELS[m.stage]}</Badge>
                {m.expectedFee != null && <p className="mt-1 text-xs tabular-nums text-gray-600">{formatINR(m.expectedFee)}</p>}
              </div>
            </div>
            <div className="mt-2">
              <StageProgress service={m.service} stage={m.stage} />
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}
