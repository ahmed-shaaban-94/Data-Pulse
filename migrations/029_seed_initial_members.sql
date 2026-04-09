-- Migration: Seed initial tenant members
-- Run order: after 028_create_resellers.sql
-- Idempotent: ON CONFLICT DO UPDATE — safe to re-run

-- Replace with actual admin emails before running in production
-- owner@example.com  → owner  (full access + billing)
-- admin@example.com  → admin  (all except billing:manage)

INSERT INTO public.tenant_members (tenant_id, user_id, email, display_name, role_id, is_active)
VALUES
    (
        1,
        'owner@example.com',
        'owner@example.com',
        'Owner',
        (SELECT role_id FROM public.roles WHERE role_key = 'owner'),
        TRUE
    ),
    (
        1,
        'admin@example.com',
        'admin@example.com',
        'Admin',
        (SELECT role_id FROM public.roles WHERE role_key = 'admin'),
        TRUE
    )
ON CONFLICT (tenant_id, email) DO UPDATE
    SET role_id    = EXCLUDED.role_id,
        is_active  = EXCLUDED.is_active;
