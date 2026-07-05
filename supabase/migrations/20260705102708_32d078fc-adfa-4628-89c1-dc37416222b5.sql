
-- Drop overly permissive public SELECT policies on startups & products
DROP POLICY IF EXISTS "Lecture publique des startups" ON public.startups;
DROP POLICY IF EXISTS "Autoriser la lecture publique des boutiques" ON public.startups;
DROP POLICY IF EXISTS "Lecture publique des produits" ON public.products;
DROP POLICY IF EXISTS "Autoriser la lecture publique" ON public.products;

-- Restrict startup owners from self-approving via UPDATE
DROP POLICY IF EXISTS "Owners can update their startup (not status/badge)" ON public.startups;
CREATE POLICY "Owners can update their startup"
  ON public.startups FOR UPDATE
  USING (auth.uid() = owner_id)
  WITH CHECK (
    auth.uid() = owner_id
    AND status = (SELECT status FROM public.startups s WHERE s.id = startups.id)
    AND badge  = (SELECT badge  FROM public.startups s WHERE s.id = startups.id)
  );

-- Restrict INSERT so owners cannot create pre-approved startups
DROP POLICY IF EXISTS "Owners can insert their startup" ON public.startups;
CREATE POLICY "Owners can insert their startup"
  ON public.startups FOR INSERT
  WITH CHECK (
    auth.uid() = owner_id
    AND status = 'pending'::startup_status
    AND badge = 'new'::startup_badge
  );

-- Fix product-images storage upload path (must be scoped to user folder)
DROP POLICY IF EXISTS "Auth upload product-images" ON storage.objects;
CREATE POLICY "Auth upload product-images"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'product-images'
    AND (auth.uid())::text = (storage.foldername(name))[1]
  );

-- Scope realtime.messages so users can only receive from topics they belong to
DROP POLICY IF EXISTS "Authenticated can receive own realtime" ON realtime.messages;
CREATE POLICY "Authenticated scoped realtime"
  ON realtime.messages FOR SELECT TO authenticated
  USING (
    CASE
      WHEN realtime.topic() LIKE 'chat:%' THEN EXISTS (
        SELECT 1 FROM public.chat_conversations c
        WHERE c.id::text = substring(realtime.topic() FROM 6)
          AND (
            c.buyer_id = auth.uid()
            OR EXISTS (
              SELECT 1 FROM public.startups s
              WHERE s.id = c.startup_id AND s.owner_id = auth.uid()
            )
          )
      )
      ELSE true
    END
  );
