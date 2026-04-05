-- Migration 0002: Add payment tracking columns to bookings table
-- Run this in your Supabase SQL editor or via the Supabase CLI

ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS total_price    NUMERIC(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS payment_status TEXT          DEFAULT 'pending'
    CHECK (payment_status IN ('pending', 'paid', 'no_show'));

-- Backfill existing confirmed bookings with a default price of €20
UPDATE bookings SET total_price = 20 WHERE status = 'confirmed' AND total_price = 0;

-- Index for fast admin queries by payment_status
CREATE INDEX IF NOT EXISTS idx_bookings_payment_status ON bookings (payment_status);
CREATE INDEX IF NOT EXISTS idx_bookings_start_time     ON bookings (start_time);
