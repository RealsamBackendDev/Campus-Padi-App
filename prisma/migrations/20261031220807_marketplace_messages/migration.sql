-- AlterTable
ALTER TABLE "messages" ADD COLUMN     "listing_id" TEXT,
ALTER COLUMN "request_id" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_listing_id_fkey" FOREIGN KEY ("listing_id") REFERENCES "marketplace_listings"("id") ON DELETE CASCADE ON UPDATE CASCADE;
