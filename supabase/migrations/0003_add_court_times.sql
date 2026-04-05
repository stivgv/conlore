-- =============================================================
-- Migration: 0003_add_court_times.sql
-- Adds open_time and close_time columns to the courts table.
-- These columns define the daily operating hours of each court
-- and are required by the booking engine's slot generation logic.
-- =============================================================

-- Add open_time column (default: opens at 08:00)
ALTER TABLE public.courts
  ADD COLUMN IF NOT EXISTS open_time TIME NOT NULL DEFAULT '08:00';

-- Add close_time column (default: closes at 22:00)
ALTER TABLE public.courts
  ADD COLUMN IF NOT EXISTS close_time TIME NOT NULL DEFAULT '22:00';

-- Example: update existing courts to explicit operating hours.
-- Adjust these values to match your actual courts before running.
UPDATE public.courts
  SET open_time  = '08:00',
      close_time = '22:00'
WHERE open_time  = '08:00'   -- only touches rows still at the default
  AND close_time = '22:00';  -- so re-running the migration is safe
