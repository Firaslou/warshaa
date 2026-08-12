-- 1) Remove misleading self-referencing WITH CHECK; trigger is sole enforcement
DROP POLICY IF EXISTS "Owners can update their startup" ON public.startups;
CREATE POLICY "Owners can update their startup"
ON public.startups
FOR UPDATE
TO authenticated
USING (auth.uid() = owner_id)
WITH CHECK (auth.uid() = owner_id);

-- Make sure the trigger enforcement exists and covers every update path
DROP TRIGGER IF EXISTS trg_prevent_owner_status_badge_change ON public.startups;
CREATE TRIGGER trg_prevent_owner_status_badge_change
BEFORE UPDATE ON public.startups
FOR EACH ROW EXECUTE FUNCTION public.prevent_owner_status_badge_change();

-- 2) Explicit admin-only modification rules for purchase_clicks
DROP POLICY IF EXISTS "Admins can update clicks" ON public.purchase_clicks;
CREATE POLICY "Admins can update clicks"
ON public.purchase_clicks
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins can delete clicks" ON public.purchase_clicks;
CREATE POLICY "Admins can delete clicks"
ON public.purchase_clicks
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- 3) Harden SECURITY DEFINER stats RPCs: only approved shops (or owner/admin)
CREATE OR REPLACE FUNCTION public.get_startup_stats(_startup_id uuid)
RETURNS json
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  allowed boolean;
BEGIN
  SELECT (s.status = 'approved' OR s.owner_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
  INTO allowed
  FROM public.startups s WHERE s.id = _startup_id;

  IF NOT COALESCE(allowed, false) THEN
    RETURN NULL;
  END IF;

  RETURN (SELECT json_build_object(
    'views', (SELECT count(*) FROM public.product_views v JOIN public.products p ON p.id = v.product_id WHERE p.startup_id = _startup_id),
    'views_30d', (SELECT count(*) FROM public.product_views v JOIN public.products p ON p.id = v.product_id WHERE p.startup_id = _startup_id AND v.created_at >= now() - interval '30 days'),
    'clicks', (SELECT count(*) FROM public.purchase_clicks WHERE startup_id = _startup_id),
    'purchases', (SELECT count(*) FROM public.purchase_confirmations WHERE startup_id = _startup_id),
    'likes', (SELECT count(*) FROM public.product_likes l JOIN public.products p ON p.id = l.product_id WHERE p.startup_id = _startup_id),
    'supporters', (SELECT count(*) FROM public.startup_supporters WHERE startup_id = _startup_id),
    'comments', (SELECT count(*) FROM public.product_comments c JOIN public.products p ON p.id = c.product_id WHERE p.startup_id = _startup_id),
    'reviews', (SELECT count(*) FROM public.reviews WHERE startup_id = _startup_id),
    'products', (SELECT count(*) FROM public.products WHERE startup_id = _startup_id)
  ));
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_product_stats(_product_id uuid)
RETURNS json
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  allowed boolean;
BEGIN
  SELECT (s.status = 'approved' OR s.owner_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
  INTO allowed
  FROM public.products p JOIN public.startups s ON s.id = p.startup_id
  WHERE p.id = _product_id;

  IF NOT COALESCE(allowed, false) THEN
    RETURN NULL;
  END IF;

  RETURN (SELECT json_build_object(
    'views', (SELECT count(*) FROM public.product_views WHERE product_id = _product_id),
    'likes', (SELECT count(*) FROM public.product_likes WHERE product_id = _product_id),
    'comments', (SELECT count(*) FROM public.product_comments WHERE product_id = _product_id),
    'reviews', (SELECT count(*) FROM public.reviews WHERE product_id = _product_id),
    'purchases', (SELECT count(*) FROM public.purchase_confirmations WHERE product_id = _product_id),
    'avg_rating', COALESCE((SELECT round(avg(rating)::numeric, 1) FROM public.reviews WHERE product_id = _product_id), 0)
  ));
END;
$function$;

REVOKE ALL ON FUNCTION public.get_startup_stats(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_product_stats(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_startup_stats(uuid) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_product_stats(uuid) TO anon, authenticated, service_role;