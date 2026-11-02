-- ============================================================================
-- ARUGA SUPABASE MASTER SCHEMA
-- See all_in_one_setup.sql for the complete all-in-one setup.
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. Profiles Table
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('therapist', 'client')),
  display_name TEXT NOT NULL,
  email TEXT,
  discipline TEXT CHECK (discipline IN ('SLP', 'OT', 'PT') OR discipline IS NULL),
  client_category TEXT CHECK (client_category IN ('adult', 'adolescent', 'pedia', 'old_people') OR client_category IS NULL),
  license_number TEXT,
  facility_name TEXT,
  specialties TEXT,
  phone TEXT,
  office_hours TEXT,
  caseload_focus TEXT,
  bio TEXT,
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

-- 2. Patients Table
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
  invitation_initiated_by TEXT DEFAULT 'therapist',
  invitation_sent_at TIMESTAMPTZ DEFAULT NOW(),
  previous_therapist_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  pending_therapist_email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_patients_therapist ON public.patients(therapist_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_patients_client_user_idx ON public.patients(client_user_id) WHERE client_user_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_patients_email_idx ON public.patients(email);

-- Care Guide — per-patient general guidelines (big textarea, therapist-editable, client read-only)
ALTER TABLE public.patients ADD COLUMN IF NOT EXISTS care_guide TEXT NOT NULL DEFAULT '';

-- 3. Home Programs & Program Steps
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

-- 4. Submissions & Step Reviews
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
