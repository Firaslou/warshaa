-- Products may be prepared privately and become visible only when published.
ALTER TABLE public.products
ADD COLUMN IF NOT EXISTS is_published boolean NOT NULL DEFAULT true;

CREATE INDEX IF NOT EXISTS idx_products_publication
ON public.products (is_published, created_at DESC);

DROP POLICY IF EXISTS "Products of approved startups are public" ON public.products;
CREATE POLICY "Published products are public and drafts are private"
ON public.products FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.startups s
    WHERE s.id = startup_id
      AND (
        (s.status = 'approved' AND products.is_published = true)
        OR s.owner_id = auth.uid()
        OR public.has_role(auth.uid(), 'admin')
      )
  )
);

-- A notification is sent exactly once: when a product first becomes public.
CREATE OR REPLACE FUNCTION public.notify_supporters_new_product()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  creator_name text;
  became_public boolean := false;
BEGIN
  IF TG_OP = 'INSERT' THEN
    became_public := NEW.is_published;
  ELSIF TG_OP = 'UPDATE' THEN
    became_public := NEW.is_published AND NOT OLD.is_published;
  END IF;

  IF NOT became_public THEN
    RETURN NEW;
  END IF;

  SELECT s.name INTO creator_name
  FROM public.startups s
  WHERE s.id = NEW.startup_id;

  INSERT INTO public.notifications (user_id, type, title, body, link)
  SELECT
    ss.user_id,
    'new_product',
    'Nouveau produit chez ' || COALESCE(creator_name, 'un créateur suivi'),
    '« ' || NEW.name || ' » vient d’être publié.',
    '/product/' || NEW.id
  FROM public.startup_supporters ss
  JOIN public.startups s ON s.id = ss.startup_id
  WHERE ss.startup_id = NEW.startup_id
    AND ss.user_id <> s.owner_id;

  UPDATE public.startups
  SET last_post_at = now()
  WHERE id = NEW.startup_id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS notify_supporters_new_product_trg ON public.products;
CREATE TRIGGER notify_supporters_new_product_trg
AFTER INSERT OR UPDATE OF is_published ON public.products
FOR EACH ROW EXECUTE FUNCTION public.notify_supporters_new_product();

REVOKE ALL ON FUNCTION public.notify_supporters_new_product() FROM PUBLIC, anon, authenticated;