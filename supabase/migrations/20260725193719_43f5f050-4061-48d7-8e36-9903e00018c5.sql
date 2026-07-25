
-- 1. password_reset_codes
REVOKE ALL ON public.password_reset_codes FROM anon, authenticated;
GRANT ALL ON public.password_reset_codes TO service_role;
DROP POLICY IF EXISTS "No public access to reset codes" ON public.password_reset_codes;
CREATE POLICY "No public access to reset codes"
ON public.password_reset_codes AS RESTRICTIVE FOR ALL
TO anon, authenticated
USING (false) WITH CHECK (false);

-- 2. realtime.messages
DROP POLICY IF EXISTS "Deny broadcast/presence to anon" ON realtime.messages;
DROP POLICY IF EXISTS "Deny broadcast/presence to authenticated" ON realtime.messages;
CREATE POLICY "Deny broadcast/presence to anon"
ON realtime.messages AS RESTRICTIVE FOR ALL
TO anon USING (false) WITH CHECK (false);
CREATE POLICY "Deny broadcast/presence to authenticated"
ON realtime.messages AS RESTRICTIVE FOR ALL
TO authenticated USING (false) WITH CHECK (false);

-- 3. Revoke EXECUTE on SECURITY DEFINER trigger functions
REVOKE EXECUTE ON FUNCTION public.prevent_owner_status_badge_change() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.sync_supporters_count() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.enforce_single_admin() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.set_updated_at() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated;

-- 4. Move pg_net to extensions schema (drop and recreate — no app dependencies)
CREATE SCHEMA IF NOT EXISTS extensions;
GRANT USAGE ON SCHEMA extensions TO postgres, anon, authenticated, service_role;
DROP EXTENSION IF EXISTS pg_net;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;
