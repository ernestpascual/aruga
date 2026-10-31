-- RUN_ONCE_PRIVACY_FIX_C3_DROP_OPEN_POLICIES.sql
-- Drop permissive "Allow all" policies that expose ePHI (qual=true) and restore restrictive policies from 01_schema.sql
-- Run ONCE in Supabase SQL Editor after RUN_ONCE_PRIVACY_FIX.sql

-- 1. Drop open policies (3 per table) — from your verify output
DO $$ BEGIN
  DROP POLICY IF EXISTS "Allow all for authenticated users" ON public.profiles;
  DROP POLICY IF EXISTS "Allow all for service role" ON public.profiles;
  DROP POLICY IF EXISTS "Allow public read" ON public.profiles;
  DROP POLICY IF EXISTS "Allow all for authenticated users" ON public.patients;
  DROP POLICY IF EXISTS "Allow all for service role" ON public.patients;
  DROP POLICY IF EXISTS "Allow public read" ON public.patients;
  DROP POLICY IF EXISTS "Allow all for authenticated users" ON public.home_programs;
  DROP POLICY IF EXISTS "Allow all for service role" ON public.home_programs;
  DROP POLICY IF EXISTS "Allow public read" ON public.home_programs;
  DROP POLICY IF EXISTS "Allow all for authenticated users" ON public.program_steps;
  DROP POLICY IF EXISTS "Allow all for service role" ON public.program_steps;
  DROP POLICY IF EXISTS "Allow public read" ON public.program_steps;
  DROP POLICY IF EXISTS "Allow all for authenticated users" ON public.submissions;
  DROP POLICY IF EXISTS "Allow all for service role" ON public.submissions;
  DROP POLICY IF EXISTS "Allow public read" ON public.submissions;
  DROP POLICY IF EXISTS "Allow all for authenticated users" ON public.step_submissions;
  DROP POLICY IF EXISTS "Allow all for service role" ON public.step_submissions;
  DROP POLICY IF EXISTS "Allow public read" ON public.step_submissions;
  DROP POLICY IF EXISTS "Allow all for authenticated users" ON public.submission_reviews;
  DROP POLICY IF EXISTS "Allow all for service role" ON public.submission_reviews;
  DROP POLICY IF EXISTS "Allow public read" ON public.submission_reviews;
  DROP POLICY IF EXISTS "Allow all for authenticated users" ON public.step_reviews;
  DROP POLICY IF EXISTS "Allow all for service role" ON public.step_reviews;
  DROP POLICY IF EXISTS "Allow public read" ON public.step_reviews;
  DROP POLICY IF EXISTS "Allow all for authenticated users" ON public.ai_analyses;
  DROP POLICY IF EXISTS "Allow all for service role" ON public.ai_analyses;
  DROP POLICY IF EXISTS "Allow public read" ON public.ai_analyses;
  DROP POLICY IF EXISTS "Allow all for authenticated users" ON public.audit_events;
  DROP POLICY IF EXISTS "Allow all for service role" ON public.audit_events;
  DROP POLICY IF EXISTS "Allow public read" ON public.audit_events;
  DROP POLICY IF EXISTS "Allow all for authenticated users" ON public.messages;
  DROP POLICY IF EXISTS "Allow all for service role" ON public.messages;
  DROP POLICY IF EXISTS "Allow public read" ON public.messages;
  DROP POLICY IF EXISTS "Allow all for authenticated users" ON public.sam_test_results;
  DROP POLICY IF EXISTS "Allow all for service role" ON public.sam_test_results;
  DROP POLICY IF EXISTS "Allow public read" ON public.sam_test_results;
  DROP POLICY IF EXISTS "Allow all for authenticated users" ON public.ot_conversations;
  DROP POLICY IF EXISTS "Allow all for service role" ON public.ot_conversations;
  DROP POLICY IF EXISTS "Allow public read" ON public.ot_conversations;
  DROP POLICY IF EXISTS "Allow all for authenticated users" ON public.ot_messages;
  DROP POLICY IF EXISTS "Allow all for service role" ON public.ot_messages;
  DROP POLICY IF EXISTS "Allow public read" ON public.ot_messages;
EXCEPTION WHEN OTHERS THEN NULL; END $$;

-- 2. Re-apply restrictive policies from 01_schema.sql:321/328/393 (idempotent CREATE POLICY with DROP IF EXISTS above)
-- Patients
DROP POLICY IF EXISTS "Therapists manage own patients" ON public.patients;
CREATE POLICY "Therapists manage own patients" ON public.patients FOR ALL USING (therapist_id = auth.uid()) WITH CHECK (therapist_id = auth.uid());
DROP POLICY IF EXISTS "Clients view own patient record" ON public.patients;
CREATE POLICY "Clients view own patient record" ON public.patients FOR SELECT USING (client_user_id = auth.uid());

-- Messages (already in RUN_ONCE but re-assert)
DROP POLICY IF EXISTS "Therapists view and send thread messages" ON public.messages;
CREATE POLICY "Therapists view and send thread messages" ON public.messages FOR ALL USING (public.therapist_owns_patient(patient_id)) WITH CHECK (public.therapist_owns_patient(patient_id) AND sender_id = auth.uid());
DROP POLICY IF EXISTS "Clients view and send thread messages" ON public.messages;
CREATE POLICY "Clients view and send thread messages" ON public.messages FOR ALL USING (EXISTS (SELECT 1 FROM public.patients WHERE id = messages.patient_id AND client_user_id = auth.uid())) WITH CHECK (EXISTS (SELECT 1 FROM public.patients WHERE id = messages.patient_id AND client_user_id = auth.uid()) AND sender_id = auth.uid());

-- Re-run 01_schema.sql:328-402 block via copy-paste if submissions/home_programs still missing restrictive policies (verify output should then show only restrictive qual, not true)
