-- Count real product visits (including anonymous visitors) while limiting refresh spam.

ALTER TABLE public.product_views
  ALTER COLUMN user_id DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS visitor_id text;

ALTER TABLE public.product_views
  DROP CONSTRAINT IF EXISTS product_views_user_id_product_id_key;

CREATE INDEX IF NOT EXISTS product_views_product_created_idx
  ON public.product_views (product_id, created_at DESC);

CREATE INDEX IF NOT EXISTS product_views_visitor_recent_idx
  ON public.product_views (visitor_id, product_id, created_at DESC);

DROP POLICY IF EXISTS "Authenticated users log own views" ON public.product_views;

CREATE OR REPLACE FUNCTION public.record_product_view(_product_id uuid, _visitor_id text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_user_id uuid := auth.uid();
  normalized_visitor_id text := left(NULLIF(btrim(_visitor_id), ''), 100);
  product_owner_id uuid;
BEGIN
  SELECT s.owner_id
  INTO product_owner_id
  FROM public.products p
  JOIN public.startups s ON s.id = p.startup_id
  WHERE p.id = _product_id AND s.status = 'approved';

  IF product_owner_id IS NULL THEN
    RETURN false;
  END IF;

  -- A creator previewing their own product is not a customer visit.
  IF current_user_id IS NOT NULL AND current_user_id = product_owner_id THEN
    RETURN false;
  END IF;

  IF current_user_id IS NULL AND normalized_visitor_id IS NULL THEN
    RETURN false;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.product_views pv
    WHERE pv.product_id = _product_id
      AND pv.created_at >= now() - interval '30 minutes'
      AND (
        (current_user_id IS NOT NULL AND pv.user_id = current_user_id)
        OR (current_user_id IS NULL AND pv.user_id IS NULL AND pv.visitor_id = normalized_visitor_id)
      )
  ) THEN
    RETURN false;
  END IF;

  INSERT INTO public.product_views (product_id, user_id, visitor_id)
  VALUES (_product_id, current_user_id, normalized_visitor_id);
  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.record_product_view(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_product_view(uuid, text) TO anon, authenticated;

-- The creator dashboard listens to these tables and refreshes its aggregates.
DO $$
DECLARE
  current_table_name text;
BEGIN
  FOREACH current_table_name IN ARRAY ARRAY[
    'product_views',
    'product_likes',
    'startup_supporters',
    'purchase_clicks',
    'purchase_confirmations',
    'reviews',
    'product_comments',
    'products',
    'startups'
  ]
  LOOP
    IF NOT EXISTS (
      SELECT 1
      FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = current_table_name
    ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', current_table_name);
    END IF;
  END LOOP;
END;
$$;
