import { csvDate, csvResponse, toCsv } from "@/lib/csv";
import { LISTING_BOARD_LABELS, MANDATE_STAGE_LABELS, SERVICE_LABELS } from "@/lib/labels";
import { mandateWhere } from "@/lib/mandates";
import { prisma } from "@/lib/prisma";
import { handle, requireApiUser } from "@/lib/session";

/** Mandate pipeline export. Accepts the Mandates page filters (default: all mandates). */
export async function GET(req: Request) {
  return handle(async () => {
    const user = await requireApiUser("reports:view");
    const sp = new URL(req.url).searchParams;
    if (!sp.get("status")) sp.set("status", "all");
    const mandates = await prisma.mandate.findMany({
      where: mandateWhere(user, sp),
      include: { client: { select: { name: true, sector: true } }, leadAdvisor: { select: { name: true } } },
      orderBy: { code: "asc" },
    });
    const csv = toCsv(
      ["Code", "Mandate", "Client", "Sector", "Service", "Board", "Stage", "Stage since", "Issue size (INR Cr)", "Retainer (INR)", "Success fee %", "Expected fee (INR)", "Target date", "Signed", "Closed", "Lead advisor"],
      mandates.map((m) => [
        m.code,
        m.title,
        m.client.name,
        m.client.sector,
        SERVICE_LABELS[m.service],
        LISTING_BOARD_LABELS[m.board],
        MANDATE_STAGE_LABELS[m.stage],
        csvDate(m.stageChangedAt),
        m.issueSizeCr?.toString(),
        m.retainerFee?.toString(),
        m.successFeePct?.toString(),
        m.expectedFee?.toString(),
        csvDate(m.targetDate),
        csvDate(m.signedAt),
        csvDate(m.closedAt),
        m.leadAdvisor?.name,
      ]),
    );
    return csvResponse("mandate-pipeline", csv);
  });
}
