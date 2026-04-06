-- Add phone number field to public.users
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS phone TEXT DEFAULT NULL;

-- Allow users to update their own phone
-- (existing RLS policy covers UPDATE on their own row)
