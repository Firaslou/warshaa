-- A chat notification belongs only to the other participant, never the sender.
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

  -- Ignore a malformed message whose sender is not one of the participants.
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
      '/messages'
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
