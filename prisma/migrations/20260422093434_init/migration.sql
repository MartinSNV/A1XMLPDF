-- CreateEnum
CREATE TYPE "FormType" AS ENUM ('PD_A1', 'UPLATNITELNA_LEGISLATIVA');

-- CreateEnum
CREATE TYPE "BundleStatus" AS ENUM ('DRAFT', 'GENERATED', 'SUBMITTED');

-- CreateTable
CREATE TABLE "DocumentBundle" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "formType" "FormType" NOT NULL,
    "status" "BundleStatus" NOT NULL DEFAULT 'DRAFT',
    "ico" TEXT NOT NULL,
    "companyName" TEXT NOT NULL,
    "xmlContent" TEXT NOT NULL,
    "pdfPath" TEXT,
    "metadata" JSONB,

    CONSTRAINT "DocumentBundle_pkey" PRIMARY KEY ("id")
);
