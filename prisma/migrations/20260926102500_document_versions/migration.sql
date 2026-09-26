-- New document categories (Phase 2 document management)
ALTER TYPE "DocumentCategory" ADD VALUE 'CONTRACT_NOTE';
ALTER TYPE "DocumentCategory" ADD VALUE 'RISK_DISCLOSURE';
ALTER TYPE "DocumentCategory" ADD VALUE 'APPLICATION_FORM';

-- Versioning columns. groupId is added nullable, backfilled, then made required.
ALTER TABLE "Document" ADD COLUMN "groupId" TEXT,
ADD COLUMN "isLatest" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "notes" TEXT,
ADD COLUMN "title" TEXT,
ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1;

-- Backfill: existing uploads of the same client + category were re-uploads
-- (KYC "replace"), so chain them as versions of one document, oldest first.
WITH ranked AS (
  SELECT
    id,
    FIRST_VALUE(id) OVER w AS group_id,
    ROW_NUMBER() OVER w AS version,
    ROW_NUMBER() OVER (PARTITION BY "clientId", category ORDER BY "createdAt" DESC, id DESC) = 1 AS is_latest
  FROM "Document"
  WINDOW w AS (PARTITION BY "clientId", category ORDER BY "createdAt", id)
)
UPDATE "Document" d
SET "groupId" = r.group_id, "version" = r.version, "isLatest" = r.is_latest
FROM ranked r
WHERE d.id = r.id;

ALTER TABLE "Document" ALTER COLUMN "groupId" SET NOT NULL;

-- CreateIndex
CREATE INDEX "Document_clientId_isLatest_idx" ON "Document"("clientId", "isLatest");

-- CreateIndex
CREATE UNIQUE INDEX "Document_groupId_version_key" ON "Document"("groupId", "version");
