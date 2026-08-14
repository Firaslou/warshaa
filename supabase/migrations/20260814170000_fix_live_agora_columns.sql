-- Ensure the live streaming fields used by the creator Live Studio exist.
-- Safe to run repeatedly on existing Warsha databases.
alter table public.live_events
  add column if not exists agora_channel text,
  add column if not exists live_mode text default 'external',
  add column if not exists external_platform text,
  add column if not exists external_url text,
  add column if not exists chat_enabled boolean default true;

create index if not exists idx_live_events_agora_channel
  on public.live_events (agora_channel);

notify pgrst, 'reload schema';
