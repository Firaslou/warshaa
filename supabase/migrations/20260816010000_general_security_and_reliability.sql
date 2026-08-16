-- General production hardening for the independently hosted Warsha stack.

-- AI-backed Edge Functions must not allow one authenticated account to exhaust
-- the shared Gemini quota. Only service_role can consume/check these counters.
CREATE TABLE IF NOT EXISTS public.edge_rate_limits (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  scope text NOT NULL CHECK (char_length(scope) BETWEEN 1 AND 80),
  window_started_at timestamptz NOT NULL DEFAULT now(),
  request_count integer NOT NULL DEFAULT 0 CHECK (request_count >= 0),
  PRIMARY KEY (user_id, scope)
);

ALTER TABLE public.edge_rate_limits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.edge_rate_limits FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.edge_rate_limits TO service_role;

CREATE OR REPLACE FUNCTION public.consume_edge_rate_limit(
  _user_id uuid,
  _scope text,
  _limit integer,
  _window_seconds integer DEFAULT 60
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_count integer;
BEGIN
  IF _user_id IS NULL
     OR char_length(_scope) NOT BETWEEN 1 AND 80
     OR _limit NOT BETWEEN 1 AND 1000
     OR _window_seconds NOT BETWEEN 1 AND 86400
  THEN
    RAISE EXCEPTION 'Invalid rate-limit parameters';
  END IF;

  INSERT INTO public.edge_rate_limits AS limits (
    user_id, scope, window_started_at, request_count
  )
  VALUES (_user_id, _scope, now(), 1)
  ON CONFLICT (user_id, scope) DO UPDATE
  SET
    window_started_at = CASE
      WHEN limits.window_started_at <= now() - make_interval(secs => _window_seconds)
        THEN now()
      ELSE limits.window_started_at
    END,
    request_count = CASE
      WHEN limits.window_started_at <= now() - make_interval(secs => _window_seconds)
        THEN 1
      ELSE limits.request_count + 1
    END
  RETURNING request_count INTO current_count;

  RETURN current_count <= _limit;
END;
$$;

REVOKE ALL ON FUNCTION public.consume_edge_rate_limit(uuid, text, integer, integer)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_edge_rate_limit(uuid, text, integer, integer)
  TO service_role;

-- Analytics are currently not written by the application. Close the old
-- anonymous write-anything policy instead of leaving an unbounded spam sink.
DROP POLICY IF EXISTS "Permettre l'insertion publique" ON public.analytics_events;
DROP POLICY IF EXISTS "Analytics public insert" ON public.analytics_events;

-- Remove obsolete blanket-deny policies and native-live authorization. Chat
-- typing is now carried on a private, participant-only broadcast channel.
DROP POLICY IF EXISTS "Deny broadcast/presence to anon" ON realtime.messages;
DROP POLICY IF EXISTS "Deny broadcast/presence to authenticated" ON realtime.messages;
DROP POLICY IF EXISTS "Deny obsolete live signaling" ON realtime.messages;
DROP POLICY IF EXISTS "Authenticated can receive own realtime" ON realtime.messages;
DROP POLICY IF EXISTS "Authenticated scoped realtime" ON realtime.messages;
DROP POLICY IF EXISTS "Warsha realtime read" ON realtime.messages;
DROP POLICY IF EXISTS "Warsha realtime write" ON realtime.messages;

CREATE POLICY "Warsha realtime read"
ON realtime.messages FOR SELECT TO authenticated
USING (
  realtime.topic() LIKE 'chat:%'
  AND realtime.messages.extension = 'broadcast'
  AND split_part(realtime.topic(), ':', 2)
      ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
  AND EXISTS (
    SELECT 1
    FROM public.chat_conversations c
    JOIN public.startups s ON s.id = c.startup_id
    WHERE c.id = split_part(realtime.topic(), ':', 2)::uuid
      AND (c.buyer_id = (SELECT auth.uid()) OR s.owner_id = (SELECT auth.uid()))
  )
);

CREATE POLICY "Warsha realtime write"
ON realtime.messages FOR INSERT TO authenticated
WITH CHECK (
  realtime.topic() LIKE 'chat:%'
  AND realtime.messages.extension = 'broadcast'
  AND realtime.messages.event = 'typing'
  AND split_part(realtime.topic(), ':', 2)
      ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
  AND EXISTS (
    SELECT 1
    FROM public.chat_conversations c
    JOIN public.startups s ON s.id = c.startup_id
    WHERE c.id = split_part(realtime.topic(), ':', 2)::uuid
      AND (c.buyer_id = (SELECT auth.uid()) OR s.owner_id = (SELECT auth.uid()))
  )
);

-- Owners can edit their public profile but cannot transfer ownership or forge
-- counters/status. Nested supporter-count maintenance remains allowed.
CREATE OR REPLACE FUNCTION public.prevent_owner_status_badge_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.has_role((SELECT auth.uid()), 'admin') THEN
    RETURN NEW;
  END IF;

  IF NEW.owner_id IS DISTINCT FROM OLD.owner_id THEN
    RAISE EXCEPTION 'Only admins can transfer startup ownership';
  END IF;
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    RAISE EXCEPTION 'Only admins can change status';
  END IF;
  IF NEW.badge IS DISTINCT FROM OLD.badge THEN
    RAISE EXCEPTION 'Only admins can change badge';
  END IF;
  IF NEW.likes_count IS DISTINCT FROM OLD.likes_count THEN
    RAISE EXCEPTION 'likes_count is system managed';
  END IF;
  IF NEW.supporters_count IS DISTINCT FROM OLD.supporters_count
     AND pg_trigger_depth() <= 1
  THEN
    RAISE EXCEPTION 'supporters_count is system managed';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.prevent_owner_status_badge_change()
  FROM PUBLIC, anon, authenticated;

-- Keep trigger-only functions unreachable through the Data API, including
-- functions added by future migrations in this schema.
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;
