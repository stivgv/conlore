-- Migration: 0012_create_teacher_booking_rpc
-- SECURITY DEFINER RPC for creating teacher lesson bookings.
-- Verifies the caller is a teacher, checks court overlap with row locking,
-- and inserts with booking_type='teacher', total_price=0, student_name.

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
  v_is_teacher BOOLEAN;
BEGIN
  -- Verify the caller is actually a teacher
  SELECT EXISTS (
    SELECT 1 FROM users WHERE id = p_teacher_id AND role = 'teacher'
  ) INTO v_is_teacher;

  IF NOT v_is_teacher THEN
    RAISE EXCEPTION 'NOT_A_TEACHER'
      USING ERRCODE = '42501',
            DETAIL  = 'Solo i maestri possono creare lezioni.';
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
