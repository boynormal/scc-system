-- Checklist templates for asset PM. A plan copies items and does not store template_id.
-- Rollback: ALTER TABLE "asset_pm_items" DROP COLUMN "detail";
-- DROP TABLE "asset_pm_template_items"; DROP TABLE "asset_pm_templates";

ALTER TABLE "asset_pm_items" ADD COLUMN "detail" VARCHAR(255);

CREATE TABLE "asset_pm_templates" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_id" UUID NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "asset_pm_templates_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "asset_pm_templates_company_id_name_key" ON "asset_pm_templates"("company_id", "name");
CREATE INDEX "asset_pm_templates_company_id_idx" ON "asset_pm_templates"("company_id");

CREATE TABLE "asset_pm_template_items" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "template_id" UUID NOT NULL,
    "sequence" SMALLINT NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "detail" VARCHAR(255),

    CONSTRAINT "asset_pm_template_items_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "asset_pm_template_items_template_id_idx" ON "asset_pm_template_items"("template_id");

ALTER TABLE "asset_pm_templates" ADD CONSTRAINT "asset_pm_templates_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "asset_pm_template_items" ADD CONSTRAINT "asset_pm_template_items_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "asset_pm_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;
