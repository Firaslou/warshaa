CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
      AND (
        current_setting('role', true) IN ('postgres','service_role')
        OR _user_id = auth.uid()
      )
  )
$function$;

REVOKE ALL ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated, service_role;

DROP POLICY IF EXISTS "Profiles viewable by authenticated users" ON public.profiles;

CREATE POLICY "Profiles viewable when relevant"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  id = auth.uid()
  OR public.has_role(auth.uid(), 'admin')
  OR EXISTS (SELECT 1 FROM public.startups s WHERE s.owner_id = profiles.id AND s.status = 'approved')
  OR EXISTS (SELECT 1 FROM public.reviews r WHERE r.user_id = profiles.id)
  OR EXISTS (SELECT 1 FROM public.product_comments c WHERE c.user_id = profiles.id)
  OR EXISTS (SELECT 1 FROM public.story_comments sc WHERE sc.user_id = profiles.id)
  OR EXISTS (SELECT 1 FROM public.story_reactions sr WHERE sr.user_id = profiles.id)
  OR EXISTS (
    SELECT 1 FROM public.story_views v
    JOIN public.stories st ON st.id = v.story_id
    JOIN public.startups s2 ON s2.id = st.startup_id
    WHERE v.user_id = profiles.id AND s2.owner_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM public.chat_conversations cc
    WHERE cc.buyer_id = profiles.id
      AND EXISTS (SELECT 1 FROM public.startups s3 WHERE s3.id = cc.startup_id AND s3.owner_id = auth.uid())
  )
);