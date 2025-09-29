-- Add check constraint for XpEvent.amount >= 0
ALTER TABLE "public"."xp_events" ADD CONSTRAINT "xp_events_amount_non_negative" CHECK ("amount" >= 0);

-- Add check constraint for Event.endsAt > startsAt
ALTER TABLE "public"."events" ADD CONSTRAINT "events_ends_after_starts" CHECK ("ends_at" > "starts_at");

-- Add optional check constraint for quietTimeStart < quietTimeEnd (only when both are not null)
-- Note: This constraint is commented out due to potential existing data conflicts
-- ALTER TABLE "public"."user_settings" ADD CONSTRAINT "user_settings_quiet_time_order" 
-- CHECK (
--   ("quiet_time_start" IS NULL OR "quiet_time_end" IS NULL) OR 
--   ("quiet_time_start" < "quiet_time_end")
-- );