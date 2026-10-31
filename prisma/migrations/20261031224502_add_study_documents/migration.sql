-- CreateTable
CREATE TABLE "study_documents" (
    "id" TEXT NOT NULL,
    "school" "School" NOT NULL,
    "title" TEXT NOT NULL,
    "course_code" TEXT,
    "description" TEXT,
    "file_type" TEXT NOT NULL,
    "text_content" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "uploaded_by_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "study_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "study_chunks" (
    "id" TEXT NOT NULL,
    "document_id" TEXT NOT NULL,
    "chunk_index" INTEGER NOT NULL,
    "content" TEXT NOT NULL,
    "embedding" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "study_chunks_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "study_documents" ADD CONSTRAINT "study_documents_uploaded_by_id_fkey" FOREIGN KEY ("uploaded_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "study_chunks" ADD CONSTRAINT "study_chunks_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "study_documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;
