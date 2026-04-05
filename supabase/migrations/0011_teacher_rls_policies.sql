-- Migration: 0011_teacher_rls_policies
-- RLS policies for the teacher role.

-- Teachers can read all bookings (needed for full schedule visibility and
-- to see existing bookings when planning lessons)
CREATE POLICY "bookings: teacher read all"
  ON public.bookings FOR SELECT
  USING (public.is_teacher());

-- All authenticated users can read confirmed bookings.
-- This is needed so members can see teacher booking labels (color + name/student)
-- on the schedule grid. Previously members could only read their OWN bookings.
CREATE POLICY "bookings: read confirmed"
  ON public.bookings FOR SELECT
  USING (
    auth.role() = 'authenticated'
    AND status = 'confirmed'
  );
