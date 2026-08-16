-- Services are intentionally separate from products: they have no stock and use
-- pricing/location/duration concepts that do not belong on product records.
CREATE TABLE IF NOT EXISTS public.services (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  startup_id uuid NOT NULL REFERENCES public.startups(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (char_length(btrim(name)) BETWEEN 2 AND 120),
  description text CHECK (description IS NULL OR char_length(description) <= 2000),
  category text NOT NULL CHECK (char_length(btrim(category)) BETWEEN 2 AND 80),
  pricing_type text NOT NULL DEFAULT 'quote' CHECK (pricing_type IN ('fixed', 'from', 'hourly', 'quote')),
  price numeric(10,3) CHECK (price IS NULL OR price >= 0),
  currency text NOT NULL DEFAULT 'TND' CHECK (char_length(currency) BETWEEN 3 AND 5),
  images text[] NOT NULL DEFAULT '{}',
  location_type text NOT NULL DEFAULT 'customer' CHECK (location_type IN ('provider', 'customer', 'mobile', 'remote')),
  service_area text CHECK (service_area IS NULL OR char_length(service_area) <= 160),
  duration_minutes integer CHECK (duration_minutes IS NULL OR duration_minutes BETWEEN 15 AND 10080),
  availability_text text CHECK (availability_text IS NULL OR char_length(availability_text) <= 300),
  is_published boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS services_startup_id_idx ON public.services(startup_id);
CREATE INDEX IF NOT EXISTS services_public_catalog_idx ON public.services(is_published, category, created_at DESC);

ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Published services are public" ON public.services;
CREATE POLICY "Published services are public"
ON public.services FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.startups s
    WHERE s.id = services.startup_id
      AND ((services.is_published AND s.status = 'approved') OR s.owner_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
  )
);

DROP POLICY IF EXISTS "Creators manage their services" ON public.services;
CREATE POLICY "Creators manage their services"
ON public.services FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.startups s WHERE s.id = services.startup_id AND s.owner_id = auth.uid()))
WITH CHECK (EXISTS (SELECT 1 FROM public.startups s WHERE s.id = services.startup_id AND s.owner_id = auth.uid()));

DROP POLICY IF EXISTS "Admins manage all services" ON public.services;
CREATE POLICY "Admins manage all services"
ON public.services FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP TRIGGER IF EXISTS services_set_updated_at ON public.services;
CREATE TRIGGER services_set_updated_at
BEFORE UPDATE ON public.services
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.service_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  service_id uuid NOT NULL REFERENCES public.services(id) ON DELETE CASCADE,
  rating integer NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment text CHECK (comment IS NULL OR char_length(comment) <= 2000),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, service_id)
);

CREATE INDEX IF NOT EXISTS service_reviews_service_id_idx ON public.service_reviews(service_id, created_at DESC);
ALTER TABLE public.service_reviews ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public reads reviews of visible services" ON public.service_reviews;
CREATE POLICY "Public reads reviews of visible services"
ON public.service_reviews FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.services sv
    JOIN public.startups s ON s.id = sv.startup_id
    WHERE sv.id = service_reviews.service_id
      AND ((sv.is_published AND s.status = 'approved') OR s.owner_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
  )
);

DROP POLICY IF EXISTS "Users review public services" ON public.service_reviews;
CREATE POLICY "Users review public services"
ON public.service_reviews FOR INSERT TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND EXISTS (
    SELECT 1 FROM public.services sv
    JOIN public.startups s ON s.id = sv.startup_id
    WHERE sv.id = service_reviews.service_id
      AND sv.is_published
      AND s.status = 'approved'
      AND s.owner_id <> auth.uid()
  )
);

DROP POLICY IF EXISTS "Users update their service reviews" ON public.service_reviews;
CREATE POLICY "Users update their service reviews"
ON public.service_reviews FOR UPDATE TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (
  auth.uid() = user_id
  AND EXISTS (
    SELECT 1 FROM public.services sv
    JOIN public.startups s ON s.id = sv.startup_id
    WHERE sv.id = service_reviews.service_id
      AND sv.is_published
      AND s.status = 'approved'
      AND s.owner_id <> auth.uid()
  )
);

DROP POLICY IF EXISTS "Users delete their service reviews" ON public.service_reviews;
CREATE POLICY "Users delete their service reviews"
ON public.service_reviews FOR DELETE TO authenticated
USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

DROP TRIGGER IF EXISTS service_reviews_set_updated_at ON public.service_reviews;
CREATE TRIGGER service_reviews_set_updated_at
BEFORE UPDATE ON public.service_reviews
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

GRANT SELECT ON public.services, public.service_reviews TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.services, public.service_reviews TO authenticated;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'services'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.services;
  END IF;
END $$;
