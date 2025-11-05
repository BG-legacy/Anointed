-- DropIndex
DROP INDEX "public"."posts_search_tsv_gin";

-- CreateIndex
CREATE INDEX "ai_responses_flags_gin" ON "public"."ai_responses" USING GIN ("flags");

-- CreateIndex
CREATE INDEX "audit_logs_metadata_gin" ON "public"."audit_logs" USING GIN ("metadata");

-- CreateIndex
CREATE INDEX "comments_post_created_asc" ON "public"."comments"("post_id", "created_at" ASC);

-- CreateIndex
CREATE INDEX "event_rsvps_event_id_idx" ON "public"."event_rsvps"("event_id");

-- CreateIndex
CREATE INDEX "group_members_group_id_idx" ON "public"."group_members"("group_id");

-- CreateIndex
CREATE INDEX "moderation_actions_entity_created_desc" ON "public"."moderation_actions"("entity_type", "created_at" DESC);

-- CreateIndex
CREATE INDEX "notifications_user_created_desc" ON "public"."notifications"("user_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "posts_group_created_desc" ON "public"."posts"("group_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "posts_user_created_desc" ON "public"."posts"("user_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "posts_media_urls_gin" ON "public"."posts" USING GIN ("media_urls");

-- CreateIndex
CREATE INDEX "xp_events_user_created_desc" ON "public"."xp_events"("user_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "xp_events_fruit_created_desc" ON "public"."xp_events"("fruit", "created_at" DESC);

-- =============================================================================
-- TRIGGERS FOR DERIVED DATA (COUNTERS)
-- =============================================================================

-- ------------------------------------------------
-- 1. COMMENTS COUNTER TRIGGER
-- ------------------------------------------------

-- Function to increment comment count
CREATE OR REPLACE FUNCTION increment_post_comment_count()
RETURNS TRIGGER AS $$
BEGIN
  -- Only increment if the comment is not soft-deleted
  IF NEW.deleted_at IS NULL THEN
    UPDATE posts 
    SET comment_count = comment_count + 1 
    WHERE id = NEW.post_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to decrement comment count
CREATE OR REPLACE FUNCTION decrement_post_comment_count()
RETURNS TRIGGER AS $$
BEGIN
  -- Decrement if the comment was not previously soft-deleted
  IF OLD.deleted_at IS NULL THEN
    UPDATE posts 
    SET comment_count = GREATEST(0, comment_count - 1)
    WHERE id = OLD.post_id;
  END IF;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

-- Function to handle comment soft-delete/restore
CREATE OR REPLACE FUNCTION handle_comment_soft_delete()
RETURNS TRIGGER AS $$
BEGIN
  -- If deleted_at changed from NULL to a timestamp (soft delete)
  IF OLD.deleted_at IS NULL AND NEW.deleted_at IS NOT NULL THEN
    UPDATE posts 
    SET comment_count = GREATEST(0, comment_count - 1)
    WHERE id = NEW.post_id;
  -- If deleted_at changed from a timestamp to NULL (restore)
  ELSIF OLD.deleted_at IS NOT NULL AND NEW.deleted_at IS NULL THEN
    UPDATE posts 
    SET comment_count = comment_count + 1
    WHERE id = NEW.post_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for comments
CREATE TRIGGER comment_inserted
  AFTER INSERT ON comments
  FOR EACH ROW
  EXECUTE FUNCTION increment_post_comment_count();

CREATE TRIGGER comment_deleted
  AFTER DELETE ON comments
  FOR EACH ROW
  EXECUTE FUNCTION decrement_post_comment_count();

CREATE TRIGGER comment_soft_deleted
  AFTER UPDATE ON comments
  FOR EACH ROW
  WHEN (OLD.deleted_at IS DISTINCT FROM NEW.deleted_at)
  EXECUTE FUNCTION handle_comment_soft_delete();

-- ------------------------------------------------
-- 2. REACTIONS COUNTER TRIGGER
-- ------------------------------------------------

-- Function to increment reaction count
CREATE OR REPLACE FUNCTION increment_post_reaction_count()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE posts 
  SET reaction_count = reaction_count + 1 
  WHERE id = NEW.post_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to decrement reaction count
CREATE OR REPLACE FUNCTION decrement_post_reaction_count()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE posts 
  SET reaction_count = GREATEST(0, reaction_count - 1)
  WHERE id = OLD.post_id;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

-- Triggers for reactions
CREATE TRIGGER reaction_inserted
  AFTER INSERT ON reactions
  FOR EACH ROW
  EXECUTE FUNCTION increment_post_reaction_count();

CREATE TRIGGER reaction_deleted
  AFTER DELETE ON reactions
  FOR EACH ROW
  EXECUTE FUNCTION decrement_post_reaction_count();

-- ------------------------------------------------
-- 3. PRAYER COMMITS COUNTER TRIGGER
-- ------------------------------------------------

-- Function to increment prayer commit count
CREATE OR REPLACE FUNCTION increment_prayer_commit_count()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE prayers 
  SET commit_count = commit_count + 1 
  WHERE id = NEW.prayer_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to decrement prayer commit count
CREATE OR REPLACE FUNCTION decrement_prayer_commit_count()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE prayers 
  SET commit_count = GREATEST(0, commit_count - 1)
  WHERE id = OLD.prayer_id;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

-- Triggers for prayer commits
CREATE TRIGGER prayer_commit_inserted
  AFTER INSERT ON prayer_commits
  FOR EACH ROW
  EXECUTE FUNCTION increment_prayer_commit_count();

CREATE TRIGGER prayer_commit_deleted
  AFTER DELETE ON prayer_commits
  FOR EACH ROW
  EXECUTE FUNCTION decrement_prayer_commit_count();
