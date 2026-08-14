-- Live streaming modes: native Agora or external social relay.
ALTER TABLE public.live_events
  ADD COLUMN IF NOT EXISTS live_mode text NOT NULL DEFAULT 'agora' CHECK (live_mode IN ('agora', 'external')),
  ADD COLUMN IF NOT EXISTS external_platform text CHECK (external_platform IN ('facebook', 'youtube', 'instagram', 'tiktok')),
  ADD COLUMN IF NOT EXISTS external_url text,
  ADD COLUMN IF NOT EXISTS agora_channel text,
  ADD COLUMN IF NOT EXISTS agora_uid bigint,
  ADD COLUMN IF NOT EXISTS chat_enabled boolean NOT NULL DEFAULT true;

CREATE TABLE IF NOT EXISTS public.live_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  live_event_id uuid NOT NULL REFERENCES public.live_events(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  user_name text NOT NULL DEFAULT 'Visiteur',
  avatar_url text,
  content text NOT NULL CHECK (char_length(trim(content)) BETWEEN 1 AND 1000),
  like_count integer NOT NULL DEFAULT 0 CHECK (like_count >= 0),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS live_comments_event_created_idx
  ON public.live_comments(live_event_id, created_at);

ALTER TABLE public.live_comments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read live comments" ON public.live_comments;
CREATE POLICY "Anyone can read live comments"
  ON public.live_comments FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Authenticated users can post live comments" ON public.live_comments;
CREATE POLICY "Authenticated users can post live comments"
  ON public.live_comments FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Live creator can like comments" ON public.live_comments;
CREATE POLICY "Live creator can like comments"
  ON public.live_comments FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.live_events le
      JOIN public.startups s ON s.id = le.startup_id
      WHERE le.id = live_comments.live_event_id
        AND s.owner_id = auth.uid()
    )
  )
  WITH CHECK (like_count >= 0);

ALTER TABLE public.live_comments REPLICA IDENTITY FULL;

DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.live_comments;
  EXCEPTION WHEN duplicate_object THEN
    NULL;
  END;
END $$;
