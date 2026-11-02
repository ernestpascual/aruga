-- ============================================================================
-- ARUGA ALL-IN-ONE MASTER SUPABASE SETUP SCRIPT
-- Paste and run this script in your Supabase SQL Editor (https://supabase.com/dashboard).
-- Safe for repeated runs: idempotency guards (IF NOT EXISTS, ON CONFLICT, DO NOTHING)
-- prevent any duplicate tables, columns, rows, or trigger violations.
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- SECTION 1: DATABASE TABLES & CONSTRAINTS
-- ============================================================================

-- 1. Profiles Table
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('therapist', 'client')),
  display_name TEXT NOT NULL,
  discipline TEXT CHECK (discipline IN ('SLP', 'OT', 'PT') OR discipline IS NULL),
  client_category TEXT CHECK (client_category IN ('adult', 'adolescent', 'pedia', 'geriatric', 'old_people') OR client_category IS NULL),
  email TEXT,
  
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

-- 2. Patients Table (Enforces UNIQUE email & client_user_id)
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
  client_category TEXT CHECK (client_category IN ('adult', 'adolescent', 'pedia', 'geriatric', 'old_people') OR client_category IS NULL),
  invitation_status TEXT NOT NULL DEFAULT 'accepted',
  invitation_initiated_by TEXT DEFAULT 'therapist' CHECK (invitation_initiated_by IN ('therapist', 'client') OR invitation_initiated_by IS NULL),
  invitation_sent_at TIMESTAMPTZ DEFAULT NOW(),
  previous_therapist_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  handover_notes TEXT,
  pending_therapist_email TEXT,
  -- SECURITY: short-lived bootstrap secret only; nulled on first login via /api/auth/clear-temp-credentials.
  -- Owning therapist only (RLS). Production: replace with invite/reset-password flow.
  temporary_password TEXT,
  first_login_at TIMESTAMPTZ,
  credentials_cleared_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Safe migrations for existing databases
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email TEXT;
CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles(LOWER(email));

ALTER TABLE public.patients ADD COLUMN IF NOT EXISTS temporary_password TEXT;
ALTER TABLE public.patients ADD COLUMN IF NOT EXISTS first_login_at TIMESTAMPTZ;
ALTER TABLE public.patients ADD COLUMN IF NOT EXISTS credentials_cleared_at TIMESTAMPTZ;
ALTER TABLE public.patients ADD COLUMN IF NOT EXISTS invitation_status TEXT NOT NULL DEFAULT 'accepted';
ALTER TABLE public.patients ADD COLUMN IF NOT EXISTS invitation_initiated_by TEXT DEFAULT 'therapist';
ALTER TABLE public.patients ADD COLUMN IF NOT EXISTS invitation_sent_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE public.patients ADD COLUMN IF NOT EXISTS previous_therapist_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL;
ALTER TABLE public.patients ADD COLUMN IF NOT EXISTS handover_notes TEXT;
ALTER TABLE public.patients ADD COLUMN IF NOT EXISTS pending_therapist_email TEXT;
ALTER TABLE public.patients ADD COLUMN IF NOT EXISTS care_guide TEXT NOT NULL DEFAULT '';

CREATE INDEX IF NOT EXISTS idx_patients_therapist ON public.patients(therapist_id);
CREATE INDEX IF NOT EXISTS idx_patients_pending_therapist_email ON public.patients(LOWER(pending_therapist_email));
CREATE INDEX IF NOT EXISTS idx_patients_invitation_status ON public.patients(invitation_status);
CREATE UNIQUE INDEX IF NOT EXISTS uq_patients_client_user_idx ON public.patients(client_user_id) WHERE client_user_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_patients_email_idx ON public.patients(email);

-- 3. Home Programs & Program Steps
CREATE TABLE IF NOT EXISTS public.home_programs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  creator_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  title VARCHAR(200) NOT NULL,
  main_instructions TEXT NOT NULL,
  scheduled_dates JSONB DEFAULT '[]'::jsonb,
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

-- 4. Submissions & Step Reviews
CREATE TABLE IF NOT EXISTS public.submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id UUID NOT NULL REFERENCES public.home_programs(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  client_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  scheduled_date TEXT,
  state TEXT NOT NULL DEFAULT 'submitted' CHECK (state IN ('draft', 'submitted', 'reviewed')),
  consent_therapist BOOLEAN NOT NULL DEFAULT true,
  consent_meta_ai BOOLEAN NOT NULL DEFAULT true,
  submitted_at TIMESTAMPTZ DEFAULT NOW(),
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_submissions_patient ON public.submissions(patient_id);
CREATE INDEX IF NOT EXISTS idx_submissions_prog_date ON public.submissions(program_id, scheduled_date);

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

-- 5. AI Analyses & Audit Logs
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

-- 6. Therapist-to-Client 1-on-1 Messages
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

-- 7. SAM Test Results (Per User)
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

-- 8. Ask OT Multiple Conversations & Messages
CREATE TABLE IF NOT EXISTS public.ot_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT 'New Conversation',
  model_id TEXT NOT NULL DEFAULT 'meta/llama-3.3-70b-instruct',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ot_conv_user ON public.ot_conversations(user_id);

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

-- ============================================================================
-- SECTION 2: ROW LEVEL SECURITY (RLS) POLICIES — RESTRICTIVE (safe for public repo)
-- No anon access. Authenticated users only see rows they own/are assigned to.
-- service_role bypasses RLS by default; no permissive USING (true) policies.
-- ============================================================================
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
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (id = auth.uid());
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid())
  WITH CHECK (id = auth.uid() AND (public.current_user_role() IS NULL OR role = public.current_user_role()));

-- PATIENTS (note: temporary_password visible only to owning therapist via this policy; cleared on first login)
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

-- ============================================================================
-- SECTION 3: AUTOMATIC TRIGGERS & ANTI-DUPLICATION FUNCTIONS
-- ============================================================================

-- Automatic Updated_At Trigger Function
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS trigger AS $$
BEGIN
  new.updated_at = NOW();
  RETURN new;
END;
$$ LANGUAGE plpgsql;

DO $$
DECLARE
  t text;
BEGIN
  FOR t IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename IN (
    'profiles', 'patients', 'home_programs', 'submissions', 'submission_reviews', 'ai_analyses', 'ot_conversations'
  )
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trigger_updated_at_%I ON public.%I', t, t);
    EXECUTE format('CREATE TRIGGER trigger_updated_at_%I BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at()', t, t);
  END LOOP;
END $$;

-- Automatic Profile and Patient Provisioning on Signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
DECLARE
  v_role TEXT;
  v_name TEXT;
  v_category TEXT;
  v_therapist_id UUID;
  v_email TEXT;
BEGIN
  v_email := LOWER(TRIM(new.email));
  v_name := COALESCE(
    new.raw_user_meta_data->>'name',
    new.raw_user_meta_data->>'display_name',
    split_part(new.email, '@', 1)
  );
  v_category := new.raw_user_meta_data->>'client_category';

  -- Extract therapist_id if provided in raw_user_meta_data
  IF (new.raw_user_meta_data->>'therapist_id' IS NOT NULL AND new.raw_user_meta_data->>'therapist_id' <> '') THEN
    BEGIN
      v_therapist_id := (new.raw_user_meta_data->>'therapist_id')::uuid;
    EXCEPTION WHEN OTHERS THEN
      v_therapist_id := NULL;
    END;
  ELSE
    v_therapist_id := NULL;
  END IF;

  -- Any user created by a therapist is strictly guaranteed to be 'client' type
  IF (v_therapist_id IS NOT NULL OR (new.raw_user_meta_data->>'created_by_therapist')::boolean IS TRUE) THEN
    v_role := 'client';
  ELSE
    v_role := COALESCE(new.raw_user_meta_data->>'role', 'client');
  END IF;

  -- Upsert Profile (Prevents duplicate profiles by ID, preserves email, enforces client type)
  INSERT INTO public.profiles (
    id,
    display_name,
    role,
    email,
    client_category,
    created_at,
    updated_at
  ) VALUES (
    new.id,
    v_name,
    v_role,
    v_email,
    v_category,
    NOW(),
    NOW()
  )
  ON CONFLICT (id) DO UPDATE SET
    display_name = COALESCE(EXCLUDED.display_name, public.profiles.display_name),
    role = CASE 
      WHEN (v_therapist_id IS NOT NULL OR (new.raw_user_meta_data->>'created_by_therapist')::boolean IS TRUE) THEN 'client'
      ELSE COALESCE(EXCLUDED.role, public.profiles.role) 
    END,
    email = COALESCE(EXCLUDED.email, public.profiles.email),
    client_category = COALESCE(EXCLUDED.client_category, public.profiles.client_category),
    updated_at = NOW();

  -- If therapist_id is provided, ensure therapist profile exists so foreign key is satisfied
  IF (v_therapist_id IS NOT NULL) THEN
    INSERT INTO public.profiles (id, display_name, role, created_at, updated_at)
    VALUES (v_therapist_id, 'Occupational Therapist', 'therapist', NOW(), NOW())
    ON CONFLICT (id) DO NOTHING;
  END IF;

  -- If Client, ensure linked patient record with therapist_id
  IF (v_role = 'client') THEN
    INSERT INTO public.patients (
      therapist_id,
      client_user_id,
      name,
      email,
      client_category,
      condition,
      invitation_status,
      created_at,
      updated_at
    ) VALUES (
      v_therapist_id,
      new.id,
      v_name,
      v_email,
      v_category,
      'Personalized Rehabilitation Care',
      CASE WHEN v_therapist_id IS NOT NULL THEN 'pending' ELSE 'unlinked' END,
      NOW(),
      NOW()
    )
    ON CONFLICT (email) DO UPDATE SET
      therapist_id = COALESCE(EXCLUDED.therapist_id, public.patients.therapist_id),
      client_user_id = EXCLUDED.client_user_id,
      client_category = COALESCE(EXCLUDED.client_category, public.patients.client_category),
      name = COALESCE(EXCLUDED.name, public.patients.name),
      updated_at = NOW();
  END IF;

  -- If a Therapist signs up, self-heal any patients waiting for this therapist email
  IF (v_role = 'therapist') THEN
    UPDATE public.patients
    SET therapist_id = new.id
    WHERE (LOWER(TRIM(pending_therapist_email)) = v_email)
      AND (therapist_id IS NULL OR therapist_id <> new.id);
  END IF;

  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Deduplicated Chat Message Sender (RPC)
CREATE OR REPLACE FUNCTION public.send_chat_message_deduped(
  p_patient_id UUID,
  p_sender_id UUID,
  p_body TEXT,
  p_referenced_program_id UUID DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_existing_id UUID;
  v_new_id UUID;
BEGIN
  SELECT id INTO v_existing_id
  FROM public.messages
  WHERE patient_id = p_patient_id
    AND sender_id = p_sender_id
    AND body = p_body
    AND created_at >= (NOW() - INTERVAL '3 seconds')
  LIMIT 1;

  IF v_existing_id IS NOT NULL THEN
    RETURN v_existing_id;
  END IF;

  INSERT INTO public.messages (
    patient_id,
    sender_id,
    body,
    referenced_program_id,
    created_at
  ) VALUES (
    p_patient_id,
    p_sender_id,
    p_body,
    p_referenced_program_id,
    NOW()
  )
  RETURNING id INTO v_new_id;

  RETURN v_new_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Deduplicated Ask OT Message Sender (RPC)
CREATE OR REPLACE FUNCTION public.send_ot_message_deduped(
  p_conversation_id UUID,
  p_role TEXT,
  p_content TEXT,
  p_attachments JSONB DEFAULT '[]'::jsonb,
  p_sam_result JSONB DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_existing_id UUID;
  v_new_id UUID;
BEGIN
  SELECT id INTO v_existing_id
  FROM public.ot_messages
  WHERE conversation_id = p_conversation_id
    AND role = p_role
    AND content = p_content
    AND created_at >= (NOW() - INTERVAL '2 seconds')
  LIMIT 1;

  IF v_existing_id IS NOT NULL THEN
    RETURN v_existing_id;
  END IF;

  INSERT INTO public.ot_messages (
    conversation_id,
    role,
    content,
    attachments,
    sam_result,
    created_at
  ) VALUES (
    p_conversation_id,
    p_role,
    p_content,
    COALESCE(p_attachments, '[]'::jsonb),
    p_sam_result,
    NOW()
  )
  RETURNING id INTO v_new_id;

  UPDATE public.ot_conversations
  SET updated_at = NOW()
  WHERE id = p_conversation_id;

  RETURN v_new_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Deduplicated SAM Test Result Recorder (RPC)
CREATE OR REPLACE FUNCTION public.save_sam_result_deduped(
  p_user_id UUID,
  p_prompt TEXT,
  p_file_name TEXT,
  p_duration_seconds NUMERIC,
  p_object_concepts JSONB DEFAULT '[]'::jsonb,
  p_tracks JSONB DEFAULT '[]'::jsonb,
  p_boxes JSONB DEFAULT '[]'::jsonb,
  p_svg_paths JSONB DEFAULT '[]'::jsonb,
  p_billed_requests INTEGER DEFAULT 1,
  p_model_id TEXT DEFAULT 'sam-3.1',
  p_latency_ms INTEGER DEFAULT 0
)
RETURNS UUID AS $$
DECLARE
  v_existing_id UUID;
  v_new_id UUID;
BEGIN
  SELECT id INTO v_existing_id
  FROM public.sam_test_results
  WHERE user_id = p_user_id
    AND prompt = p_prompt
    AND file_name = p_file_name
    AND created_at >= (NOW() - INTERVAL '5 seconds')
  LIMIT 1;

  IF v_existing_id IS NOT NULL THEN
    RETURN v_existing_id;
  END IF;

  INSERT INTO public.sam_test_results (
    user_id,
    prompt,
    file_name,
    duration_seconds,
    object_concepts,
    tracks,
    boxes,
    svg_paths,
    billed_requests,
    model_id,
    latency_ms,
    created_at
  ) VALUES (
    p_user_id,
    p_prompt,
    p_file_name,
    p_duration_seconds,
    COALESCE(p_object_concepts, '[]'::jsonb),
    COALESCE(p_tracks, '[]'::jsonb),
    COALESCE(p_boxes, '[]'::jsonb),
    COALESCE(p_svg_paths, '[]'::jsonb),
    p_billed_requests,
    p_model_id,
    p_latency_ms,
    NOW()
  )
  RETURNING id INTO v_new_id;

  RETURN v_new_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- SECTION 4: STORAGE BUCKETS SETUP (PRIVATE: no public read for PHI videos)
-- ============================================================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES 
  ('program-videos', 'program-videos', false, 104857600, ARRAY['video/mp4', 'video/webm', 'video/quicktime', 'image/jpeg', 'image/png']),
  ('chat-attachments', 'chat-attachments', false, 52428800, ARRAY['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/webm'])
ON CONFLICT (id) DO UPDATE SET
  public = false,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

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

-- ============================================================================
-- SECTION 5: INITIAL CLINICAL CASELOAD & EXERCISE PROTOCOLS (IDEMPOTENT SEED)
-- ============================================================================

-- 1. Demo Patient Caseload (Required first for foreign key integrity)
INSERT INTO public.patients (
  id,
  name,
  age,
  gender,
  condition,
  email,
  caregiver_name,
  client_category,
  invitation_status,
  created_at,
  updated_at
) VALUES
  (
    '33333333-3333-4333-8333-333333333333',
    'Marcus Vance (Adult Rehab Demo)',
    58,
    'Male',
    'Right ischemic CVA with upper extremity hemiparesis',
    'marcus.vance.demo@aruga-health.local',
    'Eleanor Vance (Spouse)',
    'adult',
    'accepted',
    NOW() - INTERVAL '20 days',
    NOW()
  ),
  (
    '44444444-4444-4444-8444-444444444444',
    'Leo Chen (Pediatric Demo)',
    6,
    'Male',
    'Pediatric Bilateral Coordination Delay & Pincer Grasp Development',
    'leo.chen.demo@aruga-health.local',
    'Sarah Chen (Mother)',
    'pedia',
    'accepted',
    NOW() - INTERVAL '15 days',
    NOW()
  ),
  (
    '55555555-5555-4555-8555-555555555555',
    'Maya Lin (Adolescent Demo)',
    15,
    'Female',
    'Dynamic Tripod Grasp Fatigue & Academic Handwriting Posture',
    'maya.lin.demo@aruga-health.local',
    'David Lin (Father)',
    'adolescent',
    'accepted',
    NOW() - INTERVAL '10 days',
    NOW()
  )
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  condition = EXCLUDED.condition,
  client_category = EXCLUDED.client_category,
  updated_at = NOW();

-- 2. Clinical Home Programs
-- Adult Home Program 1
INSERT INTO public.home_programs (
  id, patient_id, title, main_instructions, status, assigned_at, created_at, updated_at
) VALUES (
  '11111111-1111-4111-8111-111111111111',
  '33333333-3333-4333-8333-333333333333',
  'Grip & Pinch Functional Re-education',
  'Perform 3 tabletop repetitions for each step. Ensure your elbow rests gently on the table and maintain neutral wrist alignment.',
  'assigned', NOW() - INTERVAL '2 days', NOW() - INTERVAL '3 days', NOW()
) ON CONFLICT (id) DO NOTHING;

-- Adult Home Program 2
INSERT INTO public.home_programs (
  id, patient_id, title, main_instructions, status, assigned_at, created_at, updated_at
) VALUES (
  '44444444-4444-4444-8444-444444444444',
  '33333333-3333-4333-8333-333333333333',
  'Tabletop Grasp & Precision Release Routine',
  'Perform these 3 coordinated tabletop exercises once daily in a seated position with good posture. Keep forearm supported and record a 10-20 second clip.',
  'assigned', NOW() - INTERVAL '5 days', NOW() - INTERVAL '6 days', NOW()
) ON CONFLICT (id) DO NOTHING;

-- Pediatric Home Program
INSERT INTO public.home_programs (
  id, patient_id, title, main_instructions, status, assigned_at, created_at, updated_at
) VALUES (
  '22222222-2222-4222-8222-222222222222',
  '44444444-4444-4444-8444-444444444444',
  'Playful Pincer Grasp & Bilateral Toy Routine',
  'Engage in 3 fun play exercises using dough, pegs, and toy containers. Support the childs posture and take breaks if hands fatigue.',
  'assigned', NOW() - INTERVAL '1 day', NOW() - INTERVAL '2 days', NOW()
) ON CONFLICT (id) DO NOTHING;

-- Adolescent Home Program
INSERT INTO public.home_programs (
  id, patient_id, title, main_instructions, status, assigned_at, created_at, updated_at
) VALUES (
  '33333333-4444-4333-8333-333333333333',
  '55555555-5555-4555-8555-555555555555',
  'School Ergonomics & Fine Motor Endurance',
  'Focus on dynamic tripod pencil grasp, keyboard positioning, and forearm stability for academic tasks.',
  'assigned', NOW(), NOW(), NOW()
) ON CONFLICT (id) DO NOTHING;

-- 3. Program Steps
INSERT INTO public.program_steps (id, program_id, position, title, instructions)
VALUES
  ('77777771-7777-4777-8777-777777777771', '11111111-1111-4111-8111-111111111111', 1, 'Cylinder Cup Grasp & Lift', 'Reach forward with an open hand, grasp the lightweight cup, lift 3 inches off the tabletop, hold for 3 seconds, and set down smoothly without tipping.'),
  ('77777772-7777-4777-8777-777777777772', '11111111-1111-4111-8111-111111111111', 2, 'Block Stacking Sequence', 'Pick up small 1-inch wooden blocks one at a time using your index finger and thumb (pincer grasp) and build a stable 3-block tower.'),
  ('77777773-7777-4777-8777-777777777773', '11111111-1111-4111-8111-111111111111', 3, 'Forearm Supination with Washcloth', 'Hold the folded washcloth flat on the tabletop. Slowly rotate your forearm so your palm faces upward, pausing 3 seconds before neutral.'),
  ('77777771-7777-4777-8777-777777777781', '44444444-4444-4444-8444-444444444444', 1, 'Cylindrical Cup Lift and Transfer', 'Place a lightweight plastic cup 6 inches in front of you. Reach forward using full active extension, grasp with all digits, lift 3 inches vertically, hold for 2 seconds, and place back down gently.'),
  ('77777772-7777-4777-8777-777777777782', '44444444-4444-4444-8444-444444444444', 2, 'Small Block Lateral Stacking', 'Pick up the wooden block using a three-jaw chuck. Move it across your midline to the target marker on your left, then release cleanly.'),
  ('77777773-7777-4777-8777-777777777783', '44444444-4444-4444-8444-444444444444', 3, 'Forearm Supination with Washcloth', 'Hold the folded washcloth flat on the tabletop. Slowly rotate your forearm so your palm faces fully upward, pausing for 3 seconds before returning to neutral.'),
  ('77777774-7777-4777-8777-777777777774', '22222222-2222-4222-8222-222222222222', 1, 'Peg Pick & Color Sort', 'Have the child pick up 5 large colorful pegs one by one using thumb and index finger tip-to-tip, placing them into corresponding slots.'),
  ('77777775-7777-4777-8777-777777777775', '22222222-2222-4222-8222-222222222222', 2, 'Clay Pinch & Squash', 'Roll 3 small balls of therapy putty. Ask the child to use thumb and pointer finger to pinch each into a pancake.'),
  ('77777776-7777-4777-8777-777777777776', '22222222-2222-4222-8222-222222222222', 3, 'Twist-Top Container', 'Hold a small plastic container steady with the non-dominant hand while unscrewing the lid using the dominant hand fingers.'),
  ('77777777-7777-4777-8777-777777777777', '33333333-4444-4333-8333-333333333333', 1, 'Tripod Grip Writing Drill', 'Complete 10 lines of continuous loop patterns on lined paper maintaining relaxed pencil pressure and open web space.'),
  ('77777778-7777-4777-8777-777777777778', '33333333-4444-4333-8333-333333333333', 2, 'Adaptive Scissors Precision Cut', 'Cut along complex geometric zig-zag paths using adaptive loop scissors, turning paper with non-dominant hand.'),
  ('77777779-7777-4777-8777-777777777779', '33333333-4444-4333-8333-333333333333', 3, 'Keyboard Ergonomic Posture', 'Type for 5 minutes with wrists neutral, elbows at 90 degrees, and periodic 30-second finger extensor stretches.')
ON CONFLICT (id) DO NOTHING;

-- 4. Initial Submissions & Step Submissions
INSERT INTO public.submissions (
  id, program_id, patient_id, state, consent_therapist, consent_meta_ai, submitted_at, created_at, updated_at
) VALUES (
  '55555555-5555-4555-8555-555555555555',
  '44444444-4444-4444-8444-444444444444',
  '33333333-3333-4333-8333-333333333333',
  'submitted', true, true, NOW() - INTERVAL '1 day', NOW() - INTERVAL '2 days', NOW() - INTERVAL '1 day'
) ON CONFLICT (id) DO NOTHING;

INSERT INTO public.step_submissions (
  id, submission_id, program_step_id, video_path, client_comment, skipped, skip_reason
) VALUES
  ('88888881-8888-4888-8888-888888888881', '55555555-5555-4555-8555-555555555555', '77777771-7777-4777-8777-777777777781', 'demo/cup_grasp_transfer.mp4', 'Felt smoother than last week! Finger extension still feels stiff right before touching the cup.', false, null),
  ('88888882-8888-4888-8888-888888888882', '55555555-5555-4555-8555-555555555555', '77777772-7777-4777-8777-777777777782', 'demo/block_stacking.mp4', 'Stacking was harder with the left hand, had to re-adjust grip twice.', false, null),
  ('88888883-8888-4888-8888-888888888883', '55555555-5555-4555-8555-555555555555', '77777773-7777-4777-8777-777777777783', null, null, true, 'Forearm felt fatigued from physical therapy session earlier in the day.')
ON CONFLICT (id) DO NOTHING;

-- 5. Submission Review & Step Review
INSERT INTO public.submission_reviews (
  id, submission_id, overall_feedback, status, created_at, updated_at
) VALUES (
  '66666666-6666-4666-8666-666666666666',
  '55555555-5555-4555-8555-555555555555',
  'Wonderful effort this week Marcus! Your digit extension trajectory is improving consistently. Keep monitoring forearm stability.',
  'draft', NOW() - INTERVAL '6 hours', NOW() - INTERVAL '6 hours'
) ON CONFLICT (id) DO NOTHING;

INSERT INTO public.step_reviews (
  id, review_id, step_submission_id, therapist_note
) VALUES (
  '99999991-9999-4999-8999-999999999991',
  '66666666-6666-4666-8666-666666666666',
  '88888881-8888-4888-8888-888888888881',
  'Notice how your thumb abducts smoothly at 0:04. Try to pause for an extra full second before the lift.'
) ON CONFLICT (id) DO NOTHING;

-- 6. Sample 1-on-1 Messages
INSERT INTO public.messages (id, patient_id, body, referenced_program_id, created_at)
VALUES
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '33333333-3333-4333-8333-333333333333', 'Hi Dr. Ramos, I completed my tabletop routine this morning. My wrist felt a lot more stable during the cup lift.', '44444444-4444-4444-8444-444444444444', NOW() - INTERVAL '1 day'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', '33333333-3333-4333-8333-333333333333', 'Great job Marcus! I reviewed your video. Your finger aperture was much cleaner today. Keep practicing step 1 daily.', '44444444-4444-4444-8444-444444444444', NOW() - INTERVAL '18 hours'),
  ('cccccccc-cccc-4ccc-8ccc-cccccccccccc', '44444444-4444-4444-8444-444444444444', 'Hello Dr. Ramos, Leo really enjoyed the putty exercises today! He managed to make 5 mini pancakes with his index finger.', '22222222-2222-4222-8222-222222222222', NOW() - INTERVAL '10 hours')
ON CONFLICT (id) DO NOTHING;

-- 7. SOAP Notes for Live Sessions
CREATE TABLE IF NOT EXISTS public.soap_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  therapist_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  session_date TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  session_title TEXT NOT NULL DEFAULT 'Live Therapy Session',
  session_recording_url TEXT,
  subjective TEXT NOT NULL DEFAULT '',
  objective TEXT NOT NULL DEFAULT '',
  assessment TEXT NOT NULL DEFAULT '',
  assessment_links JSONB DEFAULT '[]'::jsonb,
  plan TEXT NOT NULL DEFAULT '',
  client_summary TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_soap_notes_patient_id ON public.soap_notes(patient_id);
CREATE INDEX IF NOT EXISTS idx_soap_notes_session_date ON public.soap_notes(session_date DESC);
ALTER TABLE public.soap_notes ENABLE ROW LEVEL SECURITY;



-- ============================================================================
-- 8. GENERATED ACTIVITIES & WORKSHEETS (Muse Spark + Muse Image)
-- ============================================================================
-- ============================================================================
-- ARUGA SUPABASE SCRIPT 05: GENERATED ACTIVITIES & WORKSHEETS
-- Creates activity templates, generated activities, activity completions,
-- and extends program_steps to link generated content.
-- Safe for repeated runs.
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ----------------------------------------------------------------------------
-- 1. ACTIVITY TEMPLATES — system presets + therapist saved prompts
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.activity_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  therapist_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  owner_scope TEXT NOT NULL DEFAULT 'system' CHECK (owner_scope IN ('system','therapist')),
  title TEXT NOT NULL,
  description TEXT,
  age_band TEXT NOT NULL CHECK (age_band IN ('pedia','adolescent','adult','geriatric')),
  category TEXT NOT NULL CHECK (category IN ('coloring','handwriting','tracing','maze','matching','cognitive','adl_sim','visual_motor','fine_motor','other')),
  spark_prompt TEXT NOT NULL,
  image_prompt TEXT NOT NULL,
  default_params JSONB NOT NULL DEFAULT '{}'::jsonb,
  thumbnail_path TEXT,
  is_featured BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Self-heal category constraint for DBs where 05 was already applied without fine_motor
DO $$ BEGIN
  ALTER TABLE public.activity_templates DROP CONSTRAINT IF EXISTS activity_templates_category_check;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE public.activity_templates ADD CONSTRAINT activity_templates_category_check
    CHECK (category IN ('coloring','handwriting','tracing','maze','matching','cognitive','adl_sim','visual_motor','fine_motor','other'));
EXCEPTION WHEN duplicate_object THEN NULL;
  WHEN OTHERS THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_activity_templates_age_band ON public.activity_templates(age_band);
CREATE INDEX IF NOT EXISTS idx_activity_templates_category ON public.activity_templates(category);
CREATE INDEX IF NOT EXISTS idx_activity_templates_therapist ON public.activity_templates(therapist_id);
CREATE INDEX IF NOT EXISTS idx_activity_templates_owner_scope ON public.activity_templates(owner_scope);

-- ----------------------------------------------------------------------------
-- 2. GENERATED ACTIVITIES — worksheet artifacts (Muse Spark + Muse Image)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.generated_activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  patient_id UUID REFERENCES public.patients(id) ON DELETE SET NULL,
  template_id UUID REFERENCES public.activity_templates(id) ON DELETE SET NULL,
  age_band TEXT NOT NULL CHECK (age_band IN ('pedia','adolescent','adult','geriatric')),
  title TEXT NOT NULL,
  instructions TEXT NOT NULL,
  -- Inputs for reproducibility
  spark_prompt_used TEXT NOT NULL DEFAULT '',
  image_prompt_used TEXT NOT NULL DEFAULT '',
  reference_links TEXT[] NOT NULL DEFAULT '{}',
  reference_image_paths TEXT[] NOT NULL DEFAULT '{}',
  -- Outputs
  spark_spec JSONB,
  base_image_path TEXT,
  base_image_url TEXT,
  composed_pdf_path TEXT,
  model_ids JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'ready' CHECK (status IN ('generating','ready','failed')),
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_generated_activities_creator ON public.generated_activities(creator_id);
CREATE INDEX IF NOT EXISTS idx_generated_activities_patient ON public.generated_activities(patient_id);
CREATE INDEX IF NOT EXISTS idx_generated_activities_template ON public.generated_activities(template_id);
CREATE INDEX IF NOT EXISTS idx_generated_activities_age_band ON public.generated_activities(age_band);
CREATE INDEX IF NOT EXISTS idx_generated_activities_created ON public.generated_activities(created_at);

-- ----------------------------------------------------------------------------
-- 3. EXTEND program_steps — link to generated activity (nullable, backward compat)
-- ----------------------------------------------------------------------------
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema='public' AND table_name='program_steps' AND column_name='generated_activity_id'
  ) THEN
    ALTER TABLE public.program_steps ADD COLUMN generated_activity_id UUID REFERENCES public.generated_activities(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_program_steps_generated_activity ON public.program_steps(generated_activity_id);

-- ----------------------------------------------------------------------------
-- 4. ACTIVITY COMPLETIONS — client work product (canvas drawing or photo upload)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.activity_completions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  generated_activity_id UUID NOT NULL REFERENCES public.generated_activities(id) ON DELETE CASCADE,
  step_submission_id UUID REFERENCES public.step_submissions(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  client_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  -- Interactive canvas
  drawing_data_url TEXT,
  drawing_storage_path TEXT,
  drawing_strokes JSONB NOT NULL DEFAULT '[]'::jsonb,
  -- Photo fallback
  photo_upload_path TEXT,
  -- Metadata
  completion_method TEXT NOT NULL DEFAULT 'canvas' CHECK (completion_method IN ('canvas','photo','print_upload')),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_activity_completions_generated ON public.activity_completions(generated_activity_id);
CREATE INDEX IF NOT EXISTS idx_activity_completions_patient ON public.activity_completions(patient_id);
CREATE INDEX IF NOT EXISTS idx_activity_completions_step_sub ON public.activity_completions(step_submission_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_activity_completion_step_sub ON public.activity_completions(step_submission_id) WHERE step_submission_id IS NOT NULL;

-- ----------------------------------------------------------------------------
-- 5. TRIGGER updated_at for new tables
-- ----------------------------------------------------------------------------
DO $$
DECLARE
  tbl text;
BEGIN
  FOR tbl IN SELECT unnest(ARRAY['activity_templates','generated_activities','activity_completions'])
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trigger_updated_at_%I ON public.%I', tbl, tbl);
    EXECUTE format('CREATE TRIGGER trigger_updated_at_%I BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at()', tbl, tbl);
  END LOOP;
END $$;

-- ----------------------------------------------------------------------------
-- 6. ROW LEVEL SECURITY — restrictive
-- ----------------------------------------------------------------------------
ALTER TABLE public.activity_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.generated_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_completions ENABLE ROW LEVEL SECURITY;

-- Activity templates: system templates visible to all authed, therapist templates owner-only
DROP POLICY IF EXISTS "Authenticated view system templates" ON public.activity_templates;
CREATE POLICY "Authenticated view system templates" ON public.activity_templates FOR SELECT TO authenticated
  USING (owner_scope = 'system' OR therapist_id = auth.uid());

DROP POLICY IF EXISTS "Therapists manage own templates" ON public.activity_templates;
CREATE POLICY "Therapists manage own templates" ON public.activity_templates FOR ALL TO authenticated
  USING (therapist_id = auth.uid() OR owner_scope = 'system')
  WITH CHECK (
    (owner_scope = 'therapist' AND therapist_id = auth.uid()) OR owner_scope = 'system'
  );

-- Generated activities: therapist creators + assigned clients can view
DROP POLICY IF EXISTS "Therapists manage generated activities" ON public.generated_activities;
CREATE POLICY "Therapists manage generated activities" ON public.generated_activities FOR ALL TO authenticated
  USING (
    creator_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.patients WHERE id = generated_activities.patient_id AND client_user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.patients WHERE id = generated_activities.patient_id AND therapist_id = auth.uid())
  )
  WITH CHECK (creator_id = auth.uid());

DROP POLICY IF EXISTS "Clients view assigned generated activities" ON public.generated_activities;
CREATE POLICY "Clients view assigned generated activities" ON public.generated_activities FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.patients WHERE id = generated_activities.patient_id AND client_user_id = auth.uid())
    OR creator_id = auth.uid()
  );

-- Activity completions
DROP POLICY IF EXISTS "Therapists view completions" ON public.activity_completions;
CREATE POLICY "Therapists view completions" ON public.activity_completions FOR SELECT TO authenticated
  USING (
    public.therapist_owns_patient(patient_id) OR client_id = auth.uid()
  );

DROP POLICY IF EXISTS "Clients manage own completions" ON public.activity_completions;
CREATE POLICY "Clients manage own completions" ON public.activity_completions FOR ALL TO authenticated
  USING (client_id = auth.uid() OR public.therapist_owns_patient(patient_id))
  WITH CHECK (client_id = auth.uid());

-- ----------------------------------------------------------------------------
-- 7. STORAGE BUCKET for activity assets
-- ----------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'activity-assets',
  'activity-assets',
  false,
  20971520,
  ARRAY['image/png','image/jpeg','image/webp','image/svg+xml','application/pdf']
)
ON CONFLICT (id) DO UPDATE SET
  public = false,
  file_size_limit = 20971520,
  allowed_mime_types = ARRAY['image/png','image/jpeg','image/webp','image/svg+xml','application/pdf'];

DO $$ BEGIN
  DROP POLICY IF EXISTS "Authenticated view activity assets" ON storage.objects;
  CREATE POLICY "Authenticated view activity assets" ON storage.objects FOR SELECT TO authenticated
    USING (bucket_id = 'activity-assets');

  DROP POLICY IF EXISTS "Authenticated upload activity assets" ON storage.objects;
  CREATE POLICY "Authenticated upload activity assets" ON storage.objects FOR INSERT TO authenticated
    WITH CHECK (bucket_id = 'activity-assets');

  DROP POLICY IF EXISTS "Authenticated update activity assets" ON storage.objects;
  CREATE POLICY "Authenticated update activity assets" ON storage.objects FOR UPDATE TO authenticated
    USING (bucket_id = 'activity-assets')
    WITH CHECK (bucket_id = 'activity-assets');

  DROP POLICY IF EXISTS "Authenticated delete activity assets" ON storage.objects;
  CREATE POLICY "Authenticated delete activity assets" ON storage.objects FOR DELETE TO authenticated
    USING (bucket_id = 'activity-assets');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;


-- ============================================================================
-- ARUGA SUPABASE SCRIPT 06: SEED 20 ACTIVITY TEMPLATES (5 per age band)
-- Run AFTER 05_activity_worksheets.sql
-- Safe for repeated runs via ON CONFLICT + unique index on (owner_scope,title)
-- ============================================================================

CREATE UNIQUE INDEX IF NOT EXISTS uq_activity_template_system_title
  ON public.activity_templates(owner_scope, title) WHERE owner_scope = 'system';

-- Helper: delete then reinsert to keep seeds idempotent without ON CONFLICT gymnastics
DELETE FROM public.activity_templates WHERE owner_scope = 'system';

-- ----------------------------------------------------------------------------
-- PEDIA (2-12) — bold outlines, large zones, playful
-- ----------------------------------------------------------------------------
-- Efficient prompts: short, token-budget friendly (spark ≤250ch, image ≤160ch)
INSERT INTO public.activity_templates (owner_scope, title, description, age_band, category, spark_prompt, image_prompt, default_params, is_featured) VALUES
('system','Farm Friends Coloring','6 large farm animals with thick outlines to color — develops grasp + visual discrimination','pedia','coloring',
 'Pedia coloring 2–6y: 6 farm animals (cow,pig,chicken,horse,sheep,tractor) in 2×3 grid. Bold 4pt outlines, large open interiors, animal name below each in friendly lowercase. Minimal clutter, high contrast.',
 '6 farm animals line art, 2×3 grid, thick bold outlines, large open interiors, no shading, A4 portrait, white bg, child-friendly vector style',
 '{"difficulty":"easy","theme":"farm","orientation":"portrait","estimatedMinutes":15}'::jsonb, true),

('system','HWT Capitals A–H — Double Lines','Uppercase A–H on Handwriting Without Tears double-lines for pre-writing practice','pedia','handwriting',
 'Pedia handwriting 4–7y: Uppercase A–H on HWT double-lines (top+baseline, no middle dash). Per letter: 1 model + 4 faded trace + 3 blank slots. Wide spacing. Small icons A=Apple B=Ball.',
 'Uppercase A–H double-line ruled paper, model + faded trace + blank per row, wide spacing, A4 portrait, clean worksheet, small apple/ball icons',
 '{"difficulty":"guided","theme":"alphabet","lineStyle":"double-line","orientation":"portrait","estimatedMinutes":20}'::jsonb, true),

('system','Under the Sea Dot-to-Dot','Numbered 1-20 sea scene to connect, reveal and color — number sequencing + fine motor','pedia','tracing',
 'Pedia dot-to-dot 5–10y: 1–20 underwater revealing turtle+fish+starfish. Large dots 8pt, numbers 14pt bold. Instruction: "Connect 1–20, then color!"',
 'Dot-to-dot 1–20 sea turtle fish starfish, large dots+numbers, underwater line art, thick outlines, A4 portrait, child-friendly',
 '{"difficulty":"independent","theme":"ocean","orientation":"portrait","estimatedMinutes":15}'::jsonb, true),

('system','Shape Sort & Trace','Match and trace shapes to real-world objects — shape recognition + pincer grasp','pedia','visual_motor',
 'Pedia 3–6y: 4 shapes (circle,square,triangle,star) two columns. Left: dashed trace shapes (large). Right: apple/window/pizza/starfish to match. Dotted connector lines. Large targets.',
 '4 shapes dashed left column, real objects right column, thick dashed outlines, matching connectors, preschool style, A4 portrait',
 '{"difficulty":"guided","theme":"shapes","orientation":"portrait","estimatedMinutes":12}'::jsonb, false),

('system','My Family Portrait Frame','Decorative border to draw family inside — creativity + pencil control','pedia','coloring',
 'Pedia 3–8y: Simple frame border (hearts/stars) with empty interior. 3–4 light oval face guides inside + prompt "Draw your family!" Below: dotted name lines.',
 'Picture frame border hearts/stars, 3 face ovals inside, name lines dotted, A4 portrait, simple line art, child-friendly',
 '{"difficulty":"independent","theme":"family","orientation":"portrait","estimatedMinutes":20}'::jsonb, false);

-- ADOLESCENT (13-17) — efficient prompts
INSERT INTO public.activity_templates (owner_scope, title, description, age_band, category, spark_prompt, image_prompt, default_params, is_featured) VALUES
('system','Graffiti Alphabet — Bubble Letters','Hollow bubble letters A–Z to color and style — identity + letter formation','adolescent','handwriting',
 'Adolescent 13–17y: Bubble-letter A–Z, 2 rows/page, hollow thick outlines. School-appropriate street-art. Tip: "Add highlights/shadows/patterns!" Personalization.',
 'Bubble A–Z hollow thick outlines, 2 rows/page, street-art style, black line art, A4 portrait, modern teen',
 '{"difficulty":"independent","theme":"graffiti","lineStyle":"none","orientation":"portrait","estimatedMinutes":25}'::jsonb, true),

('system','Study Planner — Weekly Grid','Fillable weekly timetable for executive function and time management','adolescent','cognitive',
 'Adolescent 13–17y: Weekly timetable Mon–Sun × 7am–9pm blocks. Clean grid, shaded header, icons School/Homework/Free/Sleep. Color-code school blue, homework orange.',
 'Weekly timetable Mon–Sun × hourly rows 7am–9pm, shaded header, school icons, clean modern grid, A4 portrait, teen-friendly',
 '{"difficulty":"guided","theme":"planning","orientation":"portrait","estimatedMinutes":15}'::jsonb, true),

('system','Anatomy Color-by-Number: Hand','Numbered hand/bones diagram with legend — fine motor + anatomy learning','adolescent','visual_motor',
 'Adolescent: Simplified hand/wrist bones outline, sections 1–6 + color legend. "Color to reveal 27 bones!" Not gory, educational.',
 'Hand bones outline 6 numbered zones + legend, educational diagram, teen line art, A4 portrait, clean style',
 '{"difficulty":"guided","theme":"anatomy","orientation":"portrait","estimatedMinutes":20}'::jsonb, false),

('system','Maze Quest: Campus Map','School campus maze from Home to Classroom — visual scanning + problem solving','adolescent','visual_motor',
 'Adolescent 13–17y: Campus maze Home→Classroom, medium complexity, multiple dead ends, 3pt walls, start/end icons. Title "Find your way!"',
 'Campus maze Home to Classroom, medium complexity, 3pt walls, start/end icons, black lines A4 portrait, puzzle design',
 '{"difficulty":"independent","theme":"school","orientation":"portrait","estimatedMinutes":10}'::jsonb, false),

('system','Emotion Faces — Draw & Label','Draw expressions and coping actions for 6 emotions — socioemotional + fine motor','adolescent','cognitive',
 'Adolescent 13–17y: 6 blank ovals 2×3: Frustrated/Calm/Anxious/Confident/Bored/Excited. Under each: "Draw expression" + "My coping: ___" dotted.',
 '6 face ovals 2×3 labeled emotions, word bank + coping lines, teen design, A4 portrait, clean line art',
 '{"difficulty":"guided","theme":"emotions","orientation":"portrait","estimatedMinutes":15}'::jsonb, false);

-- ADULT (18-64) — efficient prompts
INSERT INTO public.activity_templates (owner_scope, title, description, age_band, category, spark_prompt, image_prompt, default_params, is_featured) VALUES
('system','Cursive Connect — Signature Practice','Signature line practice on ruled guides for return-to-work writing','adult','handwriting',
 'Adult: Signature practice on Seyes triple-lines. 6 rows: faded cursive exemplar left + dotted trace middle + blank right. Wide spacing. "Steady pace, light grip."',
 'Cursive signature triple-line paper, exemplar + trace + blank per row, 6 rows, professional handwriting, A4 portrait, clean formal',
 '{"difficulty":"guided","theme":"signature","lineStyle":"triple-line","orientation":"portrait","estimatedMinutes":15}'::jsonb, true),

('system','Kitchen Measures — Matching','Measurement conversions and recipe tracing — ADL + cognitive','adult','adl_sim',
 'Adult ADL: Kitchen measures match columns cups↔mL, tbsp/tsp with cup/spoon icons, dotted connectors. Bottom: 3-step recipe trace "Add 250mL water".',
 'Kitchen measures matching columns cups/mL/tbsp/tsp, utensil icons, dotted connectors, recipe trace bottom, A4 portrait, practical',
 '{"difficulty":"independent","theme":"kitchen","orientation":"portrait","estimatedMinutes":12}'::jsonb, true),

('system','Keyboard Finger Map — Trace','QWERTY finger paths for common words — fine motor + work readiness','adult','fine_motor',
 'Adult: QWERTY outline with finger trails for hello/work/email/please, arrows across keys. Task: trace paths then type. Landscape.',
 'QWERTY finger trails hello/work/email/please, arrows over keys, typing path diagram, A4 landscape, tech diagram',
 '{"difficulty":"guided","theme":"keyboard","orientation":"landscape","estimatedMinutes":10}'::jsonb, false),

('system','Geometric Patterns — Precision Tracing','Intricate tiling to trace for precision grip and control','adult','visual_motor',
 'Adult: Hexagonal/isometric tiling, medium density, trace inner lines for precision. "Slow, smooth strokes." Full A4.',
 'Geometric hex tiling, medium density line art, precision trace pattern, A4 portrait, thin lines, adult design',
 '{"difficulty":"independent","theme":"geometry","orientation":"portrait","estimatedMinutes":20}'::jsonb, false),

('system','Paycheck Budget Grid','Monthly income-expense table to fill — cognitive + ADL budgeting','adult','cognitive',
 'Adult: Monthly budget grid Rent/Groceries/Transport/Utilities/Savings/Fun × IN/OUT + Totals. Large cells, icons. "Does it balance?"',
 'Budget grid Rent/Groceries/Transport/Utilities/Savings/Fun × IN/OUT, large cells, icons house/cart/bus, finance table A4 portrait',
 '{"difficulty":"guided","theme":"budget","orientation":"portrait","estimatedMinutes":15}'::jsonb, false);

-- GERIATRIC (65+) — efficient prompts
INSERT INTO public.activity_templates (owner_scope, title, description, age_band, category, spark_prompt, image_prompt, default_params, is_featured) VALUES
('system','Large-Print Greetings — Trace & Write','Seasonal greetings in large trace + write — high contrast, low fatigue','geriatric','handwriting',
 'Geriatric 65+y: "Happy Birthday/Thank You/Thinking of You" 36pt faded trace on triple-lines, wide spacing. Per greeting: faded trace + dotted + blank. 14pt instructions, high contrast.',
 'Large-print greetings 36pt trace triple-line, Happy Birthday/Thank You, wide spacing, faded+dotted+blank, high contrast A4 portrait, senior-friendly',
 '{"difficulty":"guided","theme":"greetings","lineStyle":"triple-line","orientation":"portrait","estimatedMinutes":15}'::jsonb, true),

('system','Garden Flowers Coloring — Low Detail','Simple large flowers with wide gaps — calming, low visual demand','geriatric','coloring',
 'Geriatric 65+y: 3 large flowers (rose,sunflower,daisy) very simple, low detail, 15mm gaps, 2pt bold outlines, calming garden. 14pt "Color at your pace."',
 '3 large simple flowers rose/sunflower/daisy, wide gaps, low detail, 2pt bold, calming garden, A4 portrait, senior-friendly',
 '{"difficulty":"independent","theme":"garden","orientation":"portrait","estimatedMinutes":20}'::jsonb, true),

('system','Number Connect 1–40 — Cognitive','Large-number dot-to-dot revealing familiar object — number sequencing','geriatric','cognitive',
 'Geriatric 65+y: Dot-to-dot 1–40 reveal teapot/house/cat. Numbers 18pt bold, dots 10pt. Simple, low load. "Connect 1–40 to reveal." 14pt.',
 'Dot-to-dot 1–40 teapot/house/cat, 18pt numbers 10pt dots, large print, simple, A4 portrait, senior-friendly',
 '{"difficulty":"guided","theme":"numbers","orientation":"portrait","estimatedMinutes":15}'::jsonb, false),

('system','Medication Schedule — Fill & Check','7-day pill tracker with large checkboxes — medication ADL','geriatric','adl_sim',
 'Geriatric 65+y: 7-day tracker Mon–Sun × Morning/Noon/Evening/Bedtime, large cells, 8mm checkboxes, pill icons, "My Medicines:" lines. Landscape, high contrast.',
 '7-day pill tracker Mon–Sun × 4 time columns, large cells 8mm checkboxes, pill icons, medicine lines, high contrast A4 landscape',
 '{"difficulty":"guided","theme":"medication","orientation":"landscape","estimatedMinutes":10}'::jsonb, true),

('system','Reminisce Frame — Draw Your Home','Memory drawing prompt with cue icons — reminiscence + creativity','geriatric','cognitive',
 'Geriatric 65+y: "Draw childhood kitchen" frame border, large empty interior + faint cues (stove,table,window,kettle). Below: "My kitchen had ___" prompts.',
 'Kitchen memory frame border, empty interior + stove/table/window/kettle cues, writing prompts, A4 portrait, warm nostalgia, senior',
 '{"difficulty":"independent","theme":"memory","orientation":"portrait","estimatedMinutes":25}'::jsonb, false);

-- ============================================================================
-- WRITTEN WORKSHEETS: not always drawing — can be a step-by-step guide to follow
-- (mirrors supabase/migrations/20261102000004_worksheet_kinds.sql)
-- ============================================================================
ALTER TABLE public.activity_templates ADD COLUMN IF NOT EXISTS worksheet_kind TEXT NOT NULL DEFAULT 'drawable' CHECK (worksheet_kind IN ('drawable','written','mixed'));
ALTER TABLE public.generated_activities ADD COLUMN IF NOT EXISTS worksheet_kind TEXT NOT NULL DEFAULT 'drawable' CHECK (worksheet_kind IN ('drawable','written','mixed'));
ALTER TABLE public.generated_activities ADD COLUMN IF NOT EXISTS written_tasks JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE public.activity_completions ADD COLUMN IF NOT EXISTS text_response TEXT;
ALTER TABLE public.activity_completions ADD COLUMN IF NOT EXISTS checklist_state JSONB NOT NULL DEFAULT '[]'::jsonb;
DO $$ BEGIN ALTER TABLE public.activity_completions DROP CONSTRAINT IF EXISTS activity_completions_completion_method_check; EXCEPTION WHEN OTHERS THEN NULL; END $$;
ALTER TABLE public.activity_completions ADD CONSTRAINT activity_completions_completion_method_check CHECK (completion_method IN ('canvas','photo','print_upload','text','checklist','mixed'));

-- Written guide seeds — mixed across age bands to prove both kinds exist
INSERT INTO public.activity_templates (owner_scope, title, description, age_band, category, spark_prompt, image_prompt, default_params, worksheet_kind, is_featured) VALUES
('system','Morning Routine — Step-by-Step Guide','Follow the morning routine in order — check off each step','adult','adl_sim',
 'Adult ADL written guide: Morning routine 7 steps (sit up, sip water, ankle pumps 10×, stand at rail, brush teeth seated, shirt on, walk to chair). Each with large checkbox, clock icon, one-line tip. Clean checklist layout.',
 'Morning routine 7-step checklist, large checkboxes, clock icons, clean list layout, A4 portrait, adult ADL, high contrast',
 '{"difficulty":"guided","estimatedMinutes":10,"worksheet_kind":"written"}'::jsonb,'written', false),
('system','Kitchen Safety Checklist — Do & Check','Before cooking, check each safety item','adult','adl_sim',
 'Adult written guide 5–6 checks: stove off→on, hair tied, knife grip, hot pad ready, water nearby. Numbered, checkbox per item, "Stop if unsure" warning. Practical.',
 'Kitchen safety checklist 6 items, large checkboxes, knife/pot icons, warning footer, A4 portrait, practical style',
 '{"difficulty":"guided","estimatedMinutes":8,"worksheet_kind":"written"}'::jsonb,'written', false),
('system','Home Program Follow-Along — What to Do Today','Today''s 5 exercises with reps, rest, and "How did it feel?" write-in','geriatric','adl_sim',
 'Geriatric written guide 65+y: 5 exercises (marching, heel raises, seated trunk twist, grip squeezes, deep breaths) — per row: name, reps/time, rest 30s, checkbox Done + "How felt: ___". Large 14pt, landscape.',
 '5-exercise guide rows with reps/rest/checkbox + How felt line, large 14pt, senior landscape checklist',
 '{"difficulty":"guided","estimatedMinutes":15,"orientation":"landscape","worksheet_kind":"written"}'::jsonb,'written', false),
('system','Speech Practice — Say & Check','Say each word 3×, then check "Clear / Needed help"','pedia','cognitive',
 'Pedia speech written guide 3–8y: 6 words (apple, banana, cup, help, more, thank you) with picture cues. Per word: Say 3× → check Clear/Needed help. Caregiver tip footer.',
 '6 words with picture cues, Say 3× + Clear/Needed help checkboxes, child-friendly, A4 portrait',
 '{"difficulty":"guided","estimatedMinutes":12,"worksheet_kind":"written"}'::jsonb,'written', false)
ON CONFLICT DO NOTHING;

-- ============================================================================
-- AGENT TABLES: highlights, goal_reviews, goals, biomech_jobs, agent_runs
-- (mirrors supabase/migrations/20261102000003_agent_tables.sql for fresh installs)
-- Highlights are saved in DB when generated (POST /api/agent/highlights/run persists draft)
-- ============================================================================
create table if not exists highlights (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references patients(id) on delete cascade,
  month text not null,
  highlights jsonb not null,
  summary jsonb not null default '{}'::jsonb,
  prior_compare jsonb,
  trace jsonb not null default '[]'::jsonb,
  status text not null check (status in ('draft','published')) default 'draft',
  model_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(patient_id, month)
);
create index if not exists idx_highlights_patient_month on highlights(patient_id, month);
create table if not exists goal_reviews (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references patients(id) on delete cascade,
  therapist_id uuid references profiles(id) on delete set null,
  verdicts jsonb not null,
  summary jsonb not null,
  suggestions jsonb not null default '[]'::jsonb,
  trace jsonb not null default '[]'::jsonb,
  warnings jsonb not null default '[]'::jsonb,
  counts jsonb,
  status text not null check (status in ('draft','published')) default 'draft',
  model_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_goal_reviews_patient on goal_reviews(patient_id, created_at desc);
create table if not exists goals (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references patients(id) on delete cascade,
  therapist_id uuid not null references profiles(id) on delete cascade,
  text text not null,
  domain text not null check (domain in ('ue_rom','hand','gait','tug','trunk','adl','neck','soap_coherence')),
  goal_type text not null check (goal_type in ('stg','ltg')),
  target_value text, baseline text, deadline date,
  status text not null default 'active' check (status in ('active','achieved','discontinued')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists biomech_jobs (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references submissions(id) on delete cascade,
  step_submission_id uuid not null references step_submissions(id) on delete cascade,
  intent text not null,
  concepts text[] not null,
  status text not null check (status in ('queued','processing','completed','failed')) default 'queued',
  modal_job_id text, mhr_result jsonb, timing_ms int, error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists agent_runs (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid references patients(id) on delete cascade,
  submission_id uuid references submissions(id) on delete cascade,
  intent text not null, concepts text[],
  trace jsonb not null default '[]'::jsonb,
  status text not null default 'completed' check (status in ('queued','processing','completed','failed')),
  model_id text, created_at timestamptz not null default now()
);
do $$ begin
  alter table public.ai_analyses add column if not exists mhr_results jsonb;
  alter table public.ai_analyses add column if not exists biomech_summary jsonb;
exception when others then null; end $$;
alter table public.highlights enable row level security;
alter table public.goal_reviews enable row level security;
alter table public.goals enable row level security;
alter table public.biomech_jobs enable row level security;
alter table public.agent_runs enable row level security;
drop policy if exists "Therapists manage highlights" on public.highlights;
create policy "Therapists manage highlights" on public.highlights for all to authenticated
  using (therapist_owns_patient(patient_id) or exists (select 1 from patients p where p.id = highlights.patient_id and p.client_user_id = auth.uid()))
  with check (therapist_owns_patient(patient_id));
drop policy if exists "Therapists manage goal_reviews" on public.goal_reviews;
create policy "Therapists manage goal_reviews" on public.goal_reviews for all to authenticated
  using (therapist_owns_patient(patient_id) or exists (select 1 from patients p where p.id = goal_reviews.patient_id and p.client_user_id = auth.uid()))
  with check (therapist_owns_patient(patient_id));
drop policy if exists "Therapists manage goals" on public.goals;
create policy "Therapists manage goals" on public.goals for all to authenticated using (therapist_owns_patient(patient_id)) with check (therapist_owns_patient(patient_id));
drop policy if exists "Therapists manage biomech_jobs" on public.biomech_jobs;
create policy "Therapists manage biomech_jobs" on public.biomech_jobs for all to authenticated using (exists (select 1 from submissions s where s.id = biomech_jobs.submission_id and therapist_owns_patient(s.patient_id)));
drop policy if exists "Therapists manage agent_runs" on public.agent_runs;
create policy "Therapists manage agent_runs" on public.agent_runs for all to authenticated using (patient_id is null or therapist_owns_patient(patient_id) or exists (select 1 from patients p where p.id = agent_runs.patient_id and p.client_user_id = auth.uid()));
do $$ declare t text; begin for t in select unnest(array['highlights','goal_reviews','goals','biomech_jobs']) loop execute format('drop trigger if exists trigger_updated_at_%I on public.%I', t, t); execute format('create trigger trigger_updated_at_%I before update on public.%I for each row execute function public.handle_updated_at()', t, t); end loop; end $$;

-- Message read states for unread badge per thread
create table if not exists public.message_read_states (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  last_read_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint uq_message_read_patient_user unique (patient_id, user_id)
);
create index if not exists idx_message_read_states_patient on public.message_read_states(patient_id);
create index if not exists idx_message_read_states_user on public.message_read_states(user_id);
alter table public.message_read_states enable row level security;
drop policy if exists "Users manage own message read states" on public.message_read_states;
create policy "Users manage own message read states" on public.message_read_states for all using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "Therapists view read states for own patients" on public.message_read_states;
create policy "Therapists view read states for own patients" on public.message_read_states for select using (exists (select 1 from public.patients p where p.id = message_read_states.patient_id and p.therapist_id = auth.uid()));

