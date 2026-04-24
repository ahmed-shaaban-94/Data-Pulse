-- Migration: 111 — outbound webhooks (subscriptions + delivery log)
-- Layer: webhooks (new schema)
-- Idempotent. Issue #608.
--
-- Creates:
--   1. webhooks schema
--   2. webhooks.subscriptions   — tenant webhook endpoint registrations
--   3. webhooks.delivery_log    — per-attempt delivery records (retry + DLQ)
--   RLS on all tables (tenant_id based)

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Schema
-- ─────────────────────────────────────────────────────────────────────────────

CREATE SCHEMA IF NOT EXISTS webhooks;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. webhooks.subscriptions
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS webhooks.subscriptions (
    id          BIGSERIAL   PRIMARY KEY,
    tenant_id   BIGINT      NOT NULL,
    event_type  TEXT        NOT NULL,
    target_url  TEXT        NOT NULL,
    secret      TEXT        NOT NULL,           -- HMAC-SHA256 signing key
    is_active   BOOL        NOT NULL DEFAULT true,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT subscriptions_url_scheme CHECK (target_url LIKE 'https://%' OR target_url LIKE 'http://%')
);

CREATE INDEX IF NOT EXISTS idx_webhooks_subscriptions_tenant_event -- migration-safety: ok
    ON webhooks.subscriptions (tenant_id, event_type)
    WHERE is_active = true;

COMMENT ON TABLE webhooks.subscriptions IS
    'Outbound webhook endpoint registrations per tenant. Added in migration 111.';

ALTER TABLE webhooks.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhooks.subscriptions FORCE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename = 'subscriptions' AND schemaname = 'webhooks'
        AND policyname = 'tenant_isolation'
    ) THEN
        CREATE POLICY tenant_isolation ON webhooks.subscriptions
            USING (tenant_id = current_setting('app.tenant_id')::BIGINT);
    END IF;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. webhooks.delivery_log
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS webhooks.delivery_log (
    id              BIGSERIAL   PRIMARY KEY,
    subscription_id BIGINT      NOT NULL REFERENCES webhooks.subscriptions (id) ON DELETE CASCADE,
    tenant_id       BIGINT      NOT NULL,
    event_type      TEXT        NOT NULL,
    payload         JSONB       NOT NULL,
    status          TEXT        NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'sent', 'failed', 'dead')),
    attempt_count   INT         NOT NULL DEFAULT 0,
    next_retry_at   TIMESTAMPTZ,
    last_error      TEXT,
    delivered_at    TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_webhooks_delivery_log_retry -- migration-safety: ok
    ON webhooks.delivery_log (next_retry_at, status)
    WHERE status IN ('pending', 'failed');

CREATE INDEX IF NOT EXISTS idx_webhooks_delivery_log_tenant -- migration-safety: ok
    ON webhooks.delivery_log (tenant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_webhooks_delivery_log_subscription -- migration-safety: ok
    ON webhooks.delivery_log (subscription_id, created_at DESC);

COMMENT ON TABLE webhooks.delivery_log IS
    'Per-attempt delivery records for outbound webhooks. Dead-lettered after 5 attempts. Added in migration 111.';

ALTER TABLE webhooks.delivery_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhooks.delivery_log FORCE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename = 'delivery_log' AND schemaname = 'webhooks'
        AND policyname = 'tenant_isolation'
    ) THEN
        CREATE POLICY tenant_isolation ON webhooks.delivery_log
            USING (tenant_id = current_setting('app.tenant_id')::BIGINT);
    END IF;
END $$;
