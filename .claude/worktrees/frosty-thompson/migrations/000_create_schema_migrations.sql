-- Migration tracking table — must be applied first
-- This migration is self-bootstrapping: it creates the table that tracks all migrations
CREATE TABLE IF NOT EXISTS public.schema_migrations (
    id SERIAL PRIMARY KEY,
    filename TEXT NOT NULL UNIQUE,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    checksum TEXT  -- optional: SHA-256 of the migration file for drift detection
);

COMMENT ON TABLE public.schema_migrations IS 'Tracks which SQL migration files have been applied. Used by the bronze loader to skip already-applied migrations.';
