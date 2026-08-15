-- Warsha security hardening v2
-- Realtime Authorization is enforced only for private channels.
-- The client channels are updated separately to use private=true.

-- 1) Replace the catch-all realtime policy with action-specific policies.
DROP POLICY IF EXISTS "Authenticated scoped realtime" ON realtime.messages;
DROP POLICY IF EXISTS "Warsha realtime read" ON realtime.messages;
DROP POLICY IF EXISTS "Warsha realtime write" ON realtime.messages;
DROP POLICY IF EXISTS "Warsha realtime presence" ON realtime.messages;

CREATE POLICY "Warsha realtime read"
ON realtime.messages
FOR SELECT
TO authenticated
USING (
  (
    realtime.topic() LIKE 'chat:%'
    AND split_part(realtime.topic(), ':', 2) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    AND realtime.messages.extension = 'broadcast'
    AND EXISTS (
      SELECT 1
      FROM public.chat_conversations c
      JOIN public.startups s ON s.id = c.startup_id
      WHERE c.id = split_part(realtime.topic(), ':', 2)::uuid
        AND (c.buyer_id = (select auth.uid()) OR s.owner_id = (select auth.uid()))
    )
  )
  OR (
    realtime.topic() LIKE 'notifications:%'
    AND split_part(realtime.topic(), ':', 2) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    AND split_part(realtime.topic(), ':', 2)::uuid = (select auth.uid())
  )
  OR (
    realtime.topic() LIKE 'live_room:%'
    AND split_part(realtime.topic(), ':', 2) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    AND EXISTS (
      SELECT 1
      FROM public.live_events e
      WHERE e.id = split_part(realtime.topic(), ':', 2)::uuid
        AND e.status IN ('scheduled', 'live')
    )
  )
);

CREATE POLICY "Warsha realtime write"
ON realtime.messages
FOR INSERT
TO authenticated
WITH CHECK (
  (
    realtime.topic() LIKE 'chat:%'
    AND realtime.messages.extension = 'broadcast'
    AND realtime.messages.event IN ('message', 'chat_message', 'reaction')
    AND split_part(realtime.topic(), ':', 2) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    AND EXISTS (
      SELECT 1
      FROM public.chat_conversations c
      JOIN public.startups s ON s.id = c.startup_id
      WHERE c.id = split_part(realtime.topic(), ':', 2)::uuid
        AND (c.buyer_id = (select auth.uid()) OR s.owner_id = (select auth.uid()))
    )
  )
  OR (
    realtime.topic() LIKE 'notifications:%'
    AND realtime.messages.extension = 'broadcast'
    AND split_part(realtime.topic(), ':', 2) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    AND split_part(realtime.topic(), ':', 2)::uuid = (select auth.uid())
  )
  OR (
    realtime.topic() LIKE 'live_room:%'
    AND realtime.messages.extension = 'broadcast'
    AND split_part(realtime.topic(), ':', 2) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    AND EXISTS (
      SELECT 1
      FROM public.live_events e
      WHERE e.id = split_part(realtime.topic(), ':', 2)::uuid
        AND e.status IN ('scheduled', 'live')
        AND (
          realtime.messages.event IN ('chat_message', 'reaction')
          OR (realtime.messages.event IN ('status_change', 'pin_product', 'webrtc_stream_ready', 'webrtc_offer') AND EXISTS (
            SELECT 1 FROM public.startups s WHERE s.id = e.startup_id AND s.owner_id = (select auth.uid())
          ))
          OR (realtime.messages.event IN ('webrtc_viewer_join', 'webrtc_answer', 'webrtc_ice_candidate') AND EXISTS (
            SELECT 1 FROM public.startups s WHERE s.id = e.startup_id AND s.owner_id <> (select auth.uid())
          ))
          OR (realtime.messages.event = 'webrtc_ice_candidate' AND EXISTS (
            SELECT 1 FROM public.startups s WHERE s.id = e.startup_id AND s.owner_id = (select auth.uid())
          ))
        )
    )
  )
  OR (
    realtime.topic() LIKE 'live_room:%'
    AND realtime.messages.extension = 'presence'
    AND split_part(realtime.topic(), ':', 2) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    AND EXISTS (
      SELECT 1
      FROM public.live_events e
      WHERE e.id = split_part(realtime.topic(), ':', 2)::uuid
        AND e.status IN ('scheduled', 'live')
    )
  )
);

-- 2) Prevent anonymous analytics rows from being readable/manipulable.
-- Analytics are write-only from the public client; administrators can inspect them server-side.
DROP POLICY IF EXISTS "Permettre la lecture publique" ON public.analytics_events;
DROP POLICY IF EXISTS "Permettre l'insertion publique" ON public.analytics_events;
DROP POLICY IF EXISTS "Analytics public insert" ON public.analytics_events;
DROP POLICY IF EXISTS "Analytics admin read" ON public.analytics_events;

CREATE POLICY "Analytics authenticated insert"
ON public.analytics_events
FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Analytics admin read"
ON public.analytics_events
FOR SELECT
TO authenticated
USING (public.has_role((select auth.uid()), 'admin'));

-- 3) SECURITY DEFINER stats RPCs do not need definer privileges.
-- They are used by signed-in creator/admin dashboards and can obey normal RLS.
CREATE OR REPLACE FUNCTION public.get_startup_stats(_startup_id uuid)
RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.startups s
    WHERE s.id = _startup_id
      AND (s.status = 'approved' OR s.owner_id = (select auth.uid()) OR public.has_role((select auth.uid()), 'admin'))
  ) THEN
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
STABLE
SECURITY INVOKER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.products p
    JOIN public.startups s ON s.id = p.startup_id
    WHERE p.id = _product_id
      AND (s.status = 'approved' OR s.owner_id = (select auth.uid()) OR public.has_role((select auth.uid()), 'admin'))
  ) THEN
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

REVOKE ALL ON FUNCTION public.get_startup_stats(uuid) FROM anon;
REVOKE ALL ON FUNCTION public.get_product_stats(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_startup_stats(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_product_stats(uuid) TO authenticated, service_role;
