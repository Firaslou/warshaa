
-- Live events: creators schedule upcoming lives
CREATE TABLE public.live_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  startup_id UUID NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  scheduled_at TIMESTAMPTZ NOT NULL,
  duration_minutes INTEGER NOT NULL DEFAULT 60,
  platform TEXT,
  stream_url TEXT,
  cover_url TEXT,
  status TEXT NOT NULL DEFAULT 'scheduled', -- scheduled | live | ended | cancelled
  reminder_dispatched BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_live_events_scheduled_at ON public.live_events(scheduled_at);
CREATE INDEX idx_live_events_startup ON public.live_events(startup_id);

GRANT SELECT ON public.live_events TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.live_events TO authenticated;
GRANT ALL ON public.live_events TO service_role;

ALTER TABLE public.live_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Live events of approved startups are public"
  ON public.live_events FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.startups s
    WHERE s.id = live_events.startup_id
      AND (s.status = 'approved' OR s.owner_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role))
  ));

CREATE POLICY "Startup owners manage their live events"
  ON public.live_events FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.startups s
    WHERE s.id = live_events.startup_id AND s.owner_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.startups s
    WHERE s.id = live_events.startup_id AND s.owner_id = auth.uid()
  ));

CREATE POLICY "Admins manage all live events"
  ON public.live_events FOR ALL
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER live_events_updated_at
  BEFORE UPDATE ON public.live_events
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Live reminders: users opt-in to be reminded
CREATE TABLE public.live_reminders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  live_event_id UUID NOT NULL REFERENCES public.live_events(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  notified BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (live_event_id, user_id)
);

CREATE INDEX idx_live_reminders_event ON public.live_reminders(live_event_id);
CREATE INDEX idx_live_reminders_user ON public.live_reminders(user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.live_reminders TO authenticated;
GRANT ALL ON public.live_reminders TO service_role;

ALTER TABLE public.live_reminders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own reminders"
  ON public.live_reminders FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Startup owners view reminders for their lives"
  ON public.live_reminders FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.live_events e
    JOIN public.startups s ON s.id = e.startup_id
    WHERE e.id = live_reminders.live_event_id AND s.owner_id = auth.uid()
  ));
