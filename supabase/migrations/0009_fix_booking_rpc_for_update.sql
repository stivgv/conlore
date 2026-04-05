-- Migration: 0009_fix_booking_rpc_for_update
-- Fix: SELECT COUNT(*) ... FOR UPDATE is not supported in PostgreSQL (0A000).
-- Replace with PERFORM ... FOR UPDATE + IF FOUND pattern, which locks rows
-- correctly and still prevents TOCTOU race conditions.

CREATE OR REPLACE FUNCTION public.create_booking_safe(
  p_court_id    UUID,
  p_user_id     UUID,
  p_start_time  TIMESTAMPTZ,
  p_end_time    TIMESTAMPTZ,
  p_total_price NUMERIC
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_booking_id UUID;
BEGIN
  -- Lock overlapping court rows to prevent race conditions, then check existence
  PERFORM id
  FROM bookings
  WHERE court_id = p_court_id
    AND status   = 'confirmed'
    AND start_time < p_end_time
    AND end_time   > p_start_time
  FOR UPDATE;

  IF FOUND THEN
    RAISE EXCEPTION 'COURT_OVERLAP'
      USING ERRCODE = '23P01',
            DETAIL  = 'Il campo è già occupato in questo orario.';
  END IF;

  -- Check for same-user overlap
  PERFORM id
  FROM bookings
  WHERE user_id  = p_user_id
    AND status   = 'confirmed'
    AND start_time < p_end_time
    AND end_time   > p_start_time
  FOR UPDATE;

  IF FOUND THEN
    RAISE EXCEPTION 'USER_OVERLAP'
      USING ERRCODE = '23514',
            DETAIL  = 'Hai già una prenotazione in questo orario.';
  END IF;

  INSERT INTO bookings (court_id, user_id, start_time, end_time, total_price, status)
  VALUES (p_court_id, p_user_id, p_start_time, p_end_time, p_total_price, 'confirmed')
  RETURNING id INTO v_booking_id;

  RETURN v_booking_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_booking_safe(UUID, UUID, TIMESTAMPTZ, TIMESTAMPTZ, NUMERIC)
  TO authenticated;
