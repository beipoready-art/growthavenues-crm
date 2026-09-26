-- CreateTable
CREATE TABLE "CompanyProfile" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "firmName" TEXT NOT NULL DEFAULT 'GrowthAvenues',
    "tagline" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "website" TEXT,
    "address" TEXT,
    "sebiRegistration" TEXT,
    "logoKey" TEXT,
    "logoMime" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedById" TEXT,

    CONSTRAINT "CompanyProfile_pkey" PRIMARY KEY ("id")
);
