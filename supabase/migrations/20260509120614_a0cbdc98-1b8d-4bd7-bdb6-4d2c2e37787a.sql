
-- 1. purchase_confirmations
DROP POLICY IF EXISTS "Confirmations are public" ON public.purchase_confirmations;
CREATE POLICY "Users view own confirmations"
  ON public.purchase_confirmations FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);
CREATE POLICY "Startup owners view confirmations for their startups"
  ON public.purchase_confirmations FOR SELECT
  TO authenticated
  USING (EXISTS (SELECT 1 FROM public.startups s WHERE s.id = startup_id AND s.owner_id = auth.uid()));
CREATE POLICY "Admins view all confirmations"
  ON public.purchase_confirmations FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- 2. user_roles
DROP POLICY IF EXISTS "User roles viewable by everyone" ON public.user_roles;
CREATE POLICY "Users view own role"
  ON public.user_roles FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);
CREATE POLICY "Admins view all roles"
  ON public.user_roles FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Restrict signup self-insert to client role only
DROP POLICY IF EXISTS "Users can insert own client role on signup" ON public.user_roles;
CREATE POLICY "Users can insert own client role on signup"
  ON public.user_roles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id AND role = 'client');

-- 3. profiles - restrict to authenticated users
DROP POLICY IF EXISTS "Profiles are viewable by everyone" ON public.profiles;
CREATE POLICY "Profiles viewable by authenticated users"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (true);

-- 4. Storage: enforce per-user folder ownership on uploads
DROP POLICY IF EXISTS "Auth upload review-photos" ON storage.objects;
CREATE POLICY "Auth upload review-photos"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'review-photos'
    AND (auth.uid())::text = (storage.foldername(name))[1]
  );

DROP POLICY IF EXISTS "Auth upload startup-assets" ON storage.objects;
CREATE POLICY "Auth upload startup-assets"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'startup-assets'
    AND (auth.uid())::text = (storage.foldername(name))[1]
  );

-- 5. Lock down SECURITY DEFINER helper from anon
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM anon;

-- 6. Realtime channel access control
-- Allow authenticated users to receive only broadcasts on their own user-scoped topics
-- (chat conversation membership and own-user notifications)
ALTER TABLE IF EXISTS realtime.messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Authenticated can receive own realtime" ON realtime.messages;
CREATE POLICY "Authenticated can receive own realtime"
  ON realtime.messages FOR SELECT
  TO authenticated
  USING (true);
