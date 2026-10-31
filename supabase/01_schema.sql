-- ============================================================================
-- ARUGA SUPABASE SCRIPT 01: CORE RELATIONAL SCHEMA
-- Safe for repeated runs. Enforces strict UNIQUE constraints to prevent duplicate data.
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ----------------------------------------------------------------------------
-- 1. PROFILES TABLE
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('therapist', 'client')),
  display_name TEXT NOT NULL,
  discipline TEXT CHECK (discipline IN ('SLP', 'OT', 'PT') OR discipline IS NULL),
  client_category TEXT CHECK (client_category IN ('adult', 'adolescent', 'pedia', 'old_people') OR client_category IS NULL),
  
  -- Therapist specific fields
  license_number TEXT,
  facility_name TEXT,
  specialties TEXT,
  phone TEXT,
  office_hours TEXT,
  caseload_focus TEXT,
  bio TEXT,

  -- Client specific fields (Adult, Adolescent, Pedia)
  age INTEGER,
  date_of_birth TEXT,
  primary_condition TEXT,
  caregiver_name TEXT,
  caregiver_relationship TEXT,
  emergency_phone TEXT,
  therapy_goals TEXT,
  preferred_schedule TEXT,
  sensory_preferences TEXT,
  school_or_workplace TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ----------------------------------------------------------------------------
-- 2. PATIENTS TABLE (Caseload Directory)
-- Enforces UNIQUE email and client_user_id to prevent duplicate patient records.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.patients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  therapist_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  client_user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  name VARCHAR(150) NOT NULL,
  age INTEGER NOT NULL DEFAULT 1,
  gender VARCHAR(50) NOT NULL DEFAULT 'Unspecified',
  condition VARCHAR(255) NOT NULL DEFAULT 'General Occupational Therapy',
  email VARCHAR(255) NOT NULL UNIQUE,
  caregiver_name TEXT,
  client_category TEXT CHECK (client_category IN ('adult', 'adolescent', 'pedia', 'old_people') OR client_category IS NULL),
  invitation_status TEXT NOT NULL DEFAULT 'accepted',
  invitation_sent_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_patients_therapist ON public.patients(therapist_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_patients_client_user_idx ON public.patients(client_user_id) WHERE client_user_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_patients_email_idx ON public.patients(email);

-- ----------------------------------------------------------------------------
-- 3. HOME PROGRAMS & PROGRAM STEPS
-- Enforces UNIQUE position per program to prevent duplicate step positions.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.home_programs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  creator_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  title VARCHAR(200) NOT NULL,
  main_instructions TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'assigned' CHECK (status IN ('draft', 'assigned', 'archived')),
  assigned_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_home_programs_patient ON public.home_programs(patient_id);
CREATE INDEX IF NOT EXISTS idx_home_programs_creator ON public.home_programs(creator_id);

CREATE TABLE IF NOT EXISTS public.program_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id UUID NOT NULL REFERENCES public.home_programs(id) ON DELETE CASCADE,
  position INTEGER NOT NULL DEFAULT 1,
  title VARCHAR(150),
  instructions TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_program_step_position UNIQUE (program_id, position)
);

CREATE INDEX IF NOT EXISTS idx_program_steps_program ON public.program_steps(program_id);

-- ----------------------------------------------------------------------------
-- 4. SUBMISSIONS & STEP REVIEWS
-- Enforces UNIQUE program_id on submissions (1 submission per program)
-- Enforces UNIQUE (submission_id, program_step_id) on step_submissions
-- Enforces UNIQUE submission_id on submission_reviews (1 review per submission)
-- Enforces UNIQUE (review_id, step_submission_id) on step_reviews
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id UUID NOT NULL UNIQUE REFERENCES public.home_programs(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  client_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  state TEXT NOT NULL DEFAULT 'submitted' CHECK (state IN ('draft', 'submitted', 'reviewed')),
  consent_therapist BOOLEAN NOT NULL DEFAULT true,
  consent_meta_ai BOOLEAN NOT NULL DEFAULT true,
  submitted_at TIMESTAMPTZ DEFAULT NOW(),
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_submissions_patient ON public.submissions(patient_id);

CREATE TABLE IF NOT EXISTS public.step_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id UUID NOT NULL REFERENCES public.submissions(id) ON DELETE CASCADE,
  program_step_id UUID NOT NULL REFERENCES public.program_steps(id) ON DELETE CASCADE,
  video_path TEXT,
  media_meta JSONB NOT NULL DEFAULT '{}'::jsonb,
  client_comment TEXT,
  skipped BOOLEAN NOT NULL DEFAULT false,
  skip_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_step_submission UNIQUE (submission_id, program_step_id)
);

CREATE INDEX IF NOT EXISTS idx_step_submissions_submission ON public.step_submissions(submission_id);

CREATE TABLE IF NOT EXISTS public.submission_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id UUID NOT NULL UNIQUE REFERENCES public.submissions(id) ON DELETE CASCADE,
  therapist_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  overall_feedback TEXT,
  status TEXT NOT NULL DEFAULT 'published' CHECK (status IN ('draft', 'published')),
  published_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.step_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id UUID NOT NULL REFERENCES public.submission_reviews(id) ON DELETE CASCADE,
  step_submission_id UUID NOT NULL REFERENCES public.step_submissions(id) ON DELETE CASCADE,
  therapist_note TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_step_review UNIQUE (review_id, step_submission_id)
);

-- ----------------------------------------------------------------------------
-- 5. AI ANALYSES & AUDIT LOGS (ANTI-DUPLICATE PROTECTED)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.ai_analyses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  step_submission_id UUID NOT NULL REFERENCES public.step_submissions(id) ON DELETE CASCADE,
  analysis_kind TEXT NOT NULL DEFAULT 'full_review',
  model_id TEXT NOT NULL,
  idempotency_key TEXT NOT NULL UNIQUE,
  prompt_version TEXT NOT NULL DEFAULT 'v1',
  processing_status TEXT NOT NULL DEFAULT 'completed',
  spark_results JSONB,
  sam_results JSONB,
  artifact_path TEXT,
  confirmed_observations JSONB DEFAULT '[]'::jsonb,
  timing_ms INTEGER,
  sanitized_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_ai_analyses_step UNIQUE (step_submission_id)
);

CREATE TABLE IF NOT EXISTS public.audit_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  affected_resource TEXT NOT NULL,
  resource_id TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_actor ON public.audit_events(actor_id);
CREATE INDEX IF NOT EXISTS idx_audit_resource ON public.audit_events(affected_resource, resource_id);

-- ----------------------------------------------------------------------------
-- 6. THERAPIST-TO-CLIENT 1-ON-1 MESSAGES
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  sender_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  body TEXT NOT NULL CHECK (LENGTH(body) > 0 AND LENGTH(body) <= 4000),
  referenced_program_id UUID REFERENCES public.home_programs(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_messages_patient ON public.messages(patient_id);
CREATE INDEX IF NOT EXISTS idx_messages_created ON public.messages(created_at);

-- ----------------------------------------------------------------------------
-- 7. SAM TEST RESULTS (Per User)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.sam_test_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  prompt TEXT NOT NULL,
  file_name TEXT,
  duration_seconds NUMERIC,
  object_concepts JSONB NOT NULL DEFAULT '[]'::jsonb,
  tracks JSONB NOT NULL DEFAULT '[]'::jsonb,
  boxes JSONB NOT NULL DEFAULT '[]'::jsonb,
  svg_paths JSONB NOT NULL DEFAULT '[]'::jsonb,
  billed_requests INTEGER DEFAULT 1,
  model_id TEXT,
  latency_ms INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sam_results_user ON public.sam_test_results(user_id);
CREATE INDEX IF NOT EXISTS idx_sam_results_created ON public.sam_test_results(created_at);

-- ----------------------------------------------------------------------------
-- 8. ASK OT: MULTIPLE CONVERSATIONS & MESSAGES
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.ot_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT 'New Conversation',
  model_id TEXT NOT NULL DEFAULT 'meta/llama-3.3-70b-instruct',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ot_conv_user ON public.ot_conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_ot_conv_updated ON public.ot_conversations(updated_at);

CREATE TABLE IF NOT EXISTS public.ot_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.ot_conversations(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  attachments JSONB DEFAULT '[]'::jsonb,
  sam_result JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ot_msg_conv ON public.ot_messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_ot_msg_created ON public.ot_messages(created_at);

-- ----------------------------------------------------------------------------
-- 9. ROW LEVEL SECURITY (RLS) POLICIES
-- ----------------------------------------------------------------------------
-- ----------------------------------------------------------------------------
-- 9. ROW LEVEL SECURITY (RLS) POLICIES — RESTRICTIVE (safe for public repo)
-- No anon access. Authenticated users only see rows they own/are assigned to.
-- service_role bypasses RLS by default; no permissive USING (true) policies.
-- ----------------------------------------------------------------------------
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.patients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.home_programs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.program_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.step_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.submission_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.step_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_analyses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sam_test_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ot_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ot_messages ENABLE ROW LEVEL SECURITY;

-- Cleanup: remove legacy permissive policies if this DB ran the old script
DO $$
DECLARE
  tbl text;
BEGIN
  FOR tbl IN SELECT tablename FROM pg_tables WHERE schemaname = 'public'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS "Allow all for authenticated users" ON public.%I', tbl);
    EXECUTE format('DROP POLICY IF EXISTS "Allow all for service role" ON public.%I', tbl);
    EXECUTE format('DROP POLICY IF EXISTS "Allow public read" ON public.%I', tbl);
  END LOOP;
END $$;

-- Helpers (TEXT-role compatible)
CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS TEXT AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid();
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.therapist_owns_patient(p_patient_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (SELECT 1 FROM public.patients WHERE id = p_patient_id AND therapist_id = auth.uid());
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

-- PROFILES
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (id = auth.uid());
DROP POLICY IF EXISTS "Therapists can view client profiles" ON public.profiles;
CREATE POLICY "Therapists can view client profiles" ON public.profiles FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.patients WHERE client_user_id = profiles.id AND therapist_id = auth.uid())
);
DROP POLICY IF EXISTS "Clients can view assigned therapist profile" ON public.profiles;
CREATE POLICY "Clients can view assigned therapist profile" ON public.profiles FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.patients WHERE therapist_id = profiles.id AND client_user_id = auth.uid())
);
DROP POLICY IF EXISTS "Users can update own display name" ON public.profiles;
CREATE POLICY "Users can update own display name" ON public.profiles FOR UPDATE USING (id = auth.uid())
  WITH CHECK (id = auth.uid() AND role = (SELECT role FROM public.profiles WHERE id = auth.uid()));

-- PATIENTS
DROP POLICY IF EXISTS "Therapists manage own patients" ON public.patients;
CREATE POLICY "Therapists manage own patients" ON public.patients FOR ALL USING (therapist_id = auth.uid()) WITH CHECK (therapist_id = auth.uid());
DROP POLICY IF EXISTS "Clients view own patient record" ON public.patients;
CREATE POLICY "Clients view own patient record" ON public.patients FOR SELECT USING (client_user_id = auth.uid());

-- HOME PROGRAMS
DROP POLICY IF EXISTS "Therapists manage programs" ON public.home_programs;
CREATE POLICY "Therapists manage programs" ON public.home_programs FOR ALL USING (therapist_owns_patient(patient_id))
  WITH CHECK (therapist_owns_patient(patient_id) AND creator_id = auth.uid());
DROP POLICY IF EXISTS "Clients view assigned programs" ON public.home_programs;
CREATE POLICY "Clients view assigned programs" ON public.home_programs FOR SELECT USING (
  status IN ('assigned', 'archived') AND EXISTS (SELECT 1 FROM public.patients WHERE id = home_programs.patient_id AND client_user_id = auth.uid())
);

-- PROGRAM STEPS
DROP POLICY IF EXISTS "Therapists manage program steps" ON public.program_steps;
CREATE POLICY "Therapists manage program steps" ON public.program_steps FOR ALL USING (
  EXISTS (SELECT 1 FROM public.home_programs hp WHERE hp.id = program_steps.program_id AND public.therapist_owns_patient(hp.patient_id))
);
DROP POLICY IF EXISTS "Clients view assigned program steps" ON public.program_steps;
CREATE POLICY "Clients view assigned program steps" ON public.program_steps FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.home_programs hp JOIN public.patients p ON p.id = hp.patient_id
    WHERE hp.id = program_steps.program_id AND hp.status IN ('assigned', 'archived') AND p.client_user_id = auth.uid())
);

-- SUBMISSIONS
DROP POLICY IF EXISTS "Therapists view submissions" ON public.submissions;
CREATE POLICY "Therapists view submissions" ON public.submissions FOR SELECT USING (public.therapist_owns_patient(patient_id));
DROP POLICY IF EXISTS "Clients manage own submissions" ON public.submissions;
CREATE POLICY "Clients manage own submissions" ON public.submissions FOR SELECT USING (client_id = auth.uid());
DROP POLICY IF EXISTS "Clients update draft submission" ON public.submissions;
CREATE POLICY "Clients update draft submission" ON public.submissions FOR UPDATE USING (client_id = auth.uid() AND state = 'draft')
  WITH CHECK (client_id = auth.uid() AND state = 'draft');

-- STEP SUBMISSIONS
DROP POLICY IF EXISTS "Therapists view step submissions" ON public.step_submissions;
CREATE POLICY "Therapists view step submissions" ON public.step_submissions FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.submissions s WHERE s.id = step_submissions.submission_id AND public.therapist_owns_patient(s.patient_id))
);
DROP POLICY IF EXISTS "Clients view own step submissions" ON public.step_submissions;
CREATE POLICY "Clients view own step submissions" ON public.step_submissions FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.submissions s WHERE s.id = step_submissions.submission_id AND s.client_id = auth.uid())
);
DROP POLICY IF EXISTS "Clients modify draft step submissions" ON public.step_submissions;
CREATE POLICY "Clients modify draft step submissions" ON public.step_submissions FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.submissions s WHERE s.id = step_submissions.submission_id AND s.client_id = auth.uid() AND s.state = 'draft')
);
DROP POLICY IF EXISTS "Clients update draft step submissions" ON public.step_submissions;
CREATE POLICY "Clients update draft step submissions" ON public.step_submissions FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.submissions s WHERE s.id = step_submissions.submission_id AND s.client_id = auth.uid() AND s.state = 'draft')
);

-- SUBMISSION REVIEWS
DROP POLICY IF EXISTS "Therapists manage reviews" ON public.submission_reviews;
CREATE POLICY "Therapists manage reviews" ON public.submission_reviews FOR ALL USING (therapist_id = auth.uid()) WITH CHECK (therapist_id = auth.uid());
DROP POLICY IF EXISTS "Clients view published reviews" ON public.submission_reviews;
CREATE POLICY "Clients view published reviews" ON public.submission_reviews FOR SELECT USING (
  status = 'published' AND EXISTS (SELECT 1 FROM public.submissions s WHERE s.id = submission_reviews.submission_id AND s.client_id = auth.uid())
);

-- STEP REVIEWS
DROP POLICY IF EXISTS "Therapists manage step reviews" ON public.step_reviews;
CREATE POLICY "Therapists manage step reviews" ON public.step_reviews FOR ALL USING (
  EXISTS (SELECT 1 FROM public.submission_reviews r WHERE r.id = step_reviews.review_id AND r.therapist_id = auth.uid())
);
DROP POLICY IF EXISTS "Clients view published step reviews" ON public.step_reviews;
CREATE POLICY "Clients view published step reviews" ON public.step_reviews FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.submission_reviews r JOIN public.submissions s ON s.id = r.submission_id
    WHERE r.id = step_reviews.review_id AND r.status = 'published' AND s.client_id = auth.uid())
);

-- MESSAGES
DROP POLICY IF EXISTS "Therapists view and send thread messages" ON public.messages;
CREATE POLICY "Therapists view and send thread messages" ON public.messages FOR ALL USING (public.therapist_owns_patient(patient_id))
  WITH CHECK (public.therapist_owns_patient(patient_id) AND sender_id = auth.uid());
DROP POLICY IF EXISTS "Clients view and send thread messages" ON public.messages;
CREATE POLICY "Clients view and send thread messages" ON public.messages FOR ALL USING (
  EXISTS (SELECT 1 FROM public.patients WHERE id = messages.patient_id AND client_user_id = auth.uid())
) WITH CHECK (
  EXISTS (SELECT 1 FROM public.patients WHERE id = messages.patient_id AND client_user_id = auth.uid()) AND sender_id = auth.uid()
);

-- AI ANALYSES (therapist-only)
DROP POLICY IF EXISTS "Therapists view and manage ai analyses" ON public.ai_analyses;
CREATE POLICY "Therapists view and manage ai analyses" ON public.ai_analyses FOR ALL USING (
  EXISTS (SELECT 1 FROM public.step_submissions ss JOIN public.submissions s ON s.id = ss.submission_id
    WHERE ss.id = ai_analyses.step_submission_id AND public.therapist_owns_patient(s.patient_id))
);

-- AUDIT EVENTS
DROP POLICY IF EXISTS "Audit events viewable by involved actors" ON public.audit_events;
CREATE POLICY "Audit events viewable by involved actors" ON public.audit_events FOR SELECT USING (actor_id = auth.uid());
DROP POLICY IF EXISTS "Audit events insertable by authenticated users" ON public.audit_events;
CREATE POLICY "Audit events insertable by authenticated users" ON public.audit_events FOR INSERT WITH CHECK (actor_id = auth.uid());

-- SAM TEST RESULTS (owner-only)
DROP POLICY IF EXISTS "Users manage own sam results" ON public.sam_test_results;
CREATE POLICY "Users manage own sam results" ON public.sam_test_results FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- OT CONVERSATIONS / MESSAGES (owner-only)
DROP POLICY IF EXISTS "Users manage own ot conversations" ON public.ot_conversations;
CREATE POLICY "Users manage own ot conversations" ON public.ot_conversations FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "Users view own ot messages" ON public.ot_messages;
CREATE POLICY "Users view own ot messages" ON public.ot_messages FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.ot_conversations c WHERE c.id = ot_messages.conversation_id AND c.user_id = auth.uid())
);
DROP POLICY IF EXISTS "Users insert own ot messages" ON public.ot_messages;
CREATE POLICY "Users insert own ot messages" ON public.ot_messages FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.ot_conversations c WHERE c.id = ot_messages.conversation_id AND c.user_id = auth.uid())
);
