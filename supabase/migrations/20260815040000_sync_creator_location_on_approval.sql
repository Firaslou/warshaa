-- Keep the exact location chosen in the creator application synchronized with the public startup profile.
-- This also repairs profiles that were approved before the location-transfer function was deployed.

CREATE OR REPLACE FUNCTION public.sync_approved_creator_location()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'approved' THEN
    UPDATE public.startups
    SET
      city = COALESCE(NEW.city, city),
      delegation = NEW.delegation,
      latitude = NEW.latitude,
      longitude = NEW.longitude
    WHERE owner_id = NEW.applicant_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_approved_creator_location ON public.startup_applications;
CREATE TRIGGER trg_sync_approved_creator_location
AFTER INSERT OR UPDATE OF status, city, delegation, latitude, longitude
ON public.startup_applications
FOR EACH ROW
WHEN (NEW.status = 'approved')
EXECUTE FUNCTION public.sync_approved_creator_location();

-- Repair already-approved creators: copy the exact coordinates from their application.
UPDATE public.startups s
SET
  city = COALESCE(a.city, s.city),
  delegation = a.delegation,
  latitude = a.latitude,
  longitude = a.longitude
FROM public.startup_applications a
WHERE a.applicant_id = s.owner_id
  AND a.status = 'approved';

NOTIFY pgrst, 'reload schema';
