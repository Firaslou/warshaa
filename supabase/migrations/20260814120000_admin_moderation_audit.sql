-- Durable history for sensitive moderation decisions.
CREATE TABLE IF NOT EXISTS public.admin_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id uuid NOT NULL,
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id uuid NOT NULL,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS admin_audit_logs_created_idx
ON public.admin_audit_logs (created_at DESC);

ALTER TABLE public.admin_audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins view audit logs" ON public.admin_audit_logs;
CREATE POLICY "Admins view audit logs" ON public.admin_audit_logs
FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins create audit logs" ON public.admin_audit_logs;
CREATE POLICY "Admins create audit logs" ON public.admin_audit_logs
FOR INSERT TO authenticated WITH CHECK (
  public.has_role(auth.uid(), 'admin') AND admin_id = auth.uid()
);

GRANT SELECT, INSERT ON public.admin_audit_logs TO authenticated;
