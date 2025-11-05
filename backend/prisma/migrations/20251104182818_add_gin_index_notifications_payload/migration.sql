-- Drop the old B-tree index on notifications.payload
DROP INDEX IF EXISTS "public"."notifications_payload_idx";

-- Create GIN index for JSONB column filtering on notifications.payload
CREATE INDEX "notifications_payload_gin" ON "public"."notifications" USING GIN ("payload");

