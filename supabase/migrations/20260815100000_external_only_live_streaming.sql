-- Warsha no longer hosts live video. New events point to a public social live.
-- Legacy Agora columns and rows remain available so historical data is not lost.
ALTER TABLE public.live_events
  ALTER COLUMN live_mode SET DEFAULT 'external';

COMMENT ON COLUMN public.live_events.live_mode IS
  'New Warsha lives use external social platforms. Agora is retained only for legacy rows.';
