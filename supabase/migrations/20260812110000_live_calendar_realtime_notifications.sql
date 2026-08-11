-- Notify reminder subscribers when a scheduled event becomes live.

CREATE OR REPLACE FUNCTION public.notify_live_event_started()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  creator_name text;
BEGIN
  IF NEW.status = 'live' AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM NEW.status) THEN
    SELECT name INTO creator_name FROM public.startups WHERE id = NEW.startup_id;

    INSERT INTO public.notifications (user_id, type, title, body, link)
    SELECT lr.user_id, 'live', COALESCE(creator_name, 'Un créateur') || ' est en direct',
      NEW.title || ' commence maintenant.', '/lives'
    FROM public.live_reminders lr
    WHERE lr.live_event_id = NEW.id
      AND NOT EXISTS (
        SELECT 1 FROM public.startup_supporters ss
        WHERE ss.startup_id = NEW.startup_id AND ss.user_id = lr.user_id
      );

    UPDATE public.live_reminders SET notified = true WHERE live_event_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS notify_live_event_started_trg ON public.live_events;
CREATE TRIGGER notify_live_event_started_trg
AFTER INSERT OR UPDATE OF status ON public.live_events
FOR EACH ROW EXECUTE FUNCTION public.notify_live_event_started();

REVOKE ALL ON FUNCTION public.notify_live_event_started() FROM PUBLIC, anon, authenticated;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'live_events'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.live_events;
  END IF;
END;
$$;

-- Alert administrators about new work that needs review.
CREATE OR REPLACE FUNCTION public.notify_admin_new_item()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_TABLE_NAME = 'startup_applications' THEN
    INSERT INTO public.notifications (user_id, type, title, body, link)
    SELECT ur.user_id, 'admin_application', 'Nouvelle candidature créateur',
      NEW.brand_name || ' attend une vérification.', '/admin'
    FROM public.user_roles ur WHERE ur.role = 'admin';
  ELSIF TG_TABLE_NAME = 'complaints' THEN
    INSERT INTO public.notifications (user_id, type, title, body, link)
    SELECT ur.user_id, 'admin_complaint', 'Nouvelle réclamation',
      NEW.subject, '/admin'
    FROM public.user_roles ur WHERE ur.role = 'admin';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS notify_admin_application_trg ON public.startup_applications;
CREATE TRIGGER notify_admin_application_trg
AFTER INSERT ON public.startup_applications
FOR EACH ROW EXECUTE FUNCTION public.notify_admin_new_item();

DROP TRIGGER IF EXISTS notify_admin_complaint_trg ON public.complaints;
CREATE TRIGGER notify_admin_complaint_trg
AFTER INSERT ON public.complaints
FOR EACH ROW EXECUTE FUNCTION public.notify_admin_new_item();

REVOKE ALL ON FUNCTION public.notify_admin_new_item() FROM PUBLIC, anon, authenticated;
