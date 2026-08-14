-- Live replay support: each ended live can have a recorded WebM replay.
alter table public.live_events
  add column if not exists recording_url text;

-- Public bucket because replays are intentionally watchable by visitors.
insert into storage.buckets (id, name, public)
values ('live-recordings', 'live-recordings', true)
on conflict (id) do update set public = true;

-- Only an authenticated startup owner can upload a recording into its own folder.
drop policy if exists "startup owners can upload live recordings" on storage.objects;
create policy "startup owners can upload live recordings"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'live-recordings'
  and exists (
    select 1
    from public.startups s
    where s.id::text = (storage.foldername(name))[1]
      and s.owner_id = auth.uid()
  )
);

-- Owners may replace/delete their own replay files.
drop policy if exists "startup owners can manage live recordings" on storage.objects;
create policy "startup owners can manage live recordings"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'live-recordings'
  and exists (
    select 1
    from public.startups s
    where s.id::text = (storage.foldername(name))[1]
      and s.owner_id = auth.uid()
  )
);
