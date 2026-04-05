-- Migration: 0010_add_teacher_module
-- Adds the 'teacher' role, color_code column, teacher booking columns,
-- fixes the no_overlap GiST constraint to filter by status='confirmed',
-- and adds the is_teacher() helper function.

-- 1. Expand role CHECK constraint on users table
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE public.users ADD CONSTRAINT users_role_check
  CHECK (role IN ('admin', 'member', 'teacher'));

-- 2. Add color_code column to users (only meaningful for teachers)
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS color_code TEXT DEFAULT NULL;

-- 3. Add teacher-specific columns to bookings
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS booking_type TEXT NOT NULL DEFAULT 'member'
    CHECK (booking_type IN ('member', 'teacher')),
  ADD COLUMN IF NOT EXISTS student_name TEXT DEFAULT NULL;

-- 4. FIX: Recreate the no_overlap GiST constraint scoped to confirmed bookings only.
--    The original constraint (migration 0001) does NOT filter by status, meaning
--    cancelled bookings still block new inserts on the same court/time range.
--    This is critical for the teacher cancel-anytime feature.
CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE public.bookings DROP CONSTRAINT IF EXISTS no_overlap;

ALTER TABLE public.bookings ADD CONSTRAINT no_overlap
  EXCLUDE USING gist (
    court_id WITH =,
    tstzrange(start_time, end_time, '[)') WITH &&
  ) WHERE (status = 'confirmed');

-- 5. is_teacher() helper function (mirrors is_admin())
CREATE OR REPLACE FUNCTION public.is_teacher()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid() AND role = 'teacher'
  );
$$;
