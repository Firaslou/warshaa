-- Table to track which users support which creators (1 row per user/startup, toggleable)
CREATE TABLE public.startup_supporters (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  startup_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (user_id, startup_id)
);

ALTER TABLE public.startup_supporters ENABLE ROW LEVEL SECURITY;

-- Anyone can read supporters (used for public counts)
CREATE POLICY "Supporters are public"
ON public.startup_supporters
FOR SELECT
USING (true);

-- Authenticated users can support / un-support themselves
CREATE POLICY "Users manage own supports"
ON public.startup_supporters
FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_startup_supporters_startup ON public.startup_supporters(startup_id);
CREATE INDEX idx_startup_supporters_user ON public.startup_supporters(user_id);

-- Keep startups.supporters_count in sync automatically
CREATE OR REPLACE FUNCTION public.sync_supporters_count()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.startups
      SET supporters_count = supporters_count + 1
      WHERE id = NEW.startup_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.startups
      SET supporters_count = GREATEST(0, supporters_count - 1)
      WHERE id = OLD.startup_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

CREATE TRIGGER trg_supporters_count
AFTER INSERT OR DELETE ON public.startup_supporters
FOR EACH ROW EXECUTE FUNCTION public.sync_supporters_count();