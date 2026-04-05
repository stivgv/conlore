-- Migration: 0013_role_permissions
-- Creates a role_permissions table to store per-role feature/page toggles.
-- Seeded with sensible defaults for member and teacher roles.
-- Admin always has all permissions (not stored in this table).

CREATE TABLE IF NOT EXISTS public.role_permissions (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  role        TEXT        NOT NULL CHECK (role IN ('member', 'teacher')),
  permission  TEXT        NOT NULL,
  enabled     BOOLEAN     NOT NULL DEFAULT true,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (role, permission)
);

-- Enable RLS
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;

-- Any authenticated user can read permissions (needed to gate UI features)
CREATE POLICY "role_permissions: authenticated read"
  ON public.role_permissions FOR SELECT
  USING (auth.role() = 'authenticated');

-- Only admins can update permissions
CREATE POLICY "role_permissions: admin update"
  ON public.role_permissions FOR UPDATE
  USING (public.is_admin());

-- Seed default permissions for member
INSERT INTO public.role_permissions (role, permission, enabled) VALUES
  ('member', 'page_dashboard',    true),
  ('member', 'page_schedule',     true),
  ('member', 'page_my_bookings',  true),
  ('member', 'book_courts',       true),
  ('member', 'cancel_bookings',   true),
  ('member', 'teacher_lessons',   false)
ON CONFLICT (role, permission) DO NOTHING;

-- Seed default permissions for teacher
INSERT INTO public.role_permissions (role, permission, enabled) VALUES
  ('teacher', 'page_dashboard',   true),
  ('teacher', 'page_schedule',    true),
  ('teacher', 'page_my_bookings', true),
  ('teacher', 'book_courts',      false),
  ('teacher', 'cancel_bookings',  true),
  ('teacher', 'teacher_lessons',  true)
ON CONFLICT (role, permission) DO NOTHING;
