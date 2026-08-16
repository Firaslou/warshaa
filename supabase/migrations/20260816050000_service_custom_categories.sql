-- Keep the public category stable as "Autre" while allowing creators to add a
-- private-to-the-catalog search label that helps users find uncommon services.
ALTER TABLE public.services
  ADD COLUMN IF NOT EXISTS custom_category text;

ALTER TABLE public.services
  DROP CONSTRAINT IF EXISTS services_custom_category_length_check;
ALTER TABLE public.services
  ADD CONSTRAINT services_custom_category_length_check
  CHECK (custom_category IS NULL OR char_length(btrim(custom_category)) BETWEEN 2 AND 80);

ALTER TABLE public.services
  DROP CONSTRAINT IF EXISTS services_custom_category_scope_check;
ALTER TABLE public.services
  ADD CONSTRAINT services_custom_category_scope_check
  CHECK (category = 'Autre' OR custom_category IS NULL);

CREATE INDEX IF NOT EXISTS services_custom_category_search_idx
  ON public.services (lower(custom_category))
  WHERE custom_category IS NOT NULL;
