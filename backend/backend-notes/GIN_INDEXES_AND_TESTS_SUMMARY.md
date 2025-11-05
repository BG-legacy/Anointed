# GIN Indexes and Performance Tests Implementation Summary

## Overview
This document summarizes the implementation of GIN indexes for JSONB columns and comprehensive performance tests to verify index usage across the Anointed backend application.

## Changes Made

### 1. Schema Updates (`prisma/schema.prisma`)

#### Fixed: notifications.payload Index
**Before:**
```prisma
@@index([payload])  // Regular B-tree index (incorrect for JSONB)
```

**After:**
```prisma
@@index([payload], type: Gin, map: "notifications_payload_gin")  // GIN index for JSONB
```

#### Existing GIN Indexes (Verified)
The following GIN indexes were already properly configured:
- ✅ `posts.media_urls` - `posts_media_urls_gin` (line 317)
- ✅ `audit_logs.metadata` - `audit_logs_metadata_gin` (line 686)
- ✅ `ai_responses.flags` - `ai_responses_flags_gin` (line 502)

### 2. Database Migrations

#### Migration 1: Search Functionality
**File:** `prisma/migrations/20251024142221_add_search_functionality/migration.sql`

This migration adds full-text search capability to the `posts` table:
- Adds `search_tsv` tsvector column
- Creates GIN index `posts_search_tsv_gin` for full-text search
- Creates trigger function `update_posts_search_tsv()` to automatically update the tsvector
- Creates trigger `posts_search_tsv_update` to fire on INSERT/UPDATE
- Populates existing rows with search vectors

#### Migration 2: GIN Index for Notifications
**File:** `prisma/migrations/20251104182818_add_gin_index_notifications_payload/migration.sql`

This migration updates the notifications payload index:
- Drops the old B-tree index `notifications_payload_idx`
- Creates new GIN index `notifications_payload_gin` for JSONB queries

### 3. Performance Tests

**File:** `src/tests/integration/index-performance.test.js`

Comprehensive test suite with 580+ lines covering:

#### Feed Query Index Usage Tests
- ✅ User feed queries (posts by user, ordered by date)
- ✅ Group feed queries (posts by group, ordered by date)
- ✅ Status-filtered feed queries (active posts)
- Verifies use of covering indexes:
  - `posts_user_created_desc`
  - `posts_group_created_desc`

#### JSONB GIN Index Tests
Tests for all four JSONB columns with GIN indexes:
- ✅ `posts.media_urls` - Array containment queries (`@>` operator)
- ✅ `notifications.payload` - Object containment queries
- ✅ `audit_logs.metadata` - Nested object queries
- ✅ `ai_responses.flags` - Boolean flag queries

#### Full-Text Search Tests
- ✅ Search using `search_tsv` with GIN index
- ✅ Verify search results update when content changes
- ✅ Test automatic trigger updates

#### Compound Index Tests
- ✅ Notifications by user and date (`notifications_user_created_desc`)
- ✅ Unread notifications filtering

#### Performance Benchmarks
- ✅ Indexed vs non-indexed query comparison
- ✅ JSONB query performance with GIN indexes
- ✅ Query execution time assertions (<100ms for test dataset)

## How It Works

### GIN Indexes for JSONB

GIN (Generalized Inverted Index) indexes are optimal for JSONB columns because they:
1. Index every key and value in the JSON structure
2. Support containment operators (`@>`, `@?`, `?`, `?&`, `?|`)
3. Enable fast queries on nested JSON properties
4. Are much more efficient than B-tree indexes for JSON data

**Example Query:**
```sql
-- Uses GIN index efficiently
SELECT * FROM notifications 
WHERE payload @> '{"priority": "high"}'::jsonb;

-- Uses GIN index for array containment
SELECT * FROM posts 
WHERE media_urls @> '["https://example.com/image.jpg"]'::jsonb;
```

### Full-Text Search

The `posts.search_tsv` column uses:
1. **tsvector data type**: Preprocessed, indexed text representation
2. **GIN index**: Fast lookups for word matches
3. **Automatic trigger**: Updates search_tsv when content changes
4. **PostgreSQL full-text search**: Language-aware search with stemming

**Example Query:**
```sql
-- Uses GIN index on search_tsv
SELECT * FROM posts 
WHERE search_tsv @@ to_tsquery('english', 'Jesus & faith');
```

### EXPLAIN ANALYZE Testing

The tests use `EXPLAIN (ANALYZE, FORMAT JSON)` to verify:
- Index scans are being used (not sequential scans)
- Correct indexes are being selected
- Query performance meets benchmarks

**Example Test Pattern:**
```javascript
const explainQuery = `
  EXPLAIN (ANALYZE, FORMAT JSON) 
  SELECT * FROM posts 
  WHERE user_id = $1 
  ORDER BY created_at DESC 
  LIMIT 20
`;

const result = await prisma.$queryRawUnsafe(explainQuery, userId);
const plan = result[0]['QUERY PLAN'];

// Verify index usage
expect(plan).toContain('Index Scan');
expect(plan).toContain('posts_user_created_desc');
```

## Running the Migrations

### Option 1: Using Prisma Migrate (Recommended)
```bash
cd backend

# Review pending migrations
npx prisma migrate status

# Apply all pending migrations
npx prisma migrate deploy

# Or for development (with database reset if needed)
npx prisma migrate dev
```

### Option 2: Manual SQL Execution
If you prefer to run the migrations manually:

```bash
# Connect to your database
psql $DATABASE_URL

# Run search functionality migration
\i prisma/migrations/20251024142221_add_search_functionality/migration.sql

# Run GIN index migration
\i prisma/migrations/20251104182818_add_gin_index_notifications_payload/migration.sql
```

## Running the Tests

### Run All Integration Tests
```bash
cd backend

# Run all integration tests
npm test -- src/tests/integration/

# Run only the index performance tests
npm test -- src/tests/integration/index-performance.test.js
```

### Test Output
The tests will output:
- Query execution plans (JSON format)
- Index usage verification
- Performance metrics (execution times)
- Pass/fail status for each assertion

**Example Output:**
```
=== User Feed Query Plan ===
Has Index Scan: true
Uses Expected Index: true
Has Sequential Scan: false

=== JSONB GIN Query Performance ===
Query time: 12ms
Results found: 3

✓ should use GIN index for notifications.payload JSONB queries
```

## Performance Benefits

### Before (B-tree index on JSONB)
- Slow containment queries
- Full table scans for nested JSON searches
- Poor performance on array operations

### After (GIN index on JSONB)
- Fast containment queries (typically <10ms)
- Efficient nested property searches
- Optimized array operations
- Scalable to large datasets

## Verification Checklist

After running migrations, verify:

- [ ] All migrations applied successfully
- [ ] GIN indexes created:
  ```sql
  SELECT indexname, indexdef 
  FROM pg_indexes 
  WHERE schemaname = 'public' 
  AND indexname LIKE '%_gin';
  ```

- [ ] Search trigger working:
  ```sql
  -- Insert a test post
  INSERT INTO posts (id, user_id, type, content, status)
  VALUES (gen_random_uuid(), '<user_id>', 'POST', 'Test content', 'ACTIVE');
  
  -- Verify search_tsv was populated
  SELECT id, content, search_tsv FROM posts WHERE content = 'Test content';
  ```

- [ ] All tests passing:
  ```bash
  npm test -- src/tests/integration/index-performance.test.js
  ```

## Best Practices

### When to Use GIN Indexes
✅ **Use GIN for:**
- JSONB columns with containment queries (`@>`)
- Array columns with containment queries
- Full-text search (tsvector columns)
- Columns with many distinct values per row

❌ **Don't use GIN for:**
- Simple equality checks (use B-tree)
- Numeric range queries (use B-tree or BRIN)
- Small tables (overhead not worth it)

### Query Optimization Tips

1. **Use proper operators:**
   ```sql
   -- Good: Uses GIN index
   WHERE payload @> '{"type": "prayer"}'::jsonb
   
   -- Bad: Cannot use GIN index efficiently
   WHERE payload->>'type' = 'prayer'
   ```

2. **Combine with other indexes:**
   ```sql
   -- Uses both user_id index AND payload GIN index
   WHERE user_id = $1 AND payload @> '{"priority": "high"}'::jsonb
   ```

3. **Test with EXPLAIN ANALYZE:**
   ```sql
   EXPLAIN ANALYZE
   SELECT * FROM notifications 
   WHERE payload @> '{"priority": "high"}'::jsonb;
   ```

## Troubleshooting

### Issue: Sequential Scan Instead of Index Scan
**Possible causes:**
- Dataset too small (Postgres chooses seq scan for small tables)
- Statistics outdated (run `ANALYZE table_name`)
- Query pattern doesn't match index

**Solution:**
```sql
-- Update table statistics
ANALYZE posts;
ANALYZE notifications;

-- Force index usage (testing only)
SET enable_seqscan = off;
```

### Issue: Slow JSONB Queries
**Check:**
1. Is GIN index present?
   ```sql
   \d+ notifications
   ```
2. Are you using the correct operator (`@>` not `->`)?
3. Is the JSON structure deeply nested (consider restructuring)?

### Issue: Search Not Finding Results
**Check:**
1. Is search_tsv populated?
   ```sql
   SELECT search_tsv FROM posts WHERE id = '<post_id>';
   ```
2. Is trigger firing?
   ```sql
   \df update_posts_search_tsv
   ```
3. Are you using the correct language ('english')?

## Additional Resources

- [PostgreSQL GIN Indexes](https://www.postgresql.org/docs/current/gin.html)
- [PostgreSQL JSONB Indexing](https://www.postgresql.org/docs/current/datatype-json.html#JSON-INDEXING)
- [PostgreSQL Full-Text Search](https://www.postgresql.org/docs/current/textsearch.html)
- [Prisma Indexes](https://www.prisma.io/docs/concepts/components/prisma-schema/indexes)

## Next Steps

1. **Apply migrations to all environments:**
   - Development ✅
   - Staging ⏳
   - Production ⏳

2. **Monitor query performance:**
   - Set up query logging
   - Monitor slow query log
   - Use pg_stat_statements extension

3. **Consider additional optimizations:**
   - Add more covering indexes for common queries
   - Implement materialized views for complex aggregations
   - Set up connection pooling (PgBouncer)

## Summary

All GIN indexes for JSONB columns are now properly configured:
- ✅ `posts.media_urls`
- ✅ `notifications.payload` (fixed)
- ✅ `audit_logs.metadata`
- ✅ `ai_responses.flags`
- ✅ `posts.search_tsv` (full-text search)

Comprehensive performance tests verify:
- ✅ Feed queries use proper indexes
- ✅ Search queries use GIN indexes
- ✅ Search updates when content changes
- ✅ JSONB queries perform efficiently
- ✅ All benchmarks meet performance targets

**Status: Ready for deployment** 🚀

