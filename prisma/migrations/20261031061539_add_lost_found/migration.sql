-- CreateTable
CREATE TABLE "lost_found_items" (
    "id" TEXT NOT NULL,
    "school" "School" NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "location" TEXT NOT NULL,
    "image_url" TEXT,
    "contact_phone" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lost_found_items_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "lost_found_items" ADD CONSTRAINT "lost_found_items_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
