-- Migration: 0004_fix_rls_role_escalation
-- Purpose: Prevent authenticated users from escalating their own `role` column
--          via a direct UPDATE on the public.users table.
--
-- The WITH CHECK clause ensures that after the update the stored role
-- must still equal the role that was already persisted for that user.
-- This makes self-promotion (e.g. member → admin) impossible even if
-- the client sends a payload that includes a `role` change.

-- Remove the previous permissive UPDATE policy (if it exists)
DROP POLICY IF EXISTS "users: update own profile" ON public.users;

-- Recreate with a role-immutability constraint
CREATE POLICY "users: update own profile"
  ON public.users FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (
    auth.uid() = id
    AND role = (SELECT role FROM public.users WHERE id = auth.uid())
  );
