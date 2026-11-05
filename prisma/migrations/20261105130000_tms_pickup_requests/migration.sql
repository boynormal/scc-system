-- Customer QR pickup requests. QR uses tms_customers.public_token, not the customer id.
-- Rollback: DROP TABLE "tms_pickup_request_lines"; DROP TABLE "tms_pickup_requests";
-- DROP TYPE "TmsPickupRequestStatus"; ALTER TABLE "tms_customers" DROP COLUMN "public_token";

ALTER TABLE "tms_customers" ADD COLUMN "public_token" VARCHAR(64);
CREATE UNIQUE INDEX "tms_customers_public_token_key" ON "tms_customers"("public_token");

CREATE TYPE "TmsPickupRequestStatus" AS ENUM ('SUBMITTED', 'CANCELLED');

CREATE TABLE "tms_pickup_requests" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_id" UUID NOT NULL,
    "customer_id" UUID NOT NULL,
    "request_no" INTEGER NOT NULL,
    "contact_name" VARCHAR(255),
    "phone" VARCHAR(30),
    "note" TEXT,
    "status" "TmsPickupRequestStatus" NOT NULL DEFAULT 'SUBMITTED',
    "job_stop_id" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "tms_pickup_requests_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "tms_pickup_requests_job_stop_id_key" ON "tms_pickup_requests"("job_stop_id");
CREATE UNIQUE INDEX "tms_pickup_requests_company_id_request_no_key" ON "tms_pickup_requests"("company_id", "request_no");
CREATE INDEX "tms_pickup_requests_company_id_status_idx" ON "tms_pickup_requests"("company_id", "status");
CREATE INDEX "tms_pickup_requests_customer_id_created_at_idx" ON "tms_pickup_requests"("customer_id", "created_at");

CREATE TABLE "tms_pickup_request_lines" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "request_id" UUID NOT NULL,
    "cargo_type_id" UUID NOT NULL,
    "quantity" DECIMAL(12,2) NOT NULL,
    "unit_id" UUID NOT NULL,
    "note" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "tms_pickup_request_lines_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "tms_pickup_request_lines_request_id_idx" ON "tms_pickup_request_lines"("request_id");

ALTER TABLE "tms_pickup_requests" ADD CONSTRAINT "tms_pickup_requests_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "tms_pickup_requests" ADD CONSTRAINT "tms_pickup_requests_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "tms_customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "tms_pickup_requests" ADD CONSTRAINT "tms_pickup_requests_job_stop_id_fkey" FOREIGN KEY ("job_stop_id") REFERENCES "job_stops"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "tms_pickup_request_lines" ADD CONSTRAINT "tms_pickup_request_lines_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "tms_pickup_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "tms_pickup_request_lines" ADD CONSTRAINT "tms_pickup_request_lines_cargo_type_id_fkey" FOREIGN KEY ("cargo_type_id") REFERENCES "transport_cargo_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "tms_pickup_request_lines" ADD CONSTRAINT "tms_pickup_request_lines_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
