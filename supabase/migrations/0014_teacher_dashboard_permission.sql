-- Add page_teacher_dashboard permission
-- Enabled by default for teachers, disabled for members

INSERT INTO public.role_permissions (role, permission, enabled)
VALUES
  ('teacher', 'page_teacher_dashboard', true),
  ('member',  'page_teacher_dashboard', false)
ON CONFLICT (role, permission) DO UPDATE
  SET enabled    = EXCLUDED.enabled,
      updated_at = NOW();
