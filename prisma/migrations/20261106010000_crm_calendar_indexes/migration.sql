-- Additive only: no UPDATE, DELETE, DROP or data backfill.
-- Normal CREATE INDEX briefly blocks writes; apply during the documented maintenance window.
BEGIN;
CREATE INDEX "Booking_staffId_start_idx" ON "Booking"("staffId", "start");
CREATE INDEX "Booking_start_idx" ON "Booking"("start");
COMMIT;
