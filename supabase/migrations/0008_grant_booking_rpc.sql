-- Migration: 0008_grant_booking_rpc
-- Grant EXECUTE on create_booking_safe to authenticated users.
-- Supabase revokes PUBLIC EXECUTE on custom functions in some project configurations;
-- this ensures any logged-in user can call the booking RPC.

GRANT EXECUTE ON FUNCTION public.create_booking_safe(UUID, UUID, TIMESTAMPTZ, TIMESTAMPTZ, NUMERIC)
  TO authenticated;
