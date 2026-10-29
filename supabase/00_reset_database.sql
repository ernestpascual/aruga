-- ============================================================================
-- ARUGA SUPABASE SCRIPT 00: RESET / TEARDOWN SCRIPT
-- CAUTION: Drops all public Aruga application tables, triggers, and functions.
-- Use this ONLY if you wish to start from a clean slate before running setup.
-- ============================================================================

-- 1. Drop triggers on auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;

-- 2. Drop RPC helper functions
DROP FUNCTION IF EXISTS public.send_chat_message_deduped(UUID, UUID, TEXT, UUID) CASCADE;
DROP FUNCTION IF EXISTS public.send_ot_message_deduped(UUID, TEXT, TEXT, JSONB, JSONB) CASCADE;
DROP FUNCTION IF EXISTS public.save_sam_result_deduped(UUID, TEXT, TEXT, NUMERIC, JSONB, JSONB, JSONB, JSONB, INTEGER, TEXT, INTEGER) CASCADE;
DROP FUNCTION IF EXISTS public.create_home_program_deduped(UUID, UUID, TEXT, TEXT, TEXT) CASCADE;
DROP FUNCTION IF EXISTS public.handle_updated_at() CASCADE;

-- 3. Drop all application tables in reverse dependency order
DROP TABLE IF EXISTS public.audit_events CASCADE;
DROP TABLE IF EXISTS public.ai_analyses CASCADE;
DROP TABLE IF EXISTS public.step_reviews CASCADE;
DROP TABLE IF EXISTS public.submission_reviews CASCADE;
DROP TABLE IF EXISTS public.step_submissions CASCADE;
DROP TABLE IF EXISTS public.submissions CASCADE;
DROP TABLE IF EXISTS public.program_steps CASCADE;
DROP TABLE IF EXISTS public.home_programs CASCADE;
DROP TABLE IF EXISTS public.messages CASCADE;
DROP TABLE IF EXISTS public.sam_test_results CASCADE;
DROP TABLE IF EXISTS public.ot_messages CASCADE;
DROP TABLE IF EXISTS public.ot_conversations CASCADE;
DROP TABLE IF EXISTS public.patients CASCADE;
DROP TABLE IF EXISTS public.profiles CASCADE;

-- Note: storage.buckets 'program-videos' and 'chat-attachments' are preserved.
