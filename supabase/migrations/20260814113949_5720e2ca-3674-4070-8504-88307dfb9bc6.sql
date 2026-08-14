ALTER TABLE public.chat_messages ADD COLUMN IF NOT EXISTS read_at timestamp with time zone;

CREATE TABLE IF NOT EXISTS public.admin_audit_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  admin_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id text,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.admin_audit_logs TO authenticated;
GRANT ALL ON public.admin_audit_logs TO service_role;
ALTER TABLE public.admin_audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can read audit logs" ON public.admin_audit_logs;
CREATE POLICY "Admins can read audit logs" ON public.admin_audit_logs
FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins can write audit logs" ON public.admin_audit_logs;
CREATE POLICY "Admins can write audit logs" ON public.admin_audit_logs
FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin') AND admin_id = auth.uid());

DROP POLICY IF EXISTS "Recipients can mark messages read" ON public.chat_messages;
CREATE POLICY "Recipients can mark messages read" ON public.chat_messages
FOR UPDATE TO authenticated
USING (
  sender_id <> auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.chat_conversations c
    JOIN public.startups s ON s.id = c.startup_id
    WHERE c.id = chat_messages.conversation_id
      AND (c.buyer_id = auth.uid() OR s.owner_id = auth.uid())
  )
)
WITH CHECK (
  sender_id <> auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.chat_conversations c
    JOIN public.startups s ON s.id = c.startup_id
    WHERE c.id = chat_messages.conversation_id
      AND (c.buyer_id = auth.uid() OR s.owner_id = auth.uid())
  )
);