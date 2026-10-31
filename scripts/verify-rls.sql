-- scripts/verify-rls.sql
-- C3 RLS fallback audit: run in Supabase SQL Editor or CI to ensure no permissive "true" policies leak ePHI
-- 1. List all policies for public schema
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

-- 2. Flag any permissive USING (true) or WITH CHECK (true) that would allow anon exfil
SELECT schemaname, tablename, policyname, cmd, qual
FROM pg_policies
WHERE schemaname = 'public'
  AND (qual = 'true' OR qual ILIKE '%USING (true)%' OR with_check = 'true');

-- 3. Ensure RLS is enabled on ePHI tables
SELECT relname AS table, relrowsecurity AS rls_enabled, relforcerowsecurity AS rls_forced
FROM pg_class
WHERE relnamespace = 'public'::regnamespace
  AND relname IN ('patients','submissions','step_submissions','messages','soap_notes','home_programs','program_steps','generated_activities','activity_completions','submission_reviews','audit_events')
ORDER BY relname;

-- 4. Verify therapist_owns_patient helper exists
SELECT proname, proargtypes::regtype[] FROM pg_proc WHERE proname = 'therapist_owns_patient';

-- 5. Check storage buckets are private (not public)
SELECT id, name, public, file_size_limit FROM storage.buckets WHERE id IN ('program-videos','chat-attachments','activity-assets');
