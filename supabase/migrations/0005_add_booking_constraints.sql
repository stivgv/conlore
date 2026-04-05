-- Migration: 0005_add_booking_constraints
-- Adds CHECK constraints to the bookings table to enforce data integrity:
--   1. start_time must be strictly before end_time
--   2. total_price must be non-negative

ALTER TABLE public.bookings
  ADD CONSTRAINT IF NOT EXISTS booking_time_order
    CHECK (start_time < end_time);

ALTER TABLE public.bookings
  ADD CONSTRAINT IF NOT EXISTS booking_price_positive
    CHECK (total_price >= 0);
