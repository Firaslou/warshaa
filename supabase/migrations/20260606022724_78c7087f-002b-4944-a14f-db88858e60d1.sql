
CREATE TABLE public.stories (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  startup_id UUID NOT NULL REFERENCES public.startups(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  media_url TEXT NOT NULL,
  media_type TEXT NOT NULL CHECK (media_type IN ('image','video')),
  caption TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '24 hours')
);

CREATE INDEX idx_stories_startup ON public.stories(startup_id);
CREATE INDEX idx_stories_expires ON public.stories(expires_at);

GRANT SELECT ON public.stories TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.stories TO authenticated;
GRANT ALL ON public.stories TO service_role;

ALTER TABLE public.stories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Active stories are publicly viewable"
  ON public.stories FOR SELECT
  USING (expires_at > now());

CREATE POLICY "Creators can insert their own stories"
  ON public.stories FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM public.startups s
      WHERE s.id = startup_id AND s.owner_id = auth.uid()
    )
  );

CREATE POLICY "Owners can delete their stories"
  ON public.stories FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can delete any story"
  ON public.stories FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
