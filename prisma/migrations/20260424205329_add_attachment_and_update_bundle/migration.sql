/*
  Warnings:

  - The values [DRAFT,GENERATED] on the enum `BundleStatus` will be removed. If these variants are still used in the database, this will fail.
  - You are about to drop the column `metadata` on the `DocumentBundle` table. All the data in the column will be lost.
  - You are about to drop the column `pdfPath` on the `DocumentBundle` table. All the data in the column will be lost.
  - Added the required column `applicantName` to the `DocumentBundle` table without a default value. This is not possible if the table is not empty.
  - Added the required column `formData` to the `DocumentBundle` table without a default value. This is not possible if the table is not empty.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "BundleStatus_new" AS ENUM ('NEW', 'REVIEWED', 'SUBMITTED', 'COMPLETED');
ALTER TABLE "public"."DocumentBundle" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "DocumentBundle" ALTER COLUMN "status" TYPE "BundleStatus_new" USING ("status"::text::"BundleStatus_new");
ALTER TYPE "BundleStatus" RENAME TO "BundleStatus_old";
ALTER TYPE "BundleStatus_new" RENAME TO "BundleStatus";
DROP TYPE "public"."BundleStatus_old";
ALTER TABLE "DocumentBundle" ALTER COLUMN "status" SET DEFAULT 'NEW';
COMMIT;

-- AlterTable
ALTER TABLE "DocumentBundle" DROP COLUMN "metadata",
DROP COLUMN "pdfPath",
ADD COLUMN     "adminNote" TEXT,
ADD COLUMN     "applicantName" TEXT NOT NULL,
ADD COLUMN     "formData" JSONB NOT NULL,
ALTER COLUMN "status" SET DEFAULT 'NEW',
ALTER COLUMN "xmlContent" DROP NOT NULL;

-- CreateTable
CREATE TABLE "Attachment" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "bundleId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "attachmentType" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "data" BYTEA NOT NULL,

    CONSTRAINT "Attachment_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Attachment" ADD CONSTRAINT "Attachment_bundleId_fkey" FOREIGN KEY ("bundleId") REFERENCES "DocumentBundle"("id") ON DELETE CASCADE ON UPDATE CASCADE;
