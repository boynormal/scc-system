-- Company duty catalog (category -> item), position default sets, and per-seat duties.
-- Rollback: DROP TABLE "personnel_position_duty_items"; DROP TABLE "position_duty_items"; DROP TABLE "duty_items"; DROP TABLE "duty_categories"; ALTER TABLE "personnel_positions" DROP COLUMN "extra_duties";

ALTER TABLE "personnel_positions" ADD COLUMN "extra_duties" TEXT;

CREATE TABLE "duty_categories" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_id" UUID NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "duty_categories_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "duty_categories_company_name_unique" ON "duty_categories"("company_id", "name");
CREATE INDEX "duty_categories_company_id_idx" ON "duty_categories"("company_id");

ALTER TABLE "duty_categories" ADD CONSTRAINT "duty_categories_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "duty_items" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "category_id" UUID NOT NULL,
    "name" VARCHAR(500) NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "duty_items_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "duty_items_category_name_unique" ON "duty_items"("category_id", "name");
CREATE INDEX "duty_items_category_id_idx" ON "duty_items"("category_id");

ALTER TABLE "duty_items" ADD CONSTRAINT "duty_items_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "duty_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "position_duty_items" (
    "position_id" UUID NOT NULL,
    "duty_item_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "position_duty_items_pkey" PRIMARY KEY ("position_id", "duty_item_id")
);

CREATE INDEX "position_duty_items_duty_item_id_idx" ON "position_duty_items"("duty_item_id");

ALTER TABLE "position_duty_items" ADD CONSTRAINT "position_duty_items_position_id_fkey" FOREIGN KEY ("position_id") REFERENCES "positions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "position_duty_items" ADD CONSTRAINT "position_duty_items_duty_item_id_fkey" FOREIGN KEY ("duty_item_id") REFERENCES "duty_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "personnel_position_duty_items" (
    "personnel_position_id" UUID NOT NULL,
    "duty_item_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "personnel_position_duty_items_pkey" PRIMARY KEY ("personnel_position_id", "duty_item_id")
);

CREATE INDEX "personnel_position_duty_items_duty_item_id_idx" ON "personnel_position_duty_items"("duty_item_id");

ALTER TABLE "personnel_position_duty_items" ADD CONSTRAINT "personnel_position_duty_items_personnel_position_id_fkey" FOREIGN KEY ("personnel_position_id") REFERENCES "personnel_positions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "personnel_position_duty_items" ADD CONSTRAINT "personnel_position_duty_items_duty_item_id_fkey" FOREIGN KEY ("duty_item_id") REFERENCES "duty_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
