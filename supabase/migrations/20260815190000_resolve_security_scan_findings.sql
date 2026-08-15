-- Resolve the nine Lovable findings by removing obsolete live signaling,
-- eliminating caller-controlled anonymous identities, and minimizing grants.

-- Warsha now supports external live links only. Remove all credentials and
-- metadata that could reactivate the retired native/Agora implementation.
UPDATE public.live_events
SET live_mode = 'external',
    external_url = COALESCE(external_url, stream_url)
WHERE live_mode IS DISTINCT FROM 'external';

ALTER TABLE public.live_events DROP COLUMN IF EXISTS agora_channel;
ALTER TABLE public.live_events DROP COLUMN IF EXISTS agora_uid;
ALTER TABLE public.live_events DROP CONSTRAINT IF EXISTS live_events_live_mode_check;
ALTER TABLE public.live_events
  ADD CONSTRAINT live_events_live_mode_check CHECK (live_mode = 'external');
ALTER TABLE public.live_events ALTER COLUMN live_mode SET DEFAULT 'external';

-- Even if an old client still knows a live_room topic, Realtime Authorization
-- rejects reads, writes, broadcast, and presence on that topic.
DROP POLICY IF EXISTS "Deny obsolete live signaling" ON realtime.messages;
CREATE POLICY "Deny obsolete live signaling"
ON realtime.messages AS RESTRICTIVE FOR ALL TO authenticated
USING (realtime.topic() NOT LIKE 'live_room:%')
WITH CHECK (realtime.topic() NOT LIKE 'live_room:%');

-- Browser-generated visitor IDs provide no ownership guarantee. Return to
-- authenticated, RLS-owned views with one row per user/product.
DROP FUNCTION IF EXISTS public.record_product_view(uuid, text);
DROP INDEX IF EXISTS public.product_views_visitor_recent_idx;
DELETE FROM public.product_views WHERE user_id IS NULL;
ALTER TABLE public.product_views ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE public.product_views DROP COLUMN IF EXISTS visitor_id;
ALTER TABLE public.product_views
  DROP CONSTRAINT IF EXISTS product_views_user_id_product_id_key;
ALTER TABLE public.product_views
  ADD CONSTRAINT product_views_user_id_product_id_key UNIQUE (user_id, product_id);

DROP POLICY IF EXISTS "Authenticated users log own views" ON public.product_views;
CREATE POLICY "Authenticated users log own views"
ON public.product_views FOR INSERT TO authenticated
WITH CHECK ((select auth.uid()) = user_id);

-- PostgreSQL grants EXECUTE to PUBLIC on new functions unless changed. Prevent
-- that default and explicitly remove Data API access from every trigger-only
-- SECURITY DEFINER function. Triggers continue to execute normally.
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;

DO $$
DECLARE
  fn record;
BEGIN
  FOR fn IN
    SELECT n.nspname, p.proname, pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prosecdef
      AND p.prorettype = 'trigger'::regtype
  LOOP
    EXECUTE format(
      'REVOKE ALL ON FUNCTION %I.%I(%s) FROM PUBLIC, anon, authenticated',
      fn.nspname, fn.proname, fn.args
    );
  END LOOP;
END;
$$;

-- Stats helpers do not require elevated privileges. They retain their existing
-- authorization checks and run with the caller's RLS permissions.
ALTER FUNCTION public.get_platform_stats() SECURITY INVOKER;
ALTER FUNCTION public.get_startup_stats(uuid) SECURITY INVOKER;
ALTER FUNCTION public.get_product_stats(uuid) SECURITY INVOKER;
REVOKE ALL ON FUNCTION public.get_platform_stats() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_startup_stats(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_product_stats(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_platform_stats() TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_startup_stats(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_product_stats(uuid) TO authenticated, service_role;
