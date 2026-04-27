
-- Profile extensions
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS gender TEXT,
  ADD COLUMN IF NOT EXISTS preferred_categories TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN NOT NULL DEFAULT false;

-- Startup extensions
ALTER TABLE public.startups
  ADD COLUMN IF NOT EXISTS delegation TEXT,
  ADD COLUMN IF NOT EXISTS last_post_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS is_live BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS live_started_at TIMESTAMPTZ;

-- Product extensions
DO $$ BEGIN
  CREATE TYPE product_availability AS ENUM ('in_stock', 'arriving', 'out_of_stock');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS availability product_availability NOT NULL DEFAULT 'in_stock',
  ADD COLUMN IF NOT EXISTS delivery_available BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS delivery_fee NUMERIC,
  ADD COLUMN IF NOT EXISTS last_stock_check TIMESTAMPTZ DEFAULT now();

-- Product likes
CREATE TABLE IF NOT EXISTS public.product_likes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  product_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, product_id)
);
ALTER TABLE public.product_likes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Likes are public" ON public.product_likes FOR SELECT USING (true);
CREATE POLICY "Users manage own likes" ON public.product_likes FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Product views (only logged-in users)
CREATE TABLE IF NOT EXISTS public.product_views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  product_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, product_id)
);
ALTER TABLE public.product_views ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Views readable by owner and admin" ON public.product_views FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.products p
      JOIN public.startups s ON s.id = p.startup_id
      WHERE p.id = product_views.product_id
        AND (s.owner_id = auth.uid() OR public.has_role(auth.uid(),'admin'))
    )
    OR auth.uid() = user_id
  );
CREATE POLICY "Authenticated users log own views" ON public.product_views FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Purchase confirmations
CREATE TABLE IF NOT EXISTS public.purchase_confirmations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  product_id UUID NOT NULL,
  startup_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, product_id)
);
ALTER TABLE public.purchase_confirmations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Confirmations are public" ON public.purchase_confirmations FOR SELECT USING (true);
CREATE POLICY "Users confirm own purchases" ON public.purchase_confirmations FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Product comments
CREATE TABLE IF NOT EXISTS public.product_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  product_id UUID NOT NULL,
  content TEXT NOT NULL,
  is_anonymous BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.product_comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Comments are public" ON public.product_comments FOR SELECT USING (true);
CREATE POLICY "Authenticated users comment" ON public.product_comments FOR INSERT
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users delete own comments" ON public.product_comments FOR DELETE
  USING (auth.uid() = user_id OR public.has_role(auth.uid(),'admin'));

-- Chat conversations
CREATE TABLE IF NOT EXISTS public.chat_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  buyer_id UUID NOT NULL,
  startup_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_message_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (buyer_id, startup_id)
);
ALTER TABLE public.chat_conversations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Participants view conversation" ON public.chat_conversations FOR SELECT
  USING (
    auth.uid() = buyer_id
    OR EXISTS (SELECT 1 FROM public.startups s WHERE s.id = chat_conversations.startup_id AND s.owner_id = auth.uid())
  );
CREATE POLICY "Buyers create conversation" ON public.chat_conversations FOR INSERT
  WITH CHECK (auth.uid() = buyer_id);

CREATE TABLE IF NOT EXISTS public.chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.chat_conversations(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Participants view messages" ON public.chat_messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.chat_conversations c
      WHERE c.id = chat_messages.conversation_id
        AND (
          c.buyer_id = auth.uid()
          OR EXISTS (SELECT 1 FROM public.startups s WHERE s.id = c.startup_id AND s.owner_id = auth.uid())
        )
    )
  );
CREATE POLICY "Participants send messages" ON public.chat_messages FOR INSERT
  WITH CHECK (
    auth.uid() = sender_id
    AND EXISTS (
      SELECT 1 FROM public.chat_conversations c
      WHERE c.id = chat_messages.conversation_id
        AND (
          c.buyer_id = auth.uid()
          OR EXISTS (SELECT 1 FROM public.startups s WHERE s.id = c.startup_id AND s.owner_id = auth.uid())
        )
    )
  );

ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages;

-- Password reset codes
CREATE TABLE IF NOT EXISTS public.password_reset_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  code TEXT NOT NULL,
  used BOOLEAN NOT NULL DEFAULT false,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.password_reset_codes ENABLE ROW LEVEL SECURITY;
-- No public policies; only edge functions with service role can use it.
