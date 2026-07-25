
CREATE OR REPLACE FUNCTION public.prevent_owner_status_badge_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.has_role(auth.uid(), 'admin') THEN
    RETURN NEW;
  END IF;
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    RAISE EXCEPTION 'Only admins can change status';
  END IF;
  IF NEW.badge IS DISTINCT FROM OLD.badge THEN
    RAISE EXCEPTION 'Only admins can change badge';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_owner_status_badge_change ON public.startups;
CREATE TRIGGER trg_prevent_owner_status_badge_change
BEFORE UPDATE ON public.startups
FOR EACH ROW
EXECUTE FUNCTION public.prevent_owner_status_badge_change();
