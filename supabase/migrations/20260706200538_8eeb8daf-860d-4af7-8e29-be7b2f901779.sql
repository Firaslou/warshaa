
-- Views
CREATE TABLE public.story_views (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  story_id uuid NOT NULL REFERENCES public.stories(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (story_id, user_id)
);
GRANT SELECT, INSERT ON public.story_views TO authenticated;
GRANT ALL ON public.story_views TO service_role;
ALTER TABLE public.story_views ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users insert own view" ON public.story_views
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Story owner or self can read views" ON public.story_views
  FOR SELECT TO authenticated USING (
    auth.uid() = user_id OR EXISTS (
      SELECT 1 FROM public.stories s WHERE s.id = story_id AND s.user_id = auth.uid()
    )
  );

CREATE INDEX story_views_story_idx ON public.story_views(story_id);

-- Reactions (one emoji per user per story, can be updated)
CREATE TABLE public.story_reactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  story_id uuid NOT NULL REFERENCES public.stories(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  emoji text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (story_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.story_reactions TO authenticated;
GRANT ALL ON public.story_reactions TO service_role;
ALTER TABLE public.story_reactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own reaction" ON public.story_reactions
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Story owner or self reads reactions" ON public.story_reactions
  FOR SELECT TO authenticated USING (
    auth.uid() = user_id OR EXISTS (
      SELECT 1 FROM public.stories s WHERE s.id = story_id AND s.user_id = auth.uid()
    )
  );

CREATE INDEX story_reactions_story_idx ON public.story_reactions(story_id);

-- Comments
CREATE TABLE public.story_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  story_id uuid NOT NULL REFERENCES public.stories(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  content text NOT NULL CHECK (char_length(content) BETWEEN 1 AND 500),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, DELETE ON public.story_comments TO authenticated;
GRANT ALL ON public.story_comments TO service_role;
ALTER TABLE public.story_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users insert own comment" ON public.story_comments
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users delete own comment" ON public.story_comments
  FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Story owner or author reads comments" ON public.story_comments
  FOR SELECT TO authenticated USING (
    auth.uid() = user_id OR EXISTS (
      SELECT 1 FROM public.stories s WHERE s.id = story_id AND s.user_id = auth.uid()
    )
  );

CREATE INDEX story_comments_story_idx ON public.story_comments(story_id, created_at DESC);
