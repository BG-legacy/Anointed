-- =============================================================================
-- XP TOTALS TRIGGER
-- =============================================================================
-- This trigger automatically updates the xp_totals table when XP events are inserted.
-- It maintains running totals for each fruit of the spirit per user.

CREATE OR REPLACE FUNCTION update_xp_totals()
RETURNS TRIGGER AS $$
DECLARE
  column_name TEXT;
BEGIN
  -- Map the fruit enum to the corresponding column name
  column_name := CASE NEW.fruit
    WHEN 'LOVE' THEN 'love'
    WHEN 'JOY' THEN 'joy'
    WHEN 'PEACE' THEN 'peace'
    WHEN 'PATIENCE' THEN 'patience'
    WHEN 'KINDNESS' THEN 'kindness'
    WHEN 'GOODNESS' THEN 'goodness'
    WHEN 'FAITHFULNESS' THEN 'faithfulness'
    WHEN 'GENTLENESS' THEN 'gentleness'
    WHEN 'SELF_CONTROL' THEN 'self_control'
  END;

  -- Upsert the xp_totals record
  -- If the user doesn't have a record, create it with the new amount
  -- If they do, increment the appropriate fruit column
  EXECUTE format(
    'INSERT INTO xp_totals (user_id, %I, updated_at)
     VALUES ($1, $2, NOW())
     ON CONFLICT (user_id)
     DO UPDATE SET 
       %I = xp_totals.%I + $2,
       updated_at = NOW()',
    column_name, column_name, column_name
  ) USING NEW.user_id, NEW.amount;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create the trigger
CREATE TRIGGER xp_event_inserted
  AFTER INSERT ON xp_events
  FOR EACH ROW
  EXECUTE FUNCTION update_xp_totals();

-- =============================================================================
-- INITIAL DATA BACKFILL (Optional - run if you have existing XP events)
-- =============================================================================
-- This ensures existing xp_totals are accurate based on existing xp_events.
-- Only runs if there are xp_events but corresponding xp_totals are missing or incorrect.

DO $$
DECLARE
  has_events BOOLEAN;
BEGIN
  -- Check if there are any XP events
  SELECT EXISTS(SELECT 1 FROM xp_events LIMIT 1) INTO has_events;
  
  -- Only proceed if there are events
  IF has_events THEN
    -- Recalculate all XP totals from events
    -- This uses UPSERT to handle users who may or may not have totals
    INSERT INTO xp_totals (
      user_id,
      love,
      joy,
      peace,
      patience,
      kindness,
      goodness,
      faithfulness,
      gentleness,
      self_control,
      updated_at
    )
    SELECT 
      user_id,
      COALESCE(SUM(CASE WHEN fruit = 'LOVE' THEN amount ELSE 0 END), 0) as love,
      COALESCE(SUM(CASE WHEN fruit = 'JOY' THEN amount ELSE 0 END), 0) as joy,
      COALESCE(SUM(CASE WHEN fruit = 'PEACE' THEN amount ELSE 0 END), 0) as peace,
      COALESCE(SUM(CASE WHEN fruit = 'PATIENCE' THEN amount ELSE 0 END), 0) as patience,
      COALESCE(SUM(CASE WHEN fruit = 'KINDNESS' THEN amount ELSE 0 END), 0) as kindness,
      COALESCE(SUM(CASE WHEN fruit = 'GOODNESS' THEN amount ELSE 0 END), 0) as goodness,
      COALESCE(SUM(CASE WHEN fruit = 'FAITHFULNESS' THEN amount ELSE 0 END), 0) as faithfulness,
      COALESCE(SUM(CASE WHEN fruit = 'GENTLENESS' THEN amount ELSE 0 END), 0) as gentleness,
      COALESCE(SUM(CASE WHEN fruit = 'SELF_CONTROL' THEN amount ELSE 0 END), 0) as self_control,
      NOW() as updated_at
    FROM xp_events
    GROUP BY user_id
    ON CONFLICT (user_id) DO UPDATE SET
      love = EXCLUDED.love,
      joy = EXCLUDED.joy,
      peace = EXCLUDED.peace,
      patience = EXCLUDED.patience,
      kindness = EXCLUDED.kindness,
      goodness = EXCLUDED.goodness,
      faithfulness = EXCLUDED.faithfulness,
      gentleness = EXCLUDED.gentleness,
      self_control = EXCLUDED.self_control,
      updated_at = EXCLUDED.updated_at;
    
    RAISE NOTICE 'XP totals recalculated from existing events';
  END IF;
END $$;
