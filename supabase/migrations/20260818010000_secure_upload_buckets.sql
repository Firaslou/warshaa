-- Defense in depth for every user-controlled upload bucket. Client-side checks
-- improve UX, but these limits are enforced by Supabase Storage itself.
UPDATE storage.buckets
SET file_size_limit = 26214400,
    allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/webm']
WHERE id = 'product-images';

UPDATE storage.buckets
SET file_size_limit = 5242880,
    allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp']
WHERE id = 'review-photos';

UPDATE storage.buckets
SET file_size_limit = 15728640,
    allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/webm']
WHERE id IN ('startup-assets', 'applications');

UPDATE storage.buckets
SET file_size_limit = 5242880,
    allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp']
WHERE id = 'chat-attachments';

-- Product/service media paths are {owner_id}/{startup_id}/..., so an ordinary
-- authenticated user cannot turn the public bucket into arbitrary file hosting.
DROP POLICY IF EXISTS "Auth upload product-images" ON storage.objects;
-- The legacy FOR ALL policy also covered INSERT and would otherwise make the
-- stricter rule below ineffective because PostgreSQL combines permissive RLS
-- policies with OR.
DROP POLICY IF EXISTS "Owner manage product-images" ON storage.objects;
CREATE POLICY "Startup owners upload product media"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'product-images'
  AND auth.uid()::text = (storage.foldername(name))[1]
  AND EXISTS (
    SELECT 1 FROM public.startups s
    WHERE s.id::text = (storage.foldername(name))[2]
      AND s.owner_id = auth.uid()
  )
);

CREATE POLICY "Owners update product media"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'product-images' AND auth.uid()::text = (storage.foldername(name))[1])
WITH CHECK (bucket_id = 'product-images' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Owners delete product media"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'product-images' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Branding paths are {owner_id}/{startup_id}/..., while stories use
-- {owner_id}/stories/{startup_id}/.... Both forms must belong to the caller.
DROP POLICY IF EXISTS "Auth upload startup-assets" ON storage.objects;
CREATE POLICY "Startup owners upload startup assets"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'startup-assets'
  AND auth.uid()::text = (storage.foldername(name))[1]
  AND EXISTS (
    SELECT 1 FROM public.startups s
    WHERE s.owner_id = auth.uid()
      AND s.id::text = CASE
        WHEN (storage.foldername(name))[2] = 'stories' THEN (storage.foldername(name))[3]
        ELSE (storage.foldername(name))[2]
      END
  )
);

DROP POLICY IF EXISTS "Users delete own review photos" ON storage.objects;
CREATE POLICY "Users delete own review photos"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'review-photos' AND auth.uid()::text = (storage.foldername(name))[1]);

DROP POLICY IF EXISTS "Applicants delete own application files" ON storage.objects;
CREATE POLICY "Applicants delete own application files"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'applications' AND auth.uid()::text = (storage.foldername(name))[1]);
