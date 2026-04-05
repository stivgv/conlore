-- =============================================================
-- Tennis Club Management App — Initial Schema
-- Migration: 0001_initial_schema.sql
-- =============================================================


-- =============================================================
-- 1. USERS TABLE
-- Mirrors auth.users; populated automatically via trigger.
-- =============================================================

CREATE TABLE IF NOT EXISTS public.users (
  id          UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role        TEXT        NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'member')),
  name        TEXT        NOT NULL DEFAULT '',
  email       TEXT        NOT NULL DEFAULT '',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Trigger function: auto-insert a row in public.users on new auth signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.users (id, email)
  VALUES (NEW.id, NEW.email);
  RETURN NEW;
END;
$$;

-- Attach trigger to auth.users
CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();


-- =============================================================
-- 2. COURTS TABLE
-- =============================================================

CREATE TABLE IF NOT EXISTS public.courts (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT        NOT NULL,
  surface_type  TEXT        NOT NULL,
  is_active     BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- =============================================================
-- 3. BOOKINGS TABLE
-- =============================================================

CREATE TABLE IF NOT EXISTS public.bookings (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  court_id    UUID        NOT NULL REFERENCES public.courts(id) ON DELETE CASCADE,
  start_time  TIMESTAMPTZ NOT NULL,
  end_time    TIMESTAMPTZ NOT NULL,
  status      TEXT        NOT NULL DEFAULT 'confirmed' CHECK (status IN ('confirmed', 'cancelled', 'pending')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT no_overlap EXCLUDE USING gist (
    court_id WITH =,
    tstzrange(start_time, end_time, '[)') WITH &&
  )
);

-- Index for common query patterns
CREATE INDEX IF NOT EXISTS bookings_user_id_idx  ON public.bookings(user_id);
CREATE INDEX IF NOT EXISTS bookings_court_id_idx ON public.bookings(court_id);
CREATE INDEX IF NOT EXISTS bookings_start_time_idx ON public.bookings(start_time);


-- =============================================================
-- 4. ROW LEVEL SECURITY (RLS)
-- =============================================================

ALTER TABLE public.users    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.courts   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;

-- Helper: check if the current user is an admin
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid() AND role = 'admin'
  );
$$;

-- ----- USERS policies -----

-- Users can read their own profile
CREATE POLICY "users: read own profile"
  ON public.users FOR SELECT
  USING (auth.uid() = id);

-- Admins can read all profiles
CREATE POLICY "users: admin read all"
  ON public.users FOR SELECT
  USING (public.is_admin());

-- Users can update their own name
CREATE POLICY "users: update own profile"
  ON public.users FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Admins can update anyone
CREATE POLICY "users: admin update all"
  ON public.users FOR UPDATE
  USING (public.is_admin());

-- ----- COURTS policies -----

-- Anyone (including anonymous) can read active courts
CREATE POLICY "courts: public read active"
  ON public.courts FOR SELECT
  USING (is_active = TRUE);

-- Admins can read all courts (including inactive)
CREATE POLICY "courts: admin read all"
  ON public.courts FOR SELECT
  USING (public.is_admin());

-- Only admins can insert, update, delete courts
CREATE POLICY "courts: admin insert"
  ON public.courts FOR INSERT
  WITH CHECK (public.is_admin());

CREATE POLICY "courts: admin update"
  ON public.courts FOR UPDATE
  USING (public.is_admin());

CREATE POLICY "courts: admin delete"
  ON public.courts FOR DELETE
  USING (public.is_admin());

-- ----- BOOKINGS policies -----

-- Authenticated users can read their own bookings
CREATE POLICY "bookings: read own"
  ON public.bookings FOR SELECT
  USING (auth.uid() = user_id);

-- Admins can read all bookings
CREATE POLICY "bookings: admin read all"
  ON public.bookings FOR SELECT
  USING (public.is_admin());

-- Authenticated users can create bookings for themselves only
CREATE POLICY "bookings: authenticated insert"
  ON public.bookings FOR INSERT
  WITH CHECK (auth.uid() = user_id AND auth.role() = 'authenticated');

-- Users can cancel (update) their own bookings
CREATE POLICY "bookings: update own"
  ON public.bookings FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Admins can update any booking
CREATE POLICY "bookings: admin update all"
  ON public.bookings FOR UPDATE
  USING (public.is_admin());

-- Only admins can hard-delete bookings
CREATE POLICY "bookings: admin delete"
  ON public.bookings FOR DELETE
  USING (public.is_admin());
