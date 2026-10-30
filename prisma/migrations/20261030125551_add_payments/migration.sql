-- AlterTable
ALTER TABLE "service_requests" ADD COLUMN     "paid" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "payment_reference" TEXT;
