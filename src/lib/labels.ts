import type {
  DocumentCategory,
  EntityType,
  InteractionType,
  IpoStatus,
  KycStatus,
  LeadSource,
  LeadStatus,
  ListingBoard,
  MandateStage,
  Role,
  ServiceLine,
  TaskPriority,
} from "@prisma/client";

export const ROLE_LABELS: Record<Role, string> = {
  ADMIN: "Admin",
  COMPLIANCE: "Compliance Officer",
  RM: "Relationship Manager",
  VIEWER: "Viewer",
};

export const ROLE_SHORT_LABELS: Record<Role, string> = {
  ADMIN: "Admin",
  COMPLIANCE: "Compliance",
  RM: "RM",
  VIEWER: "Viewer",
};

export const LEAD_SOURCE_LABELS: Record<LeadSource, string> = {
  WEBSITE: "Website enquiry",
  READINESS_CALL: "IPO readiness call",
  READINESS_CHECK: "IPO-ready check",
  REFERRAL: "Referral",
  EVENT: "Event / webinar",
  CALL_IN: "Call-in",
  OTHER: "Other",
};

export const LEAD_STATUS_LABELS: Record<LeadStatus, string> = {
  NEW: "New",
  CONTACTED: "Contacted",
  DISCOVERY: "Discovery call",
  QUALIFIED: "Qualified",
  CONVERTED: "Converted",
  LOST: "Lost",
};

export const SERVICE_LABELS: Record<ServiceLine, string> = {
  FUND_RAISING: "Fund Raising",
  PRE_IPO: "Pre-IPO Advisory",
  SME_IPO: "SME IPO Advisory",
  MAINBOARD_IPO: "Mainboard IPO",
  VALUATION_RESTRUCTURING: "Valuation & Corporate Restructuring",
};

export const SERVICE_SHORT_LABELS: Record<ServiceLine, string> = {
  FUND_RAISING: "Fund raising",
  PRE_IPO: "Pre-IPO",
  SME_IPO: "SME IPO",
  MAINBOARD_IPO: "Mainboard IPO",
  VALUATION_RESTRUCTURING: "Valuation",
};

export const ENTITY_TYPE_LABELS: Record<EntityType, string> = {
  PRIVATE_LIMITED: "Private Limited",
  PUBLIC_LIMITED: "Public Limited",
  LLP: "LLP",
  PARTNERSHIP: "Partnership",
  PROPRIETORSHIP: "Proprietorship",
  OTHER: "Other",
};

export const LISTING_BOARD_LABELS: Record<ListingBoard, string> = {
  NSE_EMERGE: "NSE Emerge",
  BSE_SME: "BSE SME",
  MAINBOARD: "Main Board",
  NOT_APPLICABLE: "Not applicable",
};

export const MANDATE_STAGE_LABELS: Record<MandateStage, string> = {
  PROPOSAL: "Proposal",
  MANDATE_SIGNED: "Mandate signed",
  DUE_DILIGENCE: "Due diligence",
  RESTRUCTURING: "Restructuring / readiness",
  DRHP_DRAFTING: "DRHP drafting",
  DRHP_FILED: "DRHP filed",
  OBSERVATIONS: "Exchange / SEBI observations",
  APPROVAL: "In-principle approval",
  RHP_FILED: "RHP filed",
  ROADSHOW: "Roadshow & anchors",
  ISSUE_OPEN: "Issue open",
  LISTED: "Listed",
  INVESTOR_OUTREACH: "Investor outreach",
  TERM_SHEET: "Term sheet",
  DOCUMENTATION: "Documentation",
  DRAFT_REPORT: "Draft report",
  COMPLETED: "Completed",
  ON_HOLD: "On hold",
  DROPPED: "Dropped",
};

export const KYC_STATUS_LABELS: Record<KycStatus, string> = {
  PENDING: "Pending",
  SUBMITTED: "Submitted",
  UNDER_REVIEW: "Under Review",
  VERIFIED: "Verified",
  REJECTED: "Rejected",
};

export const DOCUMENT_CATEGORY_LABELS: Record<DocumentCategory, string> = {
  KYC_COI: "Certificate of Incorporation",
  KYC_PAN: "Company PAN",
  KYC_GST: "GST Certificate",
  KYC_MOA_AOA: "MOA & AOA",
  KYC_BOARD_RESOLUTION: "Board Resolution",
  KYC_PROMOTER_KYC: "Promoter KYC",
  NDA: "NDA",
  PROPOSAL: "Proposal",
  ENGAGEMENT_LETTER: "Engagement / Mandate Letter",
  FINANCIALS: "Audited Financials",
  ITR: "Income Tax Returns",
  DUE_DILIGENCE: "Due Diligence Report",
  VALUATION_REPORT: "Valuation Report",
  PITCH_DECK: "Pitch Deck",
  DRHP: "DRHP",
  RHP: "RHP",
  OTHER: "Other",
};

export const IPO_STATUS_LABELS: Record<IpoStatus, string> = {
  UPCOMING: "Upcoming",
  OPEN: "Open",
  CLOSED: "Closed",
  LISTED: "Listed",
};

export const INTERACTION_TYPE_LABELS: Record<InteractionType, string> = {
  CALL: "Call",
  EMAIL: "Email",
  MEETING: "Meeting",
  WHATSAPP: "WhatsApp",
  NOTE: "Note",
};

export const TASK_PRIORITY_LABELS: Record<TaskPriority, string> = {
  HIGH: "High",
  MEDIUM: "Medium",
  LOW: "Low",
};

type Tone = "gray" | "blue" | "amber" | "green" | "red" | "violet";

export const LEAD_STATUS_TONE: Record<LeadStatus, Tone> = {
  NEW: "blue",
  CONTACTED: "violet",
  DISCOVERY: "violet",
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

export const TASK_PRIORITY_TONE: Record<TaskPriority, Tone> = {
  HIGH: "red",
  MEDIUM: "amber",
  LOW: "gray",
};

export function mandateStageTone(stage: MandateStage): Tone {
  if (stage === "LISTED" || stage === "COMPLETED") return "green";
  if (stage === "DROPPED") return "gray";
  if (stage === "ON_HOLD") return "red";
  if (stage === "PROPOSAL") return "blue";
  return "amber";
}

export function options<T extends string>(labels: Record<T, string>) {
  return (Object.keys(labels) as T[]).map((value) => ({ value, label: labels[value] }));
}
