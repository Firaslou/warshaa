ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS is_eco boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS videos text[] NOT NULL DEFAULT '{}'::text[];