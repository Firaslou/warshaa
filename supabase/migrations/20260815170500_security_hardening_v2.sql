-- Warsha security hardening v2
-- Realtime Authorization is enforced only for private channels.
-- The client channels must use private=true for these policies to apply.

DROP POLICY IF EXISTS "Authenticated scoped realtime" ON realtime.messages;
DROP POLICY IF EXISTS "Warsha realtime read" ON realtime.messages;
DROP POLICY IF EXISTS "Warsha realtime write" ON realtime.messages;
DROP POLICY IF EXISTS "Warsha realtime presence" ON realtime.messages;

CREATE POLICY "Warsha realtime read"
ON realtime.messages FOR SELECT TO authenticated
USING (
  (realtime.topic() LIKE 'chat:%' AND realtime.messages.extension = 'broadcast'
    AND split_part(realtime.topic(), ':', 2) ~* '^[0-9a-f-]{36}$'
    AND EXISTS (
      SELECT 1 FROM public.chat_conversations c JOIN public.startups s ON s.id = c.startup_id
      WHERE c.id = split_part(realtime.topic(), ':', 2)::uuid
        AND (c.buyer_id = (select auth.uid()) OR s.owner_id = (select auth.uid()))
    ))
  OR (realtime.topic() LIKE 'notifications:%'
    AND split_part(realtime.topic(), ':', 2) ~* '^[0-9a-f-]{36}$'
    AND split_part(realtime.topic(), ':', 2)::uuid = (select auth.uid()))
  OR (realtime.topic() LIKE 'live_room:%'
    AND split_part(realtime.topic(), ':', 2) ~* '^[0-9a-f-]{36}$'
    AND EXISTS (
      SELECT 1 FROM public.live_events e
      WHERE e.id = split_part(realtime.topic(), ':', 2)::uuid AND e.status IN ('scheduled', 'live')
    ))
);

CREATE POLICY "Warsha realtime write"
ON realtime.messages FOR INSERT TO authenticated
WITH CHECK (
  (realtime.topic() LIKE 'chat:%' AND realtime.messages.extension = 'broadcast'
    AND realtime.messages.event IN ('message', 'chat_message', 'reaction')
    AND split_part(realtime.topic(), ':', 2) ~* '^[0-9a-f-]{36}$'
    AND EXISTS (
      SELECT 1 FROM public.chat_conversations c JOIN public.startups s ON s.id = c.startup_id
      WHERE c.id = split_part(realtime.topic(), ':', 2)::uuid
        AND (c.buyer_id = (select auth.uid()) OR s.owner_id = (select auth.uid()))
    ))
  OR (realtime.topic() LIKE 'notifications:%' AND realtime.messages.extension = 'broadcast'
    AND split_part(realtime.topic(), ':', 2) ~* '^[0-9a-f-]{36}$'
    AND split_part(realtime.topic(), ':', 2)::uuid = (select auth.uid()))
  OR (realtime.topic() LIKE 'live_room:%' AND realtime.messages.extension = 'broadcast'
    AND split_part(realtime.topic(), ':', 2) ~* '^[0-9a-f-]{36}$'
    AND EXISTS (
      SELECT 1 FROM public.live_events e
      WHERE e.id = split_part(realtime.topic(), ':', 2)::uuid AND e.status IN ('scheduled', 'live')
        AND (
          realtime.messages.event IN ('chat_message', 'reaction')
          OR (realtime.messages.event IN ('status_change', 'pin_product', 'webrtc_stream_ready', 'webrtc_offer')
            AND EXISTS (SELECT 1 FROM public.startups s WHERE s.id = e.startup_id AND s.owner_id = (select auth.uid())))
          OR (realtime.messages.event IN ('webrtc_viewer_join', 'webrtc_answer', 'webrtc_ice_candidate')
            AND EXISTS (SELECT 1 FROM public.startups s WHERE s.id = e.startup_id AND s.owner_id <> (select auth.uid())))
          OR (realtime.messages.event = 'webrtc_ice_candidate'
            AND EXISTS (SELECT 1 FROM public.startups s WHERE s.id = e.startup_id AND s.owner_id = (select auth.uid())))
        )
    ))
  OR (realtime.topic() LIKE 'live_room:%' AND realtime.messages.extension = 'presence'
    AND split_part(realtime.topic(), ':', 2) ~* '^[0-9a-f-]{36}$'
    AND EXISTS (
      SELECT 1 FROM public.live_events e
      WHERE e.id = split_part(realtime.topic(), ':', 2)::uuid AND e.status IN ('scheduled', 'live')
    ))
);

-- Analytics remain anonymously writable for public tracking, but are no longer publicly readable.
DROP POLICY IF EXISTS "Permettre la lecture publique" ON public.analytics_events;
DROP POLICY IF EXISTS "Permettre l'insertion publique" ON public.analytics_events;
DROP POLICY IF EXISTS "Analytics public insert" ON public.analytics_events;
DROP POLICY IF EXISTS "Analytics admin read" ON public.analytics_events;

CREATE POLICY "Analytics public insert" ON public.analytics_events
FOR INSERT TO anon, authenticated WITH CHECK (true);

CREATE POLICY "Analytics admin read" ON public.analytics_events
FOR SELECT TO authenticated USING (public.has_role((select auth.uid()), 'admin'));

-- Remove unnecessary SECURITY DEFINER privileges without rewriting the existing RPC bodies.
ALTER FUNCTION public.get_startup_stats(uuid) SECURITY INVOKER;
ALTER FUNCTION public.get_product_stats(uuid) SECURITY INVOKER;
REVOKE ALL ON FUNCTION public.get_startup_stats(uuid) FROM anon;
REVOKE ALL ON FUNCTION public.get_product_stats(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_startup_stats(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_product_stats(uuid) TO authenticated, service_role;
