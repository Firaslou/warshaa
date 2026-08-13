-- Track which messages have been read and target notifications to one conversation.
ALTER TABLE public.chat_messages
ADD COLUMN IF NOT EXISTS read_at timestamptz;

CREATE INDEX IF NOT EXISTS chat_messages_unread_idx
ON public.chat_messages (conversation_id, created_at DESC)
WHERE read_at IS NULL;

DROP POLICY IF EXISTS "Participants mark received messages read" ON public.chat_messages;
CREATE POLICY "Participants mark received messages read"
ON public.chat_messages FOR UPDATE TO authenticated
USING (
  sender_id <> auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.chat_conversations conversation
    WHERE conversation.id = chat_messages.conversation_id
      AND (
        conversation.buyer_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.startups startup
          WHERE startup.id = conversation.startup_id
            AND startup.owner_id = auth.uid()
        )
      )
  )
)
WITH CHECK (
  sender_id <> auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.chat_conversations conversation
    WHERE conversation.id = chat_messages.conversation_id
      AND (
        conversation.buyer_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.startups startup
          WHERE startup.id = conversation.startup_id
            AND startup.owner_id = auth.uid()
        )
      )
  )
);

CREATE OR REPLACE FUNCTION public.notify_chat_recipient()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  buyer_id uuid;
  creator_owner_id uuid;
  recipient_id uuid;
BEGIN
  SELECT conversation.buyer_id, startup.owner_id
  INTO buyer_id, creator_owner_id
  FROM public.chat_conversations AS conversation
  JOIN public.startups AS startup ON startup.id = conversation.startup_id
  WHERE conversation.id = NEW.conversation_id;

  IF NEW.sender_id = buyer_id THEN
    recipient_id := creator_owner_id;
  ELSIF NEW.sender_id = creator_owner_id THEN
    recipient_id := buyer_id;
  ELSE
    RETURN NEW;
  END IF;

  IF recipient_id IS NOT NULL AND recipient_id IS DISTINCT FROM NEW.sender_id THEN
    INSERT INTO public.notifications (user_id, type, title, body, link)
    VALUES (
      recipient_id,
      'message',
      'Nouveau message',
      CASE
        WHEN NULLIF(btrim(NEW.content), '') IS NULL THEN 'Une nouvelle pièce jointe a été reçue.'
        ELSE left(NEW.content, 160)
      END,
      '/messages?conversation=' || NEW.conversation_id::text
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS notify_chat_recipient_trg ON public.chat_messages;
CREATE TRIGGER notify_chat_recipient_trg
AFTER INSERT ON public.chat_messages
FOR EACH ROW EXECUTE FUNCTION public.notify_chat_recipient();

REVOKE ALL ON FUNCTION public.notify_chat_recipient() FROM PUBLIC, anon, authenticated;
