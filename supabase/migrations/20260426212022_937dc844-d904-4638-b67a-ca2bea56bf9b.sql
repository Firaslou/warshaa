
-- =========================================================
-- ENUMS
-- =========================================================
CREATE TYPE public.app_role AS ENUM ('admin', 'startup', 'client');
CREATE TYPE public.startup_status AS ENUM ('pending', 'approved', 'rejected');
CREATE TYPE public.startup_badge AS ENUM ('new', 'verified', 'certified');
CREATE TYPE public.application_status AS ENUM ('pending', 'approved', 'rejected');

-- =========================================================
-- PROFILES
-- =========================================================
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  preferred_language TEXT NOT NULL DEFAULT 'fr',
  city TEXT,
  avatar_url TEXT,
  bio TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Profiles are viewable by everyone"
  ON public.profiles FOR SELECT USING (true);

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
  ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- =========================================================
-- USER ROLES (separate table — security best practice)
-- =========================================================
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

CREATE POLICY "User roles viewable by everyone"
  ON public.user_roles FOR SELECT USING (true);

CREATE POLICY "Admins can manage roles"
  ON public.user_roles FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can insert own client role on signup"
  ON public.user_roles FOR INSERT
  WITH CHECK (auth.uid() = user_id AND role IN ('client', 'startup'));

-- =========================================================
-- STARTUPS
-- =========================================================
CREATE TABLE public.startups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  tagline TEXT,
  description TEXT,
  creator_story TEXT,
  city TEXT,
  category TEXT,
  cover_url TEXT,
  logo_url TEXT,
  whatsapp_number TEXT,
  instagram_url TEXT,
  facebook_url TEXT,
  status startup_status NOT NULL DEFAULT 'pending',
  badge startup_badge NOT NULL DEFAULT 'new',
  likes_count INTEGER NOT NULL DEFAULT 0,
  supporters_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.startups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Approved startups are public"
  ON public.startups FOR SELECT
  USING (status = 'approved' OR owner_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Owners can insert their startup"
  ON public.startups FOR INSERT
  WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Owners can update their startup (not status/badge)"
  ON public.startups FOR UPDATE
  USING (auth.uid() = owner_id);

CREATE POLICY "Admins can update any startup"
  ON public.startups FOR UPDATE
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete startups"
  ON public.startups FOR DELETE
  USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX idx_startups_status ON public.startups(status);
CREATE INDEX idx_startups_city ON public.startups(city);
CREATE INDEX idx_startups_category ON public.startups(category);

-- =========================================================
-- PRODUCTS
-- =========================================================
CREATE TABLE public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  startup_id UUID NOT NULL REFERENCES public.startups(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  price NUMERIC(10,2),
  currency TEXT NOT NULL DEFAULT 'TND',
  images TEXT[] NOT NULL DEFAULT '{}',
  category TEXT,
  in_stock BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Products of approved startups are public"
  ON public.products FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.startups s
      WHERE s.id = startup_id
        AND (s.status = 'approved' OR s.owner_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
    )
  );

CREATE POLICY "Startup owners can manage their products"
  ON public.products FOR ALL
  USING (
    EXISTS (SELECT 1 FROM public.startups s WHERE s.id = startup_id AND s.owner_id = auth.uid())
  );

CREATE INDEX idx_products_startup ON public.products(startup_id);

-- =========================================================
-- REVIEWS
-- =========================================================
CREATE TABLE public.reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  startup_id UUID NOT NULL REFERENCES public.startups(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment TEXT,
  photo_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Reviews are public"
  ON public.reviews FOR SELECT USING (true);

CREATE POLICY "Authenticated users can create reviews"
  ON public.reviews FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own reviews"
  ON public.reviews FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users and admins can delete reviews"
  ON public.reviews FOR DELETE
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

CREATE INDEX idx_reviews_startup ON public.reviews(startup_id);

-- =========================================================
-- FAVORITES
-- =========================================================
CREATE TABLE public.favorites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  startup_id UUID REFERENCES public.startups(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.products(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (startup_id IS NOT NULL OR product_id IS NOT NULL),
  UNIQUE(user_id, startup_id),
  UNIQUE(user_id, product_id)
);

ALTER TABLE public.favorites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own favorites"
  ON public.favorites FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own favorites"
  ON public.favorites FOR ALL
  USING (auth.uid() = user_id);

-- =========================================================
-- STARTUP APPLICATIONS
-- =========================================================
CREATE TABLE public.startup_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  applicant_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  brand_name TEXT NOT NULL,
  description TEXT NOT NULL,
  city TEXT NOT NULL,
  category TEXT NOT NULL,
  whatsapp_number TEXT NOT NULL,
  instagram_url TEXT,
  facebook_url TEXT,
  proof_photos TEXT[] NOT NULL DEFAULT '{}',
  proof_video_url TEXT,
  status application_status NOT NULL DEFAULT 'pending',
  admin_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  reviewed_at TIMESTAMPTZ
);

ALTER TABLE public.startup_applications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Applicants can view own applications"
  ON public.startup_applications FOR SELECT
  USING (auth.uid() = applicant_id OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Authenticated users can apply"
  ON public.startup_applications FOR INSERT
  WITH CHECK (auth.uid() = applicant_id);

CREATE POLICY "Admins can update applications"
  ON public.startup_applications FOR UPDATE
  USING (public.has_role(auth.uid(), 'admin'));

-- =========================================================
-- PURCHASE CLICKS (WhatsApp tracking)
-- =========================================================
CREATE TABLE public.purchase_clicks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  startup_id UUID NOT NULL REFERENCES public.startups(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.purchase_clicks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can log a click"
  ON public.purchase_clicks FOR INSERT WITH CHECK (true);

CREATE POLICY "Owners and admins can view clicks"
  ON public.purchase_clicks FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM public.startups s WHERE s.id = startup_id AND s.owner_id = auth.uid())
    OR public.has_role(auth.uid(), 'admin')
  );

CREATE INDEX idx_clicks_startup ON public.purchase_clicks(startup_id);

-- =========================================================
-- TRIGGER: auto profile + client role on signup
-- =========================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =========================================================
-- TRIGGER: updated_at
-- =========================================================
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE TRIGGER set_profiles_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER set_startups_updated_at BEFORE UPDATE ON public.startups
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER set_products_updated_at BEFORE UPDATE ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =========================================================
-- STORAGE BUCKETS
-- =========================================================
INSERT INTO storage.buckets (id, name, public) VALUES
  ('startup-assets', 'startup-assets', true),
  ('product-images', 'product-images', true),
  ('review-photos', 'review-photos', true),
  ('applications', 'applications', false);

CREATE POLICY "Public read startup-assets" ON storage.objects FOR SELECT
  USING (bucket_id = 'startup-assets');
CREATE POLICY "Auth upload startup-assets" ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'startup-assets' AND auth.uid() IS NOT NULL);
CREATE POLICY "Owner update startup-assets" ON storage.objects FOR UPDATE
  USING (bucket_id = 'startup-assets' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Owner delete startup-assets" ON storage.objects FOR DELETE
  USING (bucket_id = 'startup-assets' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Public read product-images" ON storage.objects FOR SELECT
  USING (bucket_id = 'product-images');
CREATE POLICY "Auth upload product-images" ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'product-images' AND auth.uid() IS NOT NULL);
CREATE POLICY "Owner manage product-images" ON storage.objects FOR ALL
  USING (bucket_id = 'product-images' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Public read review-photos" ON storage.objects FOR SELECT
  USING (bucket_id = 'review-photos');
CREATE POLICY "Auth upload review-photos" ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'review-photos' AND auth.uid() IS NOT NULL);

CREATE POLICY "Applicant read own applications files" ON storage.objects FOR SELECT
  USING (bucket_id = 'applications' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Admin read all applications files" ON storage.objects FOR SELECT
  USING (bucket_id = 'applications' AND public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Auth upload applications" ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'applications' AND auth.uid()::text = (storage.foldername(name))[1]);
