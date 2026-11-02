-- ============================================================================
-- ARUGA SUPABASE SCRIPT 05: GENERATED ACTIVITIES & WORKSHEETS
-- Creates activity templates, generated activities, activity completions,
-- and extends program_steps to link generated content.
-- Safe for repeated runs.
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Ensure helper exists even if 01_schema.sql hasn't been applied yet
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS trigger AS $$
BEGIN
  new.updated_at = NOW();
  RETURN new;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.therapist_owns_patient(p_patient_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (SELECT 1 FROM public.patients WHERE id = p_patient_id AND therapist_id = auth.uid());
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

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
  worksheet_kind TEXT NOT NULL DEFAULT 'drawable' CHECK (worksheet_kind IN ('drawable','written','mixed')),
  written_tasks JSONB NOT NULL DEFAULT '[]'::jsonb,
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
  -- Written guide completion (text/checklist) — not always drawing
  text_response TEXT,
  checklist_state JSONB NOT NULL DEFAULT '[]'::jsonb,
  -- Metadata
  completion_method TEXT NOT NULL DEFAULT 'canvas' CHECK (completion_method IN ('canvas','photo','print_upload','text','checklist','mixed')),
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
