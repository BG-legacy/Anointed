-- Supabase Postgres Migration Script
-- Run this script on existing databases to enable required extensions and set parameters
-- This script is idempotent and can be run multiple times safely

-- Enable required extensions for Supabase Postgres
-- These extensions provide enhanced functionality for search, statistics, and indexing

-- pgcrypto: Cryptographic functions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- pg_trgm: Trigram similarity for fuzzy text search
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- pg_stat_statements: Query execution statistics
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements";

-- btree_gin: GIN indexes for btree operations (optional but recommended)
CREATE EXTENSION IF NOT EXISTS "btree_gin";

-- uuid-ossp: UUID generation functions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Set database-level parameters for performance and security
-- These settings help prevent long-running queries and transactions

-- statement_timeout: Maximum execution time for any statement
ALTER DATABASE current_database() SET statement_timeout = '10s';

-- idle_in_transaction_session_timeout: Maximum time a session can remain idle in a transaction
ALTER DATABASE current_database() SET idle_in_transaction_session_timeout = '10s';

-- Verify extensions are installed
SELECT 
    extname as "Extension Name",
    extversion as "Version",
    CASE 
        WHEN extname IN ('pgcrypto', 'pg_trgm', 'pg_stat_statements', 'btree_gin', 'uuid-ossp') 
        THEN '✓ Required for Supabase'
        ELSE '○ Additional'
    END as "Status"
FROM pg_extension 
WHERE extname IN ('pgcrypto', 'pg_trgm', 'pg_stat_statements', 'btree_gin', 'uuid-ossp')
ORDER BY extname;

-- Verify database parameters
SELECT 
    name as "Parameter",
    setting as "Value",
    context as "Context"
FROM pg_settings 
WHERE name IN ('statement_timeout', 'idle_in_transaction_session_timeout')
ORDER BY name;