-- Persist notifications for chat messages and important account activity.

CREATE OR REPLACE FUNCTION public.notify_chat_recipient()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  recipient_id uuid;
  creator_owner_id uuid;
  creator_name text;
BEGIN
  SELECT s.owner_id, s.name
  INTO creator_owner_id, creator_name
  FROM public.chat_conversations c
  JOIN public.startups s ON s.id = c.startup_id
  WHERE c.id = NEW.conversation_id;

  SELECT CASE
    WHEN NEW.sender_id = c.buyer_id THEN creator_owner_id
    ELSE c.buyer_id
  END
  INTO recipient_id
  FROM public.chat_conversations c
  WHERE c.id = NEW.conversation_id;

  IF recipient_id IS NOT NULL AND recipient_id <> NEW.sender_id THEN
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

CREATE OR REPLACE FUNCTION public.notify_application_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.notifications (user_id, type, title, body, link)
    VALUES (
      NEW.applicant_id,
      'application_status',
      'Mise à jour de votre candidature',
      CASE NEW.status::text
        WHEN 'approved' THEN 'Félicitations, votre candidature créateur a été approuvée.'
        WHEN 'rejected' THEN 'Votre candidature créateur a été refusée.'
        ELSE 'Votre candidature est maintenant en cours de traitement.'
      END,
      '/dashboard'
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS notify_application_status_change_trg ON public.startup_applications;
CREATE TRIGGER notify_application_status_change_trg
AFTER UPDATE OF status ON public.startup_applications
FOR EACH ROW EXECUTE FUNCTION public.notify_application_status_change();

CREATE OR REPLACE FUNCTION public.notify_complaint_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status OR NEW.admin_response IS DISTINCT FROM OLD.admin_response THEN
    INSERT INTO public.notifications (user_id, type, title, body, link)
    VALUES (
      NEW.reporter_id,
      'complaint_status',
      'Mise à jour de votre réclamation',
      COALESCE(NULLIF(NEW.admin_response, ''), 'Statut : ' || NEW.status::text),
      '/dashboard'
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS notify_complaint_status_change_trg ON public.complaints;
CREATE TRIGGER notify_complaint_status_change_trg
AFTER UPDATE OF status, admin_response ON public.complaints
FOR EACH ROW EXECUTE FUNCTION public.notify_complaint_status_change();

CREATE OR REPLACE FUNCTION public.notify_creator_interaction()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  recipient_id uuid;
  notification_title text;
  notification_body text;
BEGIN
  IF TG_TABLE_NAME = 'reviews' THEN
    SELECT owner_id INTO recipient_id FROM public.startups WHERE id = NEW.startup_id;
    notification_title := 'Nouvel avis';
    notification_body := 'Vous avez reçu un nouvel avis de ' || NEW.rating || ' étoile(s).';
  ELSIF TG_TABLE_NAME = 'product_comments' THEN
    SELECT s.owner_id INTO recipient_id
    FROM public.products p JOIN public.startups s ON s.id = p.startup_id
    WHERE p.id = NEW.product_id;
    notification_title := 'Nouveau commentaire';
    notification_body := left(NEW.content, 160);
  ELSIF TG_TABLE_NAME = 'startup_supporters' THEN
    SELECT owner_id INTO recipient_id FROM public.startups WHERE id = NEW.startup_id;
    notification_title := 'Nouveau soutien';
    notification_body := 'Une personne soutient maintenant votre boutique.';
  END IF;

  IF recipient_id IS NOT NULL AND recipient_id <> NEW.user_id THEN
    INSERT INTO public.notifications (user_id, type, title, body, link)
    VALUES (recipient_id, TG_TABLE_NAME, notification_title, notification_body, '/creator');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS notify_creator_review_trg ON public.reviews;
CREATE TRIGGER notify_creator_review_trg
AFTER INSERT ON public.reviews
FOR EACH ROW EXECUTE FUNCTION public.notify_creator_interaction();

DROP TRIGGER IF EXISTS notify_creator_comment_trg ON public.product_comments;
CREATE TRIGGER notify_creator_comment_trg
AFTER INSERT ON public.product_comments
FOR EACH ROW EXECUTE FUNCTION public.notify_creator_interaction();

DROP TRIGGER IF EXISTS notify_creator_support_trg ON public.startup_supporters;
CREATE TRIGGER notify_creator_support_trg
AFTER INSERT ON public.startup_supporters
FOR EACH ROW EXECUTE FUNCTION public.notify_creator_interaction();

CREATE OR REPLACE FUNCTION public.notify_startup_supporters()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.is_live = true AND OLD.is_live = false THEN
    INSERT INTO public.notifications (user_id, type, title, body, link)
    SELECT ss.user_id, 'live', NEW.name || ' est en direct',
      'Rejoignez le live maintenant.', '/startup/' || NEW.slug
    FROM public.startup_supporters ss
    WHERE ss.startup_id = NEW.id AND ss.user_id <> NEW.owner_id;
  END IF;

  IF NEW.last_post_at IS DISTINCT FROM OLD.last_post_at AND NEW.last_post_at IS NOT NULL THEN
    INSERT INTO public.notifications (user_id, type, title, body, link)
    SELECT ss.user_id, 'new_post', 'Nouveauté chez ' || NEW.name,
      'Ce créateur vient de signaler une nouvelle publication.', '/startup/' || NEW.slug
    FROM public.startup_supporters ss
    WHERE ss.startup_id = NEW.id AND ss.user_id <> NEW.owner_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS notify_startup_supporters_trg ON public.startups;
CREATE TRIGGER notify_startup_supporters_trg
AFTER UPDATE OF is_live, last_post_at ON public.startups
FOR EACH ROW EXECUTE FUNCTION public.notify_startup_supporters();

CREATE OR REPLACE FUNCTION public.notify_new_story()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.notifications (user_id, type, title, body, link)
  SELECT ss.user_id, 'story', 'Nouvelle story de ' || s.name,
    COALESCE(NULLIF(NEW.caption, ''), 'Une nouvelle story vient d’être publiée.'),
    '/startup/' || s.slug
  FROM public.startup_supporters ss
  JOIN public.startups s ON s.id = NEW.startup_id
  WHERE ss.startup_id = NEW.startup_id AND ss.user_id <> NEW.user_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS notify_new_story_trg ON public.stories;
CREATE TRIGGER notify_new_story_trg
AFTER INSERT ON public.stories
FOR EACH ROW EXECUTE FUNCTION public.notify_new_story();

REVOKE ALL ON FUNCTION public.notify_chat_recipient() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.notify_application_status_change() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.notify_complaint_status_change() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.notify_creator_interaction() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.notify_startup_supporters() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.notify_new_story() FROM PUBLIC, anon, authenticated;
