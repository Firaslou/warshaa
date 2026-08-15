DROP POLICY IF EXISTS "Log click on approved startup" ON public.purchase_clicks;

CREATE POLICY "Log click on approved startup"
ON public.purchase_clicks
FOR INSERT
TO anon, authenticated
WITH CHECK (
  (user_id IS NULL OR user_id = auth.uid())
  AND EXISTS (
    SELECT 1 FROM public.startups s
    WHERE s.id = purchase_clicks.startup_id AND s.status = 'approved'
  )
);