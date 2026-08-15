-- Optional precise location captured from the creator's device.
-- Nullable so manual city/delegation entry remains fully supported.
ALTER TABLE public.startup_applications
  ADD COLUMN IF NOT EXISTS delegation text,
  ADD COLUMN IF NOT EXISTS latitude double precision,
  ADD COLUMN IF NOT EXISTS longitude double precision;

-- Store the same coordinates on approved creators so the public map can use the exact point.
ALTER TABLE public.startups
  ADD COLUMN IF NOT EXISTS latitude double precision,
  ADD COLUMN IF NOT EXISTS longitude double precision;

-- Keep coordinates in valid geographic ranges when supplied.
ALTER TABLE public.startup_applications
  ADD CONSTRAINT startup_applications_latitude_range
    CHECK (latitude IS NULL OR latitude BETWEEN -90 AND 90),
  ADD CONSTRAINT startup_applications_longitude_range
    CHECK (longitude IS NULL OR longitude BETWEEN -180 AND 180);

ALTER TABLE public.startups
  ADD CONSTRAINT startups_latitude_range
    CHECK (latitude IS NULL OR latitude BETWEEN -90 AND 90),
  ADD CONSTRAINT startups_longitude_range
    CHECK (longitude IS NULL OR longitude BETWEEN -180 AND 180);
