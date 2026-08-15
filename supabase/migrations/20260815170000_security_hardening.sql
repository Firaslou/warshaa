-- Warsha security hardening

-- 1) A recipient may update a chat message only to change read_at.
CREATE OR REPLACE FUNCTION public.protect_chat_message_updates()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.id IS DISTINCT FROM OLD.id
     OR NEW.conversation_id IS DISTINCT FROM OLD.conversation_id
     OR NEW.sender_id IS DISTINCT FROM OLD.sender_id
     OR NEW.content IS DISTINCT FROM OLD.content
     OR NEW.attachments IS DISTINCT FROM OLD.attachments
     OR NEW.created_at IS DISTINCT FROM OLD.created_at
  THEN
    RAISE EXCEPTION 'Only read_at can be modified on an existing chat message';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.protect_chat_message_updates() FROM PUBLIC, anon, authenticated;

-- 2) Trigger-only functions must not be callable through the Data API.
REVOKE ALL ON FUNCTION public.enforce_single_admin() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.notify_admin_new_item() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.notify_application_status_change() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.notify_chat_recipient() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.notify_complaint_status_change() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.notify_creator_interaction() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.notify_live_event_started() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.notify_new_story() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.notify_startup_supporters() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.notify_supporters_new_product() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.prevent_owner_status_badge_change() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.sync_approved_creator_location() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.sync_supporters_count() FROM PUBLIC, anon, authenticated;

-- 3) Realtime private topics are scoped to the actual user/resource.
-- UUID-format checks prevent malformed topics from causing cast errors.
DROP POLICY IF EXISTS "Authenticated scoped realtime" ON realtime.messages;
CREATE POLICY "Authenticated scoped realtime"
ON realtime.messages
FOR ALL
TO authenticated
USING (
  (
    realtime.topic() LIKE 'chat:%'
    AND split_part(realtime.topic(), ':', 2) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    AND EXISTS (
      SELECT 1
      FROM public.chat_conversations c
      JOIN public.startups s ON s.id = c.startup_id
      WHERE c.id = split_part(realtime.topic(), ':', 2)::uuid
        AND (c.buyer_id = auth.uid() OR s.owner_id = auth.uid())
    )
  )
  OR (
    realtime.topic() LIKE 'notifications:%'
    AND split_part(realtime.topic(), ':', 2) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    AND split_part(realtime.topic(), ':', 2)::uuid = auth.uid()
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
)
WITH CHECK (
  (
    realtime.topic() LIKE 'chat:%'
    AND split_part(realtime.topic(), ':', 2) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    AND EXISTS (
      SELECT 1
      FROM public.chat_conversations c
      JOIN public.startups s ON s.id = c.startup_id
      WHERE c.id = split_part(realtime.topic(), ':', 2)::uuid
        AND (c.buyer_id = auth.uid() OR s.owner_id = auth.uid())
    )
  )
  OR (
    realtime.topic() LIKE 'notifications:%'
    AND split_part(realtime.topic(), ':', 2) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    AND split_part(realtime.topic(), ':', 2)::uuid = auth.uid()
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
