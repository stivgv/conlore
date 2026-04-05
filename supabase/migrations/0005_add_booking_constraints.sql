-- Migration: 0005_add_booking_constraints
-- Adds CHECK constraints to the bookings table to enforce data integrity:
--   1. start_time must be strictly before end_time
--   2. total_price must be non-negative

DO $$ BEGIN
  ALTER TABLE public.bookings ADD CONSTRAINT booking_time_order CHECK (start_time < end_time);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.bookings ADD CONSTRAINT booking_price_positive CHECK (total_price >= 0);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
