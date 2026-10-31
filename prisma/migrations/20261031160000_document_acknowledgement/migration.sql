-- Document acknowledgement is per current version. Older rows stay for history.
-- Additive only.
-- Rollback: DROP TABLE doc_center_acknowledgements;
-- ALTER TABLE doc_center_documents DROP COLUMN requires_acknowledgement;

ALTER TABLE "doc_center_documents"
  ADD COLUMN "requires_acknowledgement" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE "doc_center_acknowledgements" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "document_id" UUID NOT NULL,
    "version_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "doc_center_acknowledgements_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "doc_center_acknowledgements_user_id_version_id_key"
  ON "doc_center_acknowledgements"("user_id", "version_id");
CREATE INDEX "doc_center_acknowledgements_document_id_idx"
  ON "doc_center_acknowledgements"("document_id");
CREATE INDEX "doc_center_acknowledgements_version_id_idx"
  ON "doc_center_acknowledgements"("version_id");

ALTER TABLE "doc_center_acknowledgements"
  ADD CONSTRAINT "doc_center_acknowledgements_document_id_fkey"
  FOREIGN KEY ("document_id") REFERENCES "doc_center_documents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "doc_center_acknowledgements"
  ADD CONSTRAINT "doc_center_acknowledgements_version_id_fkey"
  FOREIGN KEY ("version_id") REFERENCES "doc_center_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "doc_center_acknowledgements"
  ADD CONSTRAINT "doc_center_acknowledgements_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
