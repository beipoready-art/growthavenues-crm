-- CreateEnum
CREATE TYPE "IpoApplicationStatus" AS ENUM ('APPLIED', 'ALLOTTED', 'PARTIALLY_ALLOTTED', 'REJECTED', 'REFUNDED');

-- CreateTable
CREATE TABLE "IpoApplication" (
    "id" TEXT NOT NULL,
    "ipoId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "lotsApplied" INTEGER NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "applicationDate" DATE NOT NULL,
    "status" "IpoApplicationStatus" NOT NULL DEFAULT 'APPLIED',
    "lotsAllotted" INTEGER,
    "notes" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IpoApplication_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "IpoApplication_clientId_idx" ON "IpoApplication"("clientId");

-- CreateIndex
CREATE INDEX "IpoApplication_status_idx" ON "IpoApplication"("status");

-- CreateIndex
CREATE UNIQUE INDEX "IpoApplication_ipoId_clientId_key" ON "IpoApplication"("ipoId", "clientId");

-- AddForeignKey
ALTER TABLE "IpoApplication" ADD CONSTRAINT "IpoApplication_ipoId_fkey" FOREIGN KEY ("ipoId") REFERENCES "Ipo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IpoApplication" ADD CONSTRAINT "IpoApplication_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IpoApplication" ADD CONSTRAINT "IpoApplication_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
