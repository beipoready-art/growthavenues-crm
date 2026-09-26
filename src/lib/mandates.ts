import type { ListingBoard, MandateStage, Prisma, ServiceLine } from "@prisma/client";
import { z } from "zod";
import { enumParam, param, type SearchParams } from "@/lib/filters";
import { SERVICE_LINES } from "@/lib/leads";
import { prisma } from "@/lib/prisma";
import { ownsRecord } from "@/lib/rbac";
import { HttpError, type CurrentUser } from "@/lib/session";
import { zonedParts } from "@/lib/tz";
import { optionalCrore, optionalId, optionalText } from "@/lib/validation";

export const MANDATE_STAGES = [
  "PROPOSAL",
  "MANDATE_SIGNED",
  "DUE_DILIGENCE",
  "RESTRUCTURING",
  "DRHP_DRAFTING",
  "DRHP_FILED",
  "OBSERVATIONS",
  "APPROVAL",
  "RHP_FILED",
  "ROADSHOW",
  "ISSUE_OPEN",
  "LISTED",
  "INVESTOR_OUTREACH",
  "TERM_SHEET",
  "DOCUMENTATION",
  "DRAFT_REPORT",
  "COMPLETED",
  "ON_HOLD",
  "DROPPED",
] as const satisfies readonly MandateStage[];

export const LISTING_BOARDS = ["NSE_EMERGE", "BSE_SME", "MAINBOARD", "NOT_APPLICABLE"] as const satisfies readonly ListingBoard[];

const IPO_PIPELINE: MandateStage[] = [
  "PROPOSAL",
  "MANDATE_SIGNED",
  "DUE_DILIGENCE",
  "RESTRUCTURING",
  "DRHP_DRAFTING",
  "DRHP_FILED",
  "OBSERVATIONS",
  "APPROVAL",
  "RHP_FILED",
  "ROADSHOW",
  "ISSUE_OPEN",
  "LISTED",
];

/** Ordered stages for each service; the last stage is the successful close. */
export const PIPELINES: Record<ServiceLine, MandateStage[]> = {
  SME_IPO: IPO_PIPELINE,
  MAINBOARD_IPO: IPO_PIPELINE,
  PRE_IPO: ["PROPOSAL", "MANDATE_SIGNED", "DUE_DILIGENCE", "RESTRUCTURING", "INVESTOR_OUTREACH", "TERM_SHEET", "COMPLETED"],
  FUND_RAISING: ["PROPOSAL", "MANDATE_SIGNED", "DUE_DILIGENCE", "INVESTOR_OUTREACH", "TERM_SHEET", "DOCUMENTATION", "COMPLETED"],
  VALUATION_RESTRUCTURING: ["PROPOSAL", "MANDATE_SIGNED", "DUE_DILIGENCE", "DRAFT_REPORT", "COMPLETED"],
};

export const PAUSED_STAGES: MandateStage[] = ["ON_HOLD", "DROPPED"];
export const WON_STAGES: MandateStage[] = ["LISTED", "COMPLETED"];
export const CLOSED_STAGES: MandateStage[] = [...WON_STAGES, "DROPPED"];

/** Board columns for the pipeline view (active stages in a sensible cross-service order). */
export const BOARD_COLUMNS: { key: string; label: string; stages: MandateStage[] }[] = [
  { key: "proposal", label: "Proposal", stages: ["PROPOSAL"] },
  { key: "signed", label: "Mandate signed", stages: ["MANDATE_SIGNED"] },
  { key: "dd", label: "Due diligence & readiness", stages: ["DUE_DILIGENCE", "RESTRUCTURING", "DRAFT_REPORT"] },
  { key: "drhp", label: "DRHP", stages: ["DRHP_DRAFTING", "DRHP_FILED", "OBSERVATIONS"] },
  { key: "approval", label: "Approval & RHP", stages: ["APPROVAL", "RHP_FILED"] },
  { key: "raise", label: "Raising / issue", stages: ["ROADSHOW", "ISSUE_OPEN", "INVESTOR_OUTREACH", "TERM_SHEET", "DOCUMENTATION"] },
  { key: "won", label: "Listed / completed", stages: ["LISTED", "COMPLETED"] },
];

export function defaultBoard(service: ServiceLine): ListingBoard {
  if (service === "SME_IPO") return "NSE_EMERGE";
  if (service === "MAINBOARD_IPO") return "MAINBOARD";
  return "NOT_APPLICABLE";
}

/** Stages a mandate may move to from its current stage (any pipeline step, plus hold/drop/resume). */
export function allowedNextStages(service: ServiceLine, current: MandateStage, lastActiveStage?: MandateStage | null): MandateStage[] {
  const pipeline = PIPELINES[service];
  if (current === "DROPPED") return lastActiveStage ? [lastActiveStage] : ["PROPOSAL"];
  if (current === "ON_HOLD") return [...(lastActiveStage ? [lastActiveStage] : pipeline.slice(0, 1)), "DROPPED"];
  if (WON_STAGES.includes(current)) return [];
  // Forward or backward along the pipeline (corrections happen), or pause.
  return [...pipeline.filter((s) => s !== current), "ON_HOLD", "DROPPED"];
}

/** Progress 0–1 along the service's pipeline (for bars and weighted pipeline value). */
export function stageProgress(service: ServiceLine, stage: MandateStage) {
  const p = PIPELINES[service];
  const i = p.indexOf(stage);
  if (i < 0) return 0;
  return i / (p.length - 1);
}

/** Retainer + success fee on the target size. */
export function estimateFee(issueSizeCr: number | null, retainerFee: number | null, successFeePct: number | null) {
  const success = issueSizeCr != null && successFeePct != null ? issueSizeCr * 1e7 * (successFeePct / 100) : 0;
  const total = (retainerFee ?? 0) + success;
  return total > 0 ? Math.round(total) : null;
}

/** Next human-readable code, e.g. BIR-2026-007. */
export async function nextMandateCode(db: Prisma.TransactionClient | typeof prisma, now = new Date()) {
  const year = zonedParts(now).year;
  const prefix = `BIR-${year}-`;
  const last = await db.mandate.findFirst({ where: { code: { startsWith: prefix } }, orderBy: { code: "desc" }, select: { code: true } });
  const n = last ? Number(last.code.slice(prefix.length)) + 1 : 1;
  return `${prefix}${String(n).padStart(3, "0")}`;
}

// ─── Validation ────────────────────────────────────────────────────────────

const optionalDate = z
  .union([z.literal(""), z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Enter a valid date")])
  .optional()
  .nullable()
  .transform((v) => (v ? new Date(v + "T00:00:00Z") : null));
const optionalPct = z
  .union([z.literal(""), z.coerce.number().min(0, "Must be ≥ 0").max(100, "Must be ≤ 100")])
  .optional()
  .nullable()
  .transform((v) => (v === "" || v === undefined || v === null ? null : Number(v)));
const optionalRupees = z
  .union([z.literal(""), z.coerce.number().min(0, "Must be ≥ 0").max(1e11)])
  .optional()
  .nullable()
  .transform((v) => (v === "" || v === undefined || v === null ? null : Math.round(Number(v))));

const mandateFields = {
  title: z.string().trim().min(3, "Give the mandate a title").max(200),
  service: z.enum(SERVICE_LINES),
  board: z.enum(LISTING_BOARDS).optional(),
  issueSizeCr: optionalCrore,
  retainerFee: optionalRupees,
  successFeePct: optionalPct,
  targetDate: optionalDate,
  notes: optionalText(),
  leadAdvisorId: optionalId,
  ipoId: optionalId, // link the issue record once the IPO is announced
};

export const mandateCreateSchema = z.object({ ...mandateFields, clientId: z.string().min(1) });
export const mandateUpdateSchema = z.object(mandateFields).partial();
export const stageChangeSchema = z.object({ toStage: z.enum(MANDATE_STAGES), note: optionalText(1000) });

// ─── Queries ───────────────────────────────────────────────────────────────

export const mandateInclude = {
  client: { select: { id: true, name: true, assignedRmId: true, assignedRm: { select: { name: true } } } },
  leadAdvisor: { select: { id: true, name: true } },
} as const satisfies Prisma.MandateInclude;

/** RMs see mandates of their own clients or ones they lead. */
export function mandateScope(user: CurrentUser): Prisma.MandateWhereInput {
  return user.role === "RM" ? { OR: [{ client: { assignedRmId: user.id } }, { leadAdvisorId: user.id }] } : {};
}

export function mandateWhere(user: CurrentUser, sp: SearchParams | URLSearchParams): Prisma.MandateWhereInput {
  const q = param(sp, "q");
  const view = param(sp, "status"); // active | won | paused | all
  const where: Prisma.MandateWhereInput = {
    AND: [
      mandateScope(user),
      { service: enumParam(sp, "service", SERVICE_LINES), stage: enumParam(sp, "stage", MANDATE_STAGES) },
      view === "won" ? { stage: { in: WON_STAGES } } : view === "paused" ? { stage: { in: PAUSED_STAGES } } : view === "all" ? {} : { stage: { notIn: [...CLOSED_STAGES, "ON_HOLD"] } },
      param(sp, "advisor") ? { leadAdvisorId: param(sp, "advisor") } : {},
      q ? { OR: [{ title: { contains: q, mode: "insensitive" } }, { code: { contains: q, mode: "insensitive" } }, { client: { name: { contains: q, mode: "insensitive" } } }] } : {},
    ],
  };
  return where;
}

export function canSeeMandate(user: CurrentUser, m: { leadAdvisorId: string | null; client: { assignedRmId: string | null } }) {
  return ownsRecord(user, m.client) || m.leadAdvisorId === user.id;
}

export async function loadMandateForUser(user: CurrentUser, id: string) {
  const m = await prisma.mandate.findUnique({ where: { id }, include: mandateInclude });
  if (!m || !canSeeMandate(user, m)) throw new HttpError(404, "Mandate not found");
  return m;
}

/** The last non-paused stage in a mandate's history (for resume from hold). */
export async function lastActiveStage(mandateId: string) {
  const change = await prisma.mandateStageChange.findFirst({
    where: { mandateId, toStage: { notIn: PAUSED_STAGES } },
    orderBy: { createdAt: "desc" },
    select: { toStage: true },
  });
  return change?.toStage ?? null;
}
