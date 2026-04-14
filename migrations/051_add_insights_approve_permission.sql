-- Migration: 051 — Add insights:approve permission for HITL deep-dive approval (Phase D)
-- Layer: rbac
-- Idempotent: ON CONFLICT DO NOTHING throughout.
--
-- Grants:
--   owner  — all permissions (existing grant-all INSERT covers this)
--   admin  — insights:approve (added explicitly; not granted to editor/viewer)
--   editor — NOT granted (intentional — editor can view but not approve AI narratives)
--   viewer — NOT granted

-- ============================================================
-- 1. Insert new permission
-- ============================================================

INSERT INTO public.permissions (permission_key, category, description)
VALUES (
    'insights:approve',
    'insights',
    'Approve or reject AI-generated insight drafts in the HITL review workflow'
)
ON CONFLICT (permission_key) DO NOTHING;

-- ============================================================
-- 2. Grant to owner (all permissions — ensure coverage)
-- ============================================================

INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.role_id, p.permission_id
FROM   public.roles r, public.permissions p
WHERE  r.role_key = 'owner'
  AND  p.permission_key = 'insights:approve'
ON CONFLICT DO NOTHING;

-- ============================================================
-- 3. Grant to admin
-- ============================================================

INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.role_id, p.permission_id
FROM   public.roles r, public.permissions p
WHERE  r.role_key = 'admin'
  AND  p.permission_key = 'insights:approve'
ON CONFLICT DO NOTHING;

-- editor and viewer intentionally excluded.

COMMENT ON COLUMN public.permissions.permission_key IS
    'Unique permission identifier. insights:approve added in migration 051 for Phase D HITL.';
