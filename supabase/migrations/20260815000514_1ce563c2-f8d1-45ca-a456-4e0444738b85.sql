-- Notify followers from the real product publication event. This replaces the
-- former manual "signal a new post" action on the creator dashboard.

CREATE OR REPLACE FUNCTION public.notify_supporters_new_product()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  creator_name text;
BEGIN
  SELECT s.name
  INTO creator_name
  FROM public.startups s
  WHERE s.id = NEW.startup_id;

  INSERT INTO public.notifications (user_id, type, title, body, link)
  SELECT
    ss.user_id,
    'new_product',
    'Nouveau produit chez ' || COALESCE(creator_name, 'un créateur suivi'),
    '« ' || NEW.name || ' » vient d’être publié.',
    '/product/' || NEW.id
  FROM public.startup_supporters ss
  JOIN public.startups s ON s.id = ss.startup_id
  WHERE ss.startup_id = NEW.startup_id
    AND ss.user_id <> s.owner_id;

  -- Keep this legacy field accurate for existing homepage/profile queries,
  -- without requiring the creator to press a separate button.
  UPDATE public.startups
  SET last_post_at = NEW.created_at
  WHERE id = NEW.startup_id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS notify_supporters_new_product_trg ON public.products;
CREATE TRIGGER notify_supporters_new_product_trg
AFTER INSERT ON public.products
FOR EACH ROW EXECUTE FUNCTION public.notify_supporters_new_product();

-- last_post_at is now maintained by product insertion. Keep the startup
-- notification trigger dedicated to live-status changes to avoid duplicates.
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
    WHERE ss.startup_id = NEW.id
      AND ss.user_id <> NEW.owner_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS notify_startup_supporters_trg ON public.startups;
CREATE TRIGGER notify_startup_supporters_trg
AFTER UPDATE OF is_live ON public.startups
FOR EACH ROW EXECUTE FUNCTION public.notify_startup_supporters();

REVOKE ALL ON FUNCTION public.notify_supporters_new_product() FROM PUBLIC, anon, authenticated;