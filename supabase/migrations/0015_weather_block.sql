-- Migration: 0015_weather_block
-- Purpose: Introduce the weather_blocks table to support the "Maltempo" feature.
--
-- A weather block suspends online bookings for a configurable duration:
--   '1h'         → 1 hour from activation
--   '3h'         → 3 hours from activation
--   'end_of_day' → until midnight (Europe/Rome)
--
-- Constraints:
--   - Only one row may have is_active = TRUE at a time (partial unique index).
--   - Expiry is enforced server-side: rows where block_until < NOW() are ignored.
--   - Automatic midnight reset: setting block_until to midnight makes the block
--     disappear naturally at the turn of the day without a cron job.

CREATE TABLE IF NOT EXISTS public.weather_blocks (
  id            UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  activated_by  UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  duration_type TEXT        NOT NULL CHECK (duration_type IN ('1h', '3h', 'end_of_day')),
  block_until   TIMESTAMPTZ NOT NULL,
  is_active     BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enforce: at most one active block at any given time.
CREATE UNIQUE INDEX IF NOT EXISTS unique_active_weather_block
  ON public.weather_blocks (is_active)
  WHERE (is_active = TRUE);

-- Row Level Security
ALTER TABLE public.weather_blocks ENABLE ROW LEVEL SECURITY;

-- Admins can read, insert, update, delete all rows.
CREATE POLICY "weather_blocks: admin full access"
  ON public.weather_blocks
  FOR ALL
  TO authenticated
  USING  (public.is_admin())
  WITH CHECK (public.is_admin());

-- All authenticated users can read (needed to show the banner on dashboard).
CREATE POLICY "weather_blocks: authenticated read"
  ON public.weather_blocks
  FOR SELECT
  TO authenticated
  USING (true);
