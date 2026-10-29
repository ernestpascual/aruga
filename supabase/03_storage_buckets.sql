-- ============================================================================
-- ARUGA SUPABASE SCRIPT 03: STORAGE BUCKETS
-- Creates storage buckets for program videos and chat attachments.
-- ============================================================================

-- 1. Create buckets if they do not exist (PRIVATE: no public read for PHI videos)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES 
  ('program-videos', 'program-videos', false, 104857600, ARRAY['video/mp4', 'video/webm', 'video/quicktime', 'image/jpeg', 'image/png']),
  ('chat-attachments', 'chat-attachments', false, 52428800, ARRAY['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/webm'])
ON CONFLICT (id) DO UPDATE SET
  public = false,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- 2. Storage RLS Policies (authenticated-only; no anon access)
DROP POLICY IF EXISTS "Public view for program videos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated view for program media" ON storage.objects;
CREATE POLICY "Authenticated view for program media"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id IN ('program-videos', 'chat-attachments'));

DROP POLICY IF EXISTS "Authenticated upload for program videos" ON storage.objects;
CREATE POLICY "Authenticated upload for program videos"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id IN ('program-videos', 'chat-attachments'));

DROP POLICY IF EXISTS "Authenticated update for program videos" ON storage.objects;
CREATE POLICY "Authenticated update for program videos"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id IN ('program-videos', 'chat-attachments'))
  WITH CHECK (bucket_id IN ('program-videos', 'chat-attachments'));

DROP POLICY IF EXISTS "Authenticated delete for program media" ON storage.objects;
CREATE POLICY "Authenticated delete for program media"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id IN ('program-videos', 'chat-attachments'));

DROP POLICY IF EXISTS "Service role full access storage" ON storage.objects;
CREATE POLICY "Service role full access storage"
  ON storage.objects FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
