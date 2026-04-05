-- Migration: 0016_fix_teacher_booking_admin
-- Allow admin users to create teacher bookings (e.g. when simulating teacher role).
-- The role check now accepts both 'teacher' and 'admin'.

CREATE OR REPLACE FUNCTION public.create_teacher_booking(
  p_court_id     UUID,
  p_teacher_id   UUID,
  p_start_time   TIMESTAMPTZ,
  p_end_time     TIMESTAMPTZ,
  p_student_name TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_booking_id UUID;
  v_is_allowed BOOLEAN;
BEGIN
  -- Verify the caller is a teacher or admin
  SELECT EXISTS (
    SELECT 1 FROM users WHERE id = p_teacher_id AND role IN ('teacher', 'admin')
  ) INTO v_is_allowed;

  IF NOT v_is_allowed THEN
    RAISE EXCEPTION 'NOT_A_TEACHER'
      USING ERRCODE = '42501',
            DETAIL  = 'Solo i maestri possono creare lezioni.';
  END IF;

  -- Check if this teacher already has a confirmed lesson at the same time (any court)
  PERFORM id
  FROM bookings
  WHERE user_id    = p_teacher_id
    AND status     = 'confirmed'
    AND booking_type = 'teacher'
    AND start_time < p_end_time
    AND end_time   > p_start_time
  FOR UPDATE;

  IF FOUND THEN
    RAISE EXCEPTION 'TEACHER_OVERLAP'
      USING ERRCODE = '23514',
            DETAIL  = 'Hai già una lezione programmata in questo orario.';
  END IF;

  -- Lock overlapping confirmed bookings to prevent TOCTOU race conditions
  PERFORM id
  FROM bookings
  WHERE court_id  = p_court_id
    AND status    = 'confirmed'
    AND start_time < p_end_time
    AND end_time   > p_start_time
  FOR UPDATE;

  IF FOUND THEN
    RAISE EXCEPTION 'COURT_OVERLAP'
      USING ERRCODE = '23P01',
            DETAIL  = 'Il campo è già occupato in questo orario.';
  END IF;

  -- Insert the lesson booking
  INSERT INTO bookings (
    court_id, user_id, start_time, end_time,
    total_price, payment_status, status,
    booking_type, student_name
  )
  VALUES (
    p_court_id, p_teacher_id, p_start_time, p_end_time,
    0, NULL, 'confirmed',
    'teacher', p_student_name
  )
  RETURNING id INTO v_booking_id;

  RETURN v_booking_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_teacher_booking(UUID, UUID, TIMESTAMPTZ, TIMESTAMPTZ, TEXT)
  TO authenticated;
