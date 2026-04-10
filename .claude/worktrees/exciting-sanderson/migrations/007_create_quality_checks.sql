-- Migration: Create quality_checks table for data quality gate results
-- Layer: Application / Data Quality
-- Phase: 2.5 (Quality Gates)
--
-- Run order: after 005_create_pipeline_runs.sql (requires public.pipeline_runs)
-- Idempotent: safe to run multiple times (IF NOT EXISTS / DO $$ guards)
--
-- What this does:
--   1. Guards against missing prerequisite (public.pipeline_runs must exist)
--   2. Creates the quality_checks table in public schema
--   3. Adds indexes for common query patterns (run lookup, stage filter, failure scan)
--   4. Enables tenant-scoped Row Level Security
--   5. Comments the table for documentation

-- ============================================================
-- 0. Pre-check: pipeline_runs must exist before we can FK to it
-- ============================================================
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name   = 'pipeline_runs'
    ) THEN
        RAISE EXCEPTION
            'Prerequisite not met: public.pipeline_runs must exist (run 005_create_pipeline_runs.sql first)';
    END IF;
END $$;

-- ============================================================
-- 1. Create quality_checks table
-- ============================================================
CREATE TABLE IF NOT EXISTS public.quality_checks (
    id              SERIAL PRIMARY KEY,
    tenant_id       INT          NOT NULL DEFAULT 1 REFERENCES bronze.tenants(tenant_id),
    pipeline_run_id UUID         NOT NULL REFERENCES public.pipeline_runs(id),
    check_name      TEXT         NOT NULL,   -- e.g. 'row_count', 'null_rate', 'schema_drift'
    stage           TEXT         NOT NULL,   -- e.g. 'bronze', 'silver', 'gold'
    severity        TEXT         NOT NULL DEFAULT 'warn',  -- 'warn' | 'error'
    passed          BOOLEAN      NOT NULL,
    message         TEXT,                    -- human-readable result description
    details         JSONB        NOT NULL DEFAULT '{}'::jsonb,  -- structured check metadata
    checked_at      TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- ============================================================
-- 2. Indexes for common query patterns
-- ============================================================

-- Fetch all checks for a given pipeline run (most common join path)
CREATE INDEX IF NOT EXISTS idx_quality_checks_run_id
    ON public.quality_checks(pipeline_run_id);

-- Filter checks by tenant + stage (analytics queries)
CREATE INDEX IF NOT EXISTS idx_quality_checks_tenant_stage
    ON public.quality_checks(tenant_id, stage);

-- Partial index — fast scan for failed checks only (dashboards, alerts)
CREATE INDEX IF NOT EXISTS idx_quality_checks_failed
    ON public.quality_checks(passed)
    WHERE NOT passed;

-- ============================================================
-- 3. Row Level Security
-- ============================================================
ALTER TABLE public.quality_checks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quality_checks FORCE ROW LEVEL SECURITY;

-- Owner policy: datapulse user has full access (INSERT, UPDATE, DELETE, SELECT)
DO $$ BEGIN
    CREATE POLICY owner_all ON public.quality_checks
        FOR ALL TO datapulse
        USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Reader policy: datapulse_reader scoped by tenant_id session variable
DO $$ BEGIN
    CREATE POLICY reader_select ON public.quality_checks
        FOR SELECT TO datapulse_reader
        USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::INT);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================
-- 4. Table comment
-- ============================================================
COMMENT ON TABLE public.quality_checks IS
    'Data quality gate results per pipeline run stage — Phase 2.5';
