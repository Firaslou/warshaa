
-- Remove any admin role from accounts that are not the reserved admin email
DELETE FROM public.user_roles
WHERE role = 'admin'
  AND user_id NOT IN (SELECT id FROM auth.users WHERE lower(email) = 'mayssaderbeel@gmail.com');

-- Ensure the reserved email has admin if the account already exists
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin'::app_role FROM auth.users WHERE lower(email) = 'mayssaderbeel@gmail.com'
ON CONFLICT DO NOTHING;

-- Update signup handler to auto-grant admin only for the reserved email
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (id, full_name, preferred_language)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    COALESCE(NEW.raw_user_meta_data->>'preferred_language', 'fr')
  );

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'client')
  ON CONFLICT DO NOTHING;

  IF lower(NEW.email) = 'mayssaderbeel@gmail.com' THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'admin')
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN NEW;
END;
$function$;

-- Trigger to block any future admin role assignment to other users
CREATE OR REPLACE FUNCTION public.enforce_single_admin()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  admin_email text;
BEGIN
  IF NEW.role = 'admin' THEN
    SELECT lower(email) INTO admin_email FROM auth.users WHERE id = NEW.user_id;
    IF admin_email IS DISTINCT FROM 'mayssaderbeel@gmail.com' THEN
      RAISE EXCEPTION 'Admin role is reserved for mayssaderbeel@gmail.com';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_single_admin_trg ON public.user_roles;
CREATE TRIGGER enforce_single_admin_trg
BEFORE INSERT OR UPDATE ON public.user_roles
FOR EACH ROW EXECUTE FUNCTION public.enforce_single_admin();
