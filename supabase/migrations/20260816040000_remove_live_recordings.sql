-- Warsha now exposes active external live streams only. Remove the obsolete
-- replay storage and metadata so recordings cannot be uploaded or published.
DROP POLICY IF EXISTS "startup owners can upload live recordings" ON storage.objects;
DROP POLICY IF EXISTS "startup owners can manage live recordings" ON storage.objects;

DELETE FROM storage.objects WHERE bucket_id = 'live-recordings';
DELETE FROM storage.buckets WHERE id = 'live-recordings';

ALTER TABLE public.live_events DROP COLUMN IF EXISTS recording_url;
