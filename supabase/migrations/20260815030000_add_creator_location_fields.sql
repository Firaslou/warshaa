-- Creator application location fields
-- Keeps the application form and approval function in sync with the database.

ALTER TABLE public.startup_applications
  ADD COLUMN IF NOT EXISTS delegation TEXT,
  ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS categories TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS creator_story TEXT,
  ADD COLUMN IF NOT EXISTS tiktok_url TEXT;

ALTER TABLE public.startups
  ADD COLUMN IF NOT EXISTS delegation TEXT,
  ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS tiktok_url TEXT;

-- Prevent impossible coordinates while still allowing NULL when the creator
-- chooses not to share their location.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'startup_applications_latitude_range'
  ) THEN
    ALTER TABLE public.startup_applications
      ADD CONSTRAINT startup_applications_latitude_range
      CHECK (latitude IS NULL OR latitude BETWEEN -90 AND 90);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'startup_applications_longitude_range'
  ) THEN
    ALTER TABLE public.startup_applications
      ADD CONSTRAINT startup_applications_longitude_range
      CHECK (longitude IS NULL OR longitude BETWEEN -180 AND 180);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'startups_latitude_range'
  ) THEN
    ALTER TABLE public.startups
      ADD CONSTRAINT startups_latitude_range
      CHECK (latitude IS NULL OR latitude BETWEEN -90 AND 90);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'startups_longitude_range'
  ) THEN
    ALTER TABLE public.startups
      ADD CONSTRAINT startups_longitude_range
      CHECK (longitude IS NULL OR longitude BETWEEN -180 AND 180);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_startup_applications_location
  ON public.startup_applications(latitude, longitude);

CREATE INDEX IF NOT EXISTS idx_startups_location
  ON public.startups(latitude, longitude);

-- Ask PostgREST to reload its schema cache after the migration.
NOTIFY pgrst, 'reload schema';
