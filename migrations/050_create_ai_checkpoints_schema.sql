-- Migration: 050 — Dedicated ai_checkpoints schema for LangGraph PostgresSaver (Phase D HITL)
-- Layer: infrastructure
-- Idempotent: IF NOT EXISTS guards throughout.
--
-- Purpose: LangGraph's PostgresSaver stores checkpoint blobs and metadata in its own
--   schema.  We keep this separate from the brain schema (Claude Code session memory)
--   because they have different audiences, lifecycles, and access patterns.
--
-- The actual tables (checkpoints, checkpoint_blobs, checkpoint_migrations,
-- checkpoint_writes) are created by langgraph-checkpoint-postgres on first use.
-- This migration only creates the schema and grants the necessary privileges so
-- the application user can write to it at runtime.
--
-- Permissions model:
--   datapulse     — app user (full access to ai_checkpoints)
--   datapulse_reader — read-only analytical user (no access to checkpoints)
--
-- Thread-id format expected by graph_service:
--   "{tenant_id}:{insight_type}:{run_id}"

-- ============================================================
-- 1. Schema
-- ============================================================

CREATE SCHEMA IF NOT EXISTS ai_checkpoints;

-- ============================================================
-- 2. Grants for application user (owns schema)
-- ============================================================

GRANT USAGE  ON SCHEMA ai_checkpoints TO datapulse;
GRANT CREATE ON SCHEMA ai_checkpoints TO datapulse;

-- Ensure future tables in the schema are also accessible
ALTER DEFAULT PRIVILEGES IN SCHEMA ai_checkpoints
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO datapulse;
ALTER DEFAULT PRIVILEGES IN SCHEMA ai_checkpoints
    GRANT USAGE, SELECT ON SEQUENCES TO datapulse;

-- Reader does NOT get access to checkpoint data (contains tenant narratives).
-- Intentionally omitted: GRANT ... TO datapulse_reader;

-- ============================================================
-- 3. Comment
-- ============================================================

COMMENT ON SCHEMA ai_checkpoints IS
    'Dedicated schema for LangGraph PostgresSaver checkpoint tables. '
    'Populated lazily by langgraph-checkpoint-postgres on first HITL run. '
    'Keep separate from brain schema (Claude Code session memory). '
    'Thread-id format: {tenant_id}:{insight_type}:{run_id}';
