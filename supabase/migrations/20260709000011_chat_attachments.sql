-- Chat attachments: let users send files / photos / documents in the chat.

-- 1. Store attachment metadata on each message: [{ url, name, type, size }, …]
ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS attachments JSONB NOT NULL DEFAULT '[]'::jsonb;

-- 2. Public storage bucket for the uploaded files (any type, 25 MB cap).
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('chat-files', 'chat-files', true, 26214400, NULL)
ON CONFLICT (id) DO NOTHING;

-- 3. Storage policies — authenticated users upload; anyone can read (public bucket).
DROP POLICY IF EXISTS "Authenticated users can upload chat files" ON storage.objects;
CREATE POLICY "Authenticated users can upload chat files"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'chat-files');

DROP POLICY IF EXISTS "Authenticated users can update chat files" ON storage.objects;
CREATE POLICY "Authenticated users can update chat files"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'chat-files');

DROP POLICY IF EXISTS "Public read access for chat files" ON storage.objects;
CREATE POLICY "Public read access for chat files"
ON storage.objects FOR SELECT TO public
USING (bucket_id = 'chat-files');
