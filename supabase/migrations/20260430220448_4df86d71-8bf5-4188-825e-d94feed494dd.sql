
-- Products: add video and delegation
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS video_url text,
  ADD COLUMN IF NOT EXISTS delegation text;

-- Chat messages: attachments
ALTER TABLE public.chat_messages
  ADD COLUMN IF NOT EXISTS attachments text[] NOT NULL DEFAULT '{}';

-- Storage bucket for chat attachments (private)
INSERT INTO storage.buckets (id, name, public)
VALUES ('chat-attachments', 'chat-attachments', false)
ON CONFLICT (id) DO NOTHING;

-- Policies on storage.objects for chat-attachments
-- Path convention: {conversation_id}/{user_id}/{filename}
CREATE POLICY "Chat participants can read attachments"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'chat-attachments'
  AND EXISTS (
    SELECT 1 FROM public.chat_conversations c
    WHERE c.id::text = (storage.foldername(name))[1]
      AND (
        c.buyer_id = auth.uid()
        OR EXISTS (SELECT 1 FROM public.startups s WHERE s.id = c.startup_id AND s.owner_id = auth.uid())
      )
  )
);

CREATE POLICY "Chat participants can upload attachments"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'chat-attachments'
  AND auth.uid()::text = (storage.foldername(name))[2]
  AND EXISTS (
    SELECT 1 FROM public.chat_conversations c
    WHERE c.id::text = (storage.foldername(name))[1]
      AND (
        c.buyer_id = auth.uid()
        OR EXISTS (SELECT 1 FROM public.startups s WHERE s.id = c.startup_id AND s.owner_id = auth.uid())
      )
  )
);
