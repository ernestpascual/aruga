-- RUN_ONCE_PRIVACY_FIX.sql
-- One-file remediation for Aruga privacy hardening.
-- Combines: message photo attachments + activity privacy isolation + ePHI owner hardening
-- Safe to run repeatedly (IF NOT EXISTS / DROP IF EXISTS guards).
-- Run this in Supabase SQL Editor after applying earlier 00-06 setup (or on fresh DB it completes it).

-- ============================================================================
-- 1. MESSAGE PHOTO ATTACHMENTS (chat-attachments bucket optimization)
-- ============================================================================
ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS attachment_url TEXT,
  ADD COLUMN IF NOT EXISTS attachment_storage_path TEXT,
  ADD COLUMN IF NOT EXISTS attachment_type TEXT CHECK (attachment_type IN ('image','video') OR attachment_type IS NULL),
  ADD COLUMN IF NOT EXISTS attachment_meta JSONB NOT NULL DEFAULT '{}'::jsonb;

DO $$ BEGIN
  ALTER TABLE public.messages DROP CONSTRAINT IF EXISTS messages_body_check;
  ALTER TABLE public.messages ADD CONSTRAINT messages_body_check CHECK (LENGTH(body) >= 0 AND LENGTH(body) <= 4000);
EXCEPTION WHEN OTHERS THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS idx_messages_has_attachment ON public.messages(patient_id) WHERE attachment_url IS NOT NULL;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('chat-attachments','chat-attachments', false, 52428800, ARRAY['image/jpeg','image/png','image/webp','image/heic','video/mp4','video/webm'])
ON CONFLICT (id) DO UPDATE SET public=false, file_size_limit=52428800, allowed_mime_types=ARRAY['image/jpeg','image/png','image/webp','image/heic','video/mp4','video/webm'];

DROP POLICY IF EXISTS "Authenticated view for chat attachments" ON storage.objects;
CREATE POLICY "Authenticated view for chat attachments" ON storage.objects FOR SELECT TO authenticated USING (bucket_id='chat-attachments');
DROP POLICY IF EXISTS "Authenticated upload for chat attachments" ON storage.objects;
CREATE POLICY "Authenticated upload for chat attachments" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id='chat-attachments');
DROP POLICY IF EXISTS "Authenticated delete for chat attachments" ON storage.objects;
CREATE POLICY "Authenticated delete for chat attachments" ON storage.objects FOR DELETE TO authenticated USING (bucket_id='chat-attachments');

-- ============================================================================
-- 2. ACTIVITY PRIVACY: visible only when attached via home_programs → program_steps
-- ============================================================================
DROP POLICY IF EXISTS "Clients view assigned generated activities" ON public.generated_activities;
CREATE POLICY "Clients view assigned generated activities" ON public.generated_activities FOR SELECT TO authenticated
USING (
  creator_id = auth.uid()
  OR EXISTS (SELECT 1 FROM public.program_steps ps JOIN public.home_programs hp ON hp.id=ps.program_id WHERE ps.generated_activity_id=generated_activities.id AND hp.patient_id IN (SELECT id FROM public.patients WHERE client_user_id=auth.uid()))
  OR EXISTS (SELECT 1 FROM public.patients WHERE id=generated_activities.patient_id AND client_user_id=auth.uid())
);
DROP POLICY IF EXISTS "Therapists manage generated activities" ON public.generated_activities;
CREATE POLICY "Therapists manage generated activities" ON public.generated_activities FOR ALL TO authenticated
USING (
  creator_id = auth.uid()
  OR EXISTS (SELECT 1 FROM public.patients WHERE id=generated_activities.patient_id AND therapist_id=auth.uid())
  OR EXISTS (SELECT 1 FROM public.program_steps ps JOIN public.home_programs hp ON hp.id=ps.program_id JOIN public.patients pa ON pa.id=hp.patient_id WHERE ps.generated_activity_id=generated_activities.id AND pa.therapist_id=auth.uid())
) WITH CHECK (creator_id = auth.uid());

DROP POLICY IF EXISTS "Therapists view completions" ON public.activity_completions;
CREATE POLICY "Therapists view completions" ON public.activity_completions FOR SELECT TO authenticated USING (public.therapist_owns_patient(patient_id) OR client_id=auth.uid());
DROP POLICY IF EXISTS "Clients manage own completions" ON public.activity_completions;
CREATE POLICY "Clients manage own completions" ON public.activity_completions FOR ALL TO authenticated USING (client_id=auth.uid() OR public.therapist_owns_patient(patient_id)) WITH CHECK (client_id=auth.uid());

-- ============================================================================
-- 3. EPHI OWNER HARDENING (messages, submissions, soap_notes as defense-in-depth)
-- Note: API owner checks via service_role are primary; these RLS tighten direct client Supabase calls.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.therapist_owns_patient(p_patient_id UUID) RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT EXISTS (SELECT 1 FROM public.patients WHERE id=p_patient_id AND therapist_id=auth.uid());
$$;

-- Messages already have therapist/client thread policies in 01_schema; ensure they have sender_id = auth.uid() check
DROP POLICY IF EXISTS "Therapists view and send thread messages" ON public.messages;
CREATE POLICY "Therapists view and send thread messages" ON public.messages FOR ALL TO authenticated
  USING (public.therapist_owns_patient(patient_id)) WITH CHECK (public.therapist_owns_patient(patient_id) AND sender_id=auth.uid());
DROP POLICY IF EXISTS "Clients view and send thread messages" ON public.messages;
CREATE POLICY "Clients view and send thread messages" ON public.messages FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.patients WHERE id=messages.patient_id AND client_user_id=auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.patients WHERE id=messages.patient_id AND client_user_id=auth.uid()) AND sender_id=auth.uid());

-- Submissions: already restrictive; add explicit deny for anon via RLS enabled
ALTER TABLE public.submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.step_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.soap_notes ENABLE ROW LEVEL SECURITY;

-- Patients: therapist manage + client view (already); no change needed but ensure not permissive
-- Storage: private buckets already; keep authenticated-only (no public read for PHI)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('program-videos','program-videos', false, 104857600, ARRAY['video/mp4','video/webm','video/quicktime','image/jpeg','image/png'])
ON CONFLICT (id) DO UPDATE SET public=false;
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('activity-assets','activity-assets', false, 20971520, ARRAY['image/png','image/jpeg','image/webp','image/svg+xml','application/pdf'])
ON CONFLICT (id) DO UPDATE SET public=false;

DROP POLICY IF EXISTS "Authenticated view for program media" ON storage.objects;
CREATE POLICY "Authenticated view for program media" ON storage.objects FOR SELECT TO authenticated USING (bucket_id IN ('program-videos','chat-attachments','activity-assets'));
DROP POLICY IF EXISTS "Authenticated upload for program videos" ON storage.objects;
CREATE POLICY "Authenticated upload for program videos" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id IN ('program-videos','chat-attachments','activity-assets'));
DROP POLICY IF EXISTS "Authenticated delete for program media" ON storage.objects;
CREATE POLICY "Authenticated delete for program media" ON storage.objects FOR DELETE TO authenticated USING (bucket_id IN ('program-videos','chat-attachments','activity-assets'));
