-- AlterEnum
ALTER TYPE "MaintenanceWorkOrderStatus" ADD VALUE 'ACCEPTED';

-- AlterTable
ALTER TABLE "MaintenanceWorkOrder" ADD COLUMN     "acceptedAt" TIMESTAMP(3);
