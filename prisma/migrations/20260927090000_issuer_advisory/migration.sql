-- CreateEnum
CREATE TYPE "ServiceLine" AS ENUM ('FUND_RAISING', 'PRE_IPO', 'SME_IPO', 'MAINBOARD_IPO', 'VALUATION_RESTRUCTURING');

-- CreateEnum
CREATE TYPE "EntityType" AS ENUM ('PRIVATE_LIMITED', 'PUBLIC_LIMITED', 'LLP', 'PARTNERSHIP', 'PROPRIETORSHIP', 'OTHER');

-- CreateEnum
CREATE TYPE "ListingBoard" AS ENUM ('NSE_EMERGE', 'BSE_SME', 'MAINBOARD', 'NOT_APPLICABLE');

-- CreateEnum
CREATE TYPE "MandateStage" AS ENUM ('PROPOSAL', 'MANDATE_SIGNED', 'DUE_DILIGENCE', 'RESTRUCTURING', 'DRHP_DRAFTING', 'DRHP_FILED', 'OBSERVATIONS', 'APPROVAL', 'RHP_FILED', 'ROADSHOW', 'ISSUE_OPEN', 'LISTED', 'INVESTOR_OUTREACH', 'TERM_SHEET', 'DOCUMENTATION', 'DRAFT_REPORT', 'COMPLETED', 'ON_HOLD', 'DROPPED');

-- AlterEnum
BEGIN;
CREATE TYPE "DocumentCategory_new" AS ENUM ('KYC_COI', 'KYC_PAN', 'KYC_GST', 'KYC_MOA_AOA', 'KYC_BOARD_RESOLUTION', 'KYC_PROMOTER_KYC', 'NDA', 'PROPOSAL', 'ENGAGEMENT_LETTER', 'FINANCIALS', 'ITR', 'DUE_DILIGENCE', 'VALUATION_REPORT', 'PITCH_DECK', 'DRHP', 'RHP', 'OTHER');
-- Map retail-investor document categories onto the company ones.
ALTER TABLE "Document" ALTER COLUMN "category" TYPE "DocumentCategory_new" USING (
  CASE "category"::text
    WHEN 'KYC_AADHAAR' THEN 'KYC_PROMOTER_KYC'
    WHEN 'KYC_PHOTO' THEN 'KYC_PROMOTER_KYC'
    WHEN 'KYC_BANK_PROOF' THEN 'OTHER'
    WHEN 'CONTRACT_NOTE' THEN 'OTHER'
    WHEN 'RISK_DISCLOSURE' THEN 'OTHER'
    WHEN 'APPLICATION_FORM' THEN 'OTHER'
    ELSE "category"::text
  END::"DocumentCategory_new"
);
ALTER TYPE "DocumentCategory" RENAME TO "DocumentCategory_old";
ALTER TYPE "DocumentCategory_new" RENAME TO "DocumentCategory";
DROP TYPE "public"."DocumentCategory_old";
COMMIT;

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "LeadSource" ADD VALUE 'READINESS_CALL';
ALTER TYPE "LeadSource" ADD VALUE 'READINESS_CHECK';
ALTER TYPE "LeadSource" ADD VALUE 'EVENT';

-- AlterEnum
ALTER TYPE "LeadStatus" ADD VALUE 'DISCOVERY';

-- IPO-closing alerts were for retail applications, which no longer exist.
DELETE FROM "Notification" WHERE "type"::text = 'IPO_CLOSING';

-- AlterEnum
BEGIN;
CREATE TYPE "NotificationType_new" AS ENUM ('KYC_STATUS', 'LEAD_ASSIGNED', 'CLIENT_ASSIGNED', 'TASK_ASSIGNED', 'TASK_DUE', 'MANDATE_STAGE', 'MANDATE_DUE');
ALTER TABLE "Notification" ALTER COLUMN "type" TYPE "NotificationType_new" USING ("type"::text::"NotificationType_new");
ALTER TYPE "NotificationType" RENAME TO "NotificationType_old";
ALTER TYPE "NotificationType_new" RENAME TO "NotificationType";
DROP TYPE "public"."NotificationType_old";
COMMIT;

-- DropForeignKey
ALTER TABLE "IpoApplication" DROP CONSTRAINT "IpoApplication_clientId_fkey";

-- DropForeignKey
ALTER TABLE "IpoApplication" DROP CONSTRAINT "IpoApplication_createdById_fkey";

-- DropForeignKey
ALTER TABLE "IpoApplication" DROP CONSTRAINT "IpoApplication_ipoId_fkey";

-- DropForeignKey
ALTER TABLE "IpoInterest" DROP CONSTRAINT "IpoInterest_clientId_fkey";

-- DropForeignKey
ALTER TABLE "IpoInterest" DROP CONSTRAINT "IpoInterest_createdById_fkey";

-- DropForeignKey
ALTER TABLE "IpoInterest" DROP CONSTRAINT "IpoInterest_ipoId_fkey";

-- AlterTable
ALTER TABLE "Client" DROP COLUMN "clientType",
ADD COLUMN     "cin" TEXT,
ADD COLUMN     "city" TEXT,
ADD COLUMN     "ebitdaCr" DECIMAL(14,2),
ADD COLUMN     "entityType" "EntityType" NOT NULL DEFAULT 'PRIVATE_LIMITED',
ADD COLUMN     "financialYear" TEXT,
ADD COLUMN     "gstin" TEXT,
ADD COLUMN     "incorporationYear" INTEGER,
ADD COLUMN     "netWorthCr" DECIMAL(14,2),
ADD COLUMN     "patCr" DECIMAL(14,2),
ADD COLUMN     "revenueCr" DECIMAL(14,2),
ADD COLUMN     "sector" TEXT,
ADD COLUMN     "state" TEXT,
ADD COLUMN     "website" TEXT,
ALTER COLUMN "phone" DROP NOT NULL;

-- AlterTable
ALTER TABLE "CompanyProfile" ALTER COLUMN "firmName" SET DEFAULT 'Be IPO Ready';

-- AlterTable
ALTER TABLE "Document" ADD COLUMN     "mandateId" TEXT;

-- AlterTable
ALTER TABLE "Lead" ADD COLUMN     "city" TEXT,
ADD COLUMN     "companyName" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "designation" TEXT,
ADD COLUMN     "readinessAnswers" JSONB,
ADD COLUMN     "readinessScore" INTEGER,
ADD COLUMN     "revenueCr" DECIMAL(14,2),
ADD COLUMN     "sector" TEXT,
ADD COLUMN     "serviceInterest" "ServiceLine";

-- Existing leads: use the contact name as the company name until edited.
UPDATE "Lead" SET "companyName" = "name" WHERE "companyName" = '';
ALTER TABLE "Lead" ALTER COLUMN "companyName" DROP DEFAULT;

-- DropTable
DROP TABLE "IpoApplication";

-- DropTable
DROP TABLE "IpoInterest";

-- DropEnum
DROP TYPE "ClientType";

-- DropEnum
DROP TYPE "IpoApplicationStatus";

-- CreateTable
CREATE TABLE "Contact" (
    "id" TEXT NOT NULL,
    "clientId" TEXT,
    "leadId" TEXT,
    "name" TEXT NOT NULL,
    "designation" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Contact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Mandate" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "service" "ServiceLine" NOT NULL,
    "board" "ListingBoard" NOT NULL DEFAULT 'NOT_APPLICABLE',
    "stage" "MandateStage" NOT NULL DEFAULT 'PROPOSAL',
    "stageChangedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "issueSizeCr" DECIMAL(14,2),
    "retainerFee" DECIMAL(14,2),
    "successFeePct" DECIMAL(5,2),
    "expectedFee" DECIMAL(14,2),
    "targetDate" DATE,
    "signedAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "notes" TEXT,
    "leadAdvisorId" TEXT,
    "ipoId" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Mandate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MandateStageChange" (
    "id" TEXT NOT NULL,
    "mandateId" TEXT NOT NULL,
    "fromStage" "MandateStage",
    "toStage" "MandateStage" NOT NULL,
    "note" TEXT,
    "changedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MandateStageChange_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Contact_clientId_idx" ON "Contact"("clientId");

-- CreateIndex
CREATE INDEX "Contact_leadId_idx" ON "Contact"("leadId");

-- CreateIndex
CREATE INDEX "Contact_email_idx" ON "Contact"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Mandate_code_key" ON "Mandate"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Mandate_ipoId_key" ON "Mandate"("ipoId");

-- CreateIndex
CREATE INDEX "Mandate_stage_idx" ON "Mandate"("stage");

-- CreateIndex
CREATE INDEX "Mandate_clientId_idx" ON "Mandate"("clientId");

-- CreateIndex
CREATE INDEX "Mandate_leadAdvisorId_idx" ON "Mandate"("leadAdvisorId");

-- CreateIndex
CREATE INDEX "MandateStageChange_mandateId_createdAt_idx" ON "MandateStageChange"("mandateId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Client_cin_key" ON "Client"("cin");

-- AddForeignKey
ALTER TABLE "Contact" ADD CONSTRAINT "Contact_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contact" ADD CONSTRAINT "Contact_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_mandateId_fkey" FOREIGN KEY ("mandateId") REFERENCES "Mandate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Mandate" ADD CONSTRAINT "Mandate_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Mandate" ADD CONSTRAINT "Mandate_leadAdvisorId_fkey" FOREIGN KEY ("leadAdvisorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Mandate" ADD CONSTRAINT "Mandate_ipoId_fkey" FOREIGN KEY ("ipoId") REFERENCES "Ipo"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Mandate" ADD CONSTRAINT "Mandate_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MandateStageChange" ADD CONSTRAINT "MandateStageChange_mandateId_fkey" FOREIGN KEY ("mandateId") REFERENCES "Mandate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MandateStageChange" ADD CONSTRAINT "MandateStageChange_changedById_fkey" FOREIGN KEY ("changedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- A contact belongs to exactly one lead or one client.
ALTER TABLE "Contact"
  ADD CONSTRAINT "Contact_exactly_one_parent"
  CHECK ((("leadId" IS NOT NULL)::int + ("clientId" IS NOT NULL)::int) = 1);
