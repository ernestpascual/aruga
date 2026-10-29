-- ============================================================================
-- ARUGA SUPABASE SCRIPT 02: TRIGGERS & RPC FUNCTIONS (ANTI-DUPLICATION)
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. AUTOMATIC UPDATED_AT TIMESTAMP FUNCTION
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS trigger AS $$
BEGIN
  new.updated_at = NOW();
  RETURN new;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at triggers
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

-- ----------------------------------------------------------------------------
-- 2. AUTH USER REGISTRATION TRIGGER (ANTI-DUPLICATION)
-- Ensures duplicate signups never violate unique profile ID or patient email constraints.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
DECLARE
  v_role TEXT;
  v_name TEXT;
  v_category TEXT;
BEGIN
  v_role := COALESCE(new.raw_user_meta_data->>'role', 'client');
  v_name := COALESCE(
    new.raw_user_meta_data->>'name',
    new.raw_user_meta_data->>'display_name',
    split_part(new.email, '@', 1)
  );
  v_category := new.raw_user_meta_data->>'client_category';

  -- 1. Upsert Profile (Prevents duplicate profiles by user ID)
  INSERT INTO public.profiles (
    id,
    display_name,
    role,
    client_category,
    created_at,
    updated_at
  ) VALUES (
    new.id,
    v_name,
    v_role,
    v_category,
    NOW(),
    NOW()
  )
  ON CONFLICT (id) DO UPDATE SET
    display_name = COALESCE(EXCLUDED.display_name, public.profiles.display_name),
    role = COALESCE(EXCLUDED.role, public.profiles.role),
    client_category = COALESCE(EXCLUDED.client_category, public.profiles.client_category),
    updated_at = NOW();

  -- 2. If user is a Client, ensure Patient record is linked without duplication
  IF (v_role = 'client') THEN
    INSERT INTO public.patients (
      client_user_id,
      name,
      email,
      client_category,
      condition,
      invitation_status,
      created_at,
      updated_at
    ) VALUES (
      new.id,
      v_name,
      LOWER(TRIM(new.email)),
      v_category,
      'Personalized Rehabilitation Care',
      'accepted',
      NOW(),
      NOW()
    )
    ON CONFLICT (email) DO UPDATE SET
      client_user_id = EXCLUDED.client_user_id,
      client_category = COALESCE(EXCLUDED.client_category, public.patients.client_category),
      name = COALESCE(EXCLUDED.name, public.patients.name),
      updated_at = NOW();
  END IF;

  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ----------------------------------------------------------------------------
-- 3. DEDUPLICATED MESSAGE SENDER FUNCTION (RPC)
-- Prevents accidental double-sends within a 3-second window
-- ----------------------------------------------------------------------------
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
  -- Check for duplicate identical message within 3 seconds
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

-- ----------------------------------------------------------------------------
-- 4. DEDUPLICATED ASK OT MESSAGE SENDER (RPC)
-- Prevents duplicate messages in Ask OT within a 2-second window
-- ----------------------------------------------------------------------------
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

-- ----------------------------------------------------------------------------
-- 5. DEDUPLICATED SAM TEST RESULT RECORDER (RPC)
-- Prevents identical SAM tests from recording duplicate rows within 5 seconds
-- ----------------------------------------------------------------------------
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
