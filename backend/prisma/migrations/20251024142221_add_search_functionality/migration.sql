-- Add tsvector column for full-text search on posts
ALTER TABLE "public"."posts" ADD COLUMN "search_tsv" tsvector;

-- Create GIN index for full-text search on posts
CREATE INDEX "posts_search_tsv_gin" ON "public"."posts" USING GIN ("search_tsv");

-- Create function to update search_tsv automatically
CREATE OR REPLACE FUNCTION update_posts_search_tsv()
RETURNS TRIGGER AS $$
BEGIN
  NEW.search_tsv := to_tsvector('english', COALESCE(NEW.content, ''));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update search_tsv when content changes
CREATE TRIGGER posts_search_tsv_update
BEFORE INSERT OR UPDATE ON "public"."posts"
FOR EACH ROW
EXECUTE FUNCTION update_posts_search_tsv();

-- Populate existing rows with search_tsv values
UPDATE "public"."posts" SET search_tsv = to_tsvector('english', COALESCE(content, ''));

