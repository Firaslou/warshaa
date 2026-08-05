CREATE OR REPLACE FUNCTION public.get_platform_stats()
RETURNS json
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT json_build_object(
    'active_creators', (SELECT count(*) FROM public.startups WHERE status = 'approved'),
    'month_supporters', (SELECT count(*) FROM public.startup_supporters WHERE created_at >= now() - interval '30 days'),
    'total_supporters', (SELECT count(*) FROM public.startup_supporters),
    'confirmed_purchases', (SELECT count(*) FROM public.purchase_confirmations),
    'verified_percent', COALESCE((
      SELECT round(100.0 * count(*) FILTER (WHERE badge IN ('verified','certified')) / NULLIF(count(*), 0))
      FROM public.startups WHERE status = 'approved'
    ), 0)
  )
$$;

CREATE OR REPLACE FUNCTION public.get_startup_stats(_startup_id uuid)
RETURNS json
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT json_build_object(
    'views', (SELECT count(*) FROM public.product_views v JOIN public.products p ON p.id = v.product_id WHERE p.startup_id = _startup_id),
    'views_30d', (SELECT count(*) FROM public.product_views v JOIN public.products p ON p.id = v.product_id WHERE p.startup_id = _startup_id AND v.created_at >= now() - interval '30 days'),
    'clicks', (SELECT count(*) FROM public.purchase_clicks WHERE startup_id = _startup_id),
    'purchases', (SELECT count(*) FROM public.purchase_confirmations WHERE startup_id = _startup_id),
    'likes', (SELECT count(*) FROM public.product_likes l JOIN public.products p ON p.id = l.product_id WHERE p.startup_id = _startup_id),
    'supporters', (SELECT count(*) FROM public.startup_supporters WHERE startup_id = _startup_id),
    'comments', (SELECT count(*) FROM public.product_comments c JOIN public.products p ON p.id = c.product_id WHERE p.startup_id = _startup_id),
    'reviews', (SELECT count(*) FROM public.reviews WHERE startup_id = _startup_id),
    'products', (SELECT count(*) FROM public.products WHERE startup_id = _startup_id)
  )
$$;

CREATE OR REPLACE FUNCTION public.get_product_stats(_product_id uuid)
RETURNS json
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT json_build_object(
    'views', (SELECT count(*) FROM public.product_views WHERE product_id = _product_id),
    'likes', (SELECT count(*) FROM public.product_likes WHERE product_id = _product_id),
    'comments', (SELECT count(*) FROM public.product_comments WHERE product_id = _product_id),
    'reviews', (SELECT count(*) FROM public.reviews WHERE product_id = _product_id),
    'purchases', (SELECT count(*) FROM public.purchase_confirmations WHERE product_id = _product_id),
    'avg_rating', COALESCE((SELECT round(avg(rating)::numeric, 1) FROM public.reviews WHERE product_id = _product_id), 0)
  )
$$;

REVOKE ALL ON FUNCTION public.get_platform_stats() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_startup_stats(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_product_stats(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_platform_stats() TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_startup_stats(uuid) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_product_stats(uuid) TO anon, authenticated, service_role;