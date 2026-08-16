-- Warsha now exposes active external live streams only. Disable the obsolete
-- replay storage policies and remove replay metadata from live events.
--
-- Supabase intentionally blocks direct SQL mutations of storage.objects and
-- storage.buckets. Existing files and the bucket must therefore be removed
-- through the Storage API or Dashboard, outside this database migration.
DROP POLICY IF EXISTS "startup owners can upload live recordings" ON storage.objects;
DROP POLICY IF EXISTS "startup owners can manage live recordings" ON storage.objects;

ALTER TABLE public.live_events DROP COLUMN IF EXISTS recording_url;
