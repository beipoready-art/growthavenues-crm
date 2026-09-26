import type { DocumentCategory, KycStatus } from "@prisma/client";
import type { Permission } from "@/lib/rbac";

export const KYC_STATUSES = ["PENDING", "SUBMITTED", "UNDER_REVIEW", "VERIFIED", "REJECTED"] as const satisfies readonly KycStatus[];

export const KYC_DOCUMENT_CATEGORIES = ["KYC_PAN", "KYC_AADHAAR", "KYC_BANK_PROOF", "KYC_PHOTO"] as const satisfies readonly DocumentCategory[];

/**
 * Allowed KYC transitions and who may perform them.
 * Pending → Submitted → Under Review → Verified / Rejected.
 * A rejected KYC can be corrected and resubmitted; a verified one can be
 * re-opened for review by compliance (e.g. documents expired).
 */
export const KYC_TRANSITIONS: { from: KycStatus; to: KycStatus; permission: Permission; label: string; requiresNote?: boolean }[] = [
  { from: "PENDING", to: "SUBMITTED", permission: "kyc:submit", label: "Submit for review" },
  { from: "REJECTED", to: "SUBMITTED", permission: "kyc:submit", label: "Resubmit" },
  { from: "SUBMITTED", to: "UNDER_REVIEW", permission: "kyc:review", label: "Start review" },
  { from: "UNDER_REVIEW", to: "VERIFIED", permission: "kyc:review", label: "Verify" },
  { from: "UNDER_REVIEW", to: "REJECTED", permission: "kyc:review", label: "Reject", requiresNote: true },
  { from: "VERIFIED", to: "UNDER_REVIEW", permission: "kyc:review", label: "Re-open review", requiresNote: true },
];

export function findTransition(from: KycStatus, to: KycStatus) {
  return KYC_TRANSITIONS.find((t) => t.from === from && t.to === to);
}

/** KYC documents can only change while the KYC is with the RM, not while compliance reviews it. */
export function kycDocsEditable(status: KycStatus) {
  return status === "PENDING" || status === "REJECTED";
}
