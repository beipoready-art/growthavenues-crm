import type { ClientType, DocumentCategory, IpoApplicationStatus, IpoStatus, KycStatus, LeadSource, LeadStatus, Role } from "@prisma/client";

export const ROLE_LABELS: Record<Role, string> = {
  ADMIN: "Admin",
  COMPLIANCE: "Compliance Officer",
  RM: "Relationship Manager",
  VIEWER: "Viewer",
};

export const LEAD_SOURCE_LABELS: Record<LeadSource, string> = {
  REFERRAL: "Referral",
  WEBSITE: "Website",
  CALL_IN: "Call-in",
  OTHER: "Other",
};

export const LEAD_STATUS_LABELS: Record<LeadStatus, string> = {
  NEW: "New",
  CONTACTED: "Contacted",
  QUALIFIED: "Qualified",
  CONVERTED: "Converted",
  LOST: "Lost",
};

export const CLIENT_TYPE_LABELS: Record<ClientType, string> = {
  INDIVIDUAL: "Individual",
  HUF: "HUF",
  CORPORATE: "Corporate",
};

export const KYC_STATUS_LABELS: Record<KycStatus, string> = {
  PENDING: "Pending",
  SUBMITTED: "Submitted",
  UNDER_REVIEW: "Under Review",
  VERIFIED: "Verified",
  REJECTED: "Rejected",
};

export const DOCUMENT_CATEGORY_LABELS: Record<DocumentCategory, string> = {
  KYC_PAN: "PAN Card",
  KYC_AADHAAR: "Aadhaar",
  KYC_BANK_PROOF: "Bank Proof",
  KYC_PHOTO: "Photograph",
  OTHER: "Other",
};

export const IPO_STATUS_LABELS: Record<IpoStatus, string> = {
  UPCOMING: "Upcoming",
  OPEN: "Open",
  CLOSED: "Closed",
  LISTED: "Listed",
};

export const IPO_APP_STATUS_LABELS: Record<IpoApplicationStatus, string> = {
  APPLIED: "Applied",
  ALLOTTED: "Allotted",
  PARTIALLY_ALLOTTED: "Partially Allotted",
  REJECTED: "Rejected",
  REFUNDED: "Refunded",
};

type Tone = "gray" | "blue" | "amber" | "green" | "red" | "violet";

export const LEAD_STATUS_TONE: Record<LeadStatus, Tone> = {
  NEW: "blue",
  CONTACTED: "violet",
  QUALIFIED: "amber",
  CONVERTED: "green",
  LOST: "gray",
};

export const KYC_STATUS_TONE: Record<KycStatus, Tone> = {
  PENDING: "gray",
  SUBMITTED: "blue",
  UNDER_REVIEW: "amber",
  VERIFIED: "green",
  REJECTED: "red",
};

export const ROLE_TONE: Record<Role, Tone> = {
  ADMIN: "violet",
  COMPLIANCE: "amber",
  RM: "blue",
  VIEWER: "gray",
};

export const IPO_STATUS_TONE: Record<IpoStatus, Tone> = {
  UPCOMING: "blue",
  OPEN: "green",
  CLOSED: "amber",
  LISTED: "gray",
};

export const IPO_APP_STATUS_TONE: Record<IpoApplicationStatus, Tone> = {
  APPLIED: "blue",
  ALLOTTED: "green",
  PARTIALLY_ALLOTTED: "violet",
  REJECTED: "red",
  REFUNDED: "gray",
};

export function options<T extends string>(labels: Record<T, string>) {
  return (Object.keys(labels) as T[]).map((value) => ({ value, label: labels[value] }));
}
