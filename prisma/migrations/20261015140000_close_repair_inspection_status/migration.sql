-- Retire the repair inspection step.
-- Closed repairs are what /finance/sources reads. Move leftover inspection rows to closed.
-- The enum value `inspection` stays on TransportRepairStatus; the app no longer writes it.
-- Vehicle status is left unchanged: inspection already returned the vehicle to available.
-- Rollback: these rows cannot be told apart from other closed repairs, so do not revert automatically.

UPDATE "transport_repair_logs"
SET
  "status" = 'closed',
  "closed_at" = COALESCE("closed_at", NOW()),
  "updated_at" = NOW()
WHERE "status" = 'inspection';
