CREATE TYPE public.complaint_status AS ENUM ('pending', 'reviewing', 'resolved', 'rejected');

CREATE TABLE public.complaints (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id uuid NOT NULL,
  startup_id uuid NOT NULL,
  subject text NOT NULL,
  message text NOT NULL,
  status public.complaint_status NOT NULL DEFAULT 'pending',
  admin_response text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.complaints ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users send own complaints"
  ON public.complaints FOR INSERT
  WITH CHECK (auth.uid() = reporter_id);

CREATE POLICY "Users view own complaints"
  ON public.complaints FOR SELECT
  USING (auth.uid() = reporter_id OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins update complaints"
  ON public.complaints FOR UPDATE
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins delete complaints"
  ON public.complaints FOR DELETE
  USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER complaints_set_updated_at
  BEFORE UPDATE ON public.complaints
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX idx_complaints_startup ON public.complaints(startup_id);
CREATE INDEX idx_complaints_status ON public.complaints(status);