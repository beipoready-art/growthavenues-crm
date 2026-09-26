-- CreateEnum
CREATE TYPE "IpoStatus" AS ENUM ('UPCOMING', 'OPEN', 'CLOSED', 'LISTED');

-- CreateTable
CREATE TABLE "Ipo" (
    "id" TEXT NOT NULL,
    "companyName" TEXT NOT NULL,
    "symbol" TEXT,
    "exchange" TEXT,
    "priceBandLow" DECIMAL(12,2) NOT NULL,
    "priceBandHigh" DECIMAL(12,2) NOT NULL,
    "lotSize" INTEGER NOT NULL,
    "openDate" DATE NOT NULL,
    "closeDate" DATE NOT NULL,
    "listingDate" DATE,
    "status" "IpoStatus" NOT NULL DEFAULT 'UPCOMING',
    "notes" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Ipo_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Ipo_status_idx" ON "Ipo"("status");

-- CreateIndex
CREATE INDEX "Ipo_openDate_idx" ON "Ipo"("openDate");

-- AddForeignKey
ALTER TABLE "Ipo" ADD CONSTRAINT "Ipo_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
