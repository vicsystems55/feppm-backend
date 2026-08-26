-- AlterTable
ALTER TABLE "Equipment" ADD COLUMN     "sourceData" JSONB,
ADD COLUMN     "sourceFingerprint" TEXT;

-- AlterTable
ALTER TABLE "Facility" ADD COLUMN     "source" TEXT,
ADD COLUMN     "sourceData" JSONB,
ADD COLUMN     "sourceFingerprint" TEXT;

-- CreateIndex
CREATE INDEX "Equipment_sourceFingerprint_idx" ON "Equipment"("sourceFingerprint");

-- CreateIndex
CREATE INDEX "Facility_sourceFingerprint_idx" ON "Facility"("sourceFingerprint");
