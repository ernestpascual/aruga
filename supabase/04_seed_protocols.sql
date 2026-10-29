-- ============================================================================
-- ARUGA SUPABASE SCRIPT 04: INITIAL CLINICAL SEED FIXTURES
-- Fully Idempotent: Uses fixed deterministic UUIDs and ON CONFLICT DO NOTHING.
-- Inserts in strict relational dependency order:
-- 1. Demo Patients -> 2. Home Programs -> 3. Steps -> 4. Submissions ->
-- 5. Step Submissions -> 6. Reviews -> 7. Step Reviews -> 8. Messages
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. DEMO PATIENT CASELOAD RECORDS (Required for FK references)
-- ----------------------------------------------------------------------------
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

-- ----------------------------------------------------------------------------
-- 2. CLINICAL HOME PROGRAMS
-- ----------------------------------------------------------------------------
-- Adult Protocol 1
INSERT INTO public.home_programs (
  id,
  patient_id,
  title,
  main_instructions,
  status,
  assigned_at,
  created_at,
  updated_at
) VALUES (
  '11111111-1111-4111-8111-111111111111',
  '33333333-3333-4333-8333-333333333333',
  'Grip & Pinch Functional Re-education',
  'Perform 3 tabletop repetitions for each step. Ensure your elbow rests gently on the table and maintain neutral wrist alignment.',
  'assigned',
  NOW() - INTERVAL '2 days',
  NOW() - INTERVAL '3 days',
  NOW()
) ON CONFLICT (id) DO NOTHING;

-- Adult Protocol 2 (Tabletop Grasp Routine)
INSERT INTO public.home_programs (
  id,
  patient_id,
  title,
  main_instructions,
  status,
  assigned_at,
  created_at,
  updated_at
) VALUES (
  '44444444-4444-4444-8444-444444444444',
  '33333333-3333-4333-8333-333333333333',
  'Tabletop Grasp & Precision Release Routine',
  'Perform these 3 coordinated tabletop exercises once daily in a seated position with good posture. Keep forearm supported and record a 10-20 second clip.',
  'assigned',
  NOW() - INTERVAL '5 days',
  NOW() - INTERVAL '6 days',
  NOW()
) ON CONFLICT (id) DO NOTHING;

-- Pediatric Protocol
INSERT INTO public.home_programs (
  id,
  patient_id,
  title,
  main_instructions,
  status,
  assigned_at,
  created_at,
  updated_at
) VALUES (
  '22222222-2222-4222-8222-222222222222',
  '44444444-4444-4444-8444-444444444444',
  'Playful Pincer Grasp & Bilateral Toy Routine',
  'Engage in 3 fun play exercises using dough, pegs, and toy containers. Support the childs posture and take breaks if hands fatigue.',
  'assigned',
  NOW() - INTERVAL '1 day',
  NOW() - INTERVAL '2 days',
  NOW()
) ON CONFLICT (id) DO NOTHING;

-- Adolescent Protocol
INSERT INTO public.home_programs (
  id,
  patient_id,
  title,
  main_instructions,
  status,
  assigned_at,
  created_at,
  updated_at
) VALUES (
  '33333333-4444-4333-8333-333333333333',
  '55555555-5555-4555-8555-555555555555',
  'School Ergonomics & Fine Motor Endurance',
  'Focus on dynamic tripod pencil grasp, keyboard positioning, and forearm stability for academic tasks.',
  'assigned',
  NOW(),
  NOW(),
  NOW()
) ON CONFLICT (id) DO NOTHING;

-- ----------------------------------------------------------------------------
-- 3. PROGRAM STEPS
-- ----------------------------------------------------------------------------
-- Steps for Adult Protocol 1
INSERT INTO public.program_steps (id, program_id, position, title, instructions)
VALUES
  ('77777771-7777-4777-8777-777777777771', '11111111-1111-4111-8111-111111111111', 1, 'Cylinder Cup Grasp & Lift', 'Reach forward with an open hand, grasp the lightweight cup, lift 3 inches off the tabletop, hold for 3 seconds, and set down smoothly without tipping.'),
  ('77777772-7777-4777-8777-777777777772', '11111111-1111-4111-8111-111111111111', 2, 'Block Stacking Sequence', 'Pick up small 1-inch wooden blocks one at a time using your index finger and thumb (pincer grasp) and build a stable 3-block tower.'),
  ('77777773-7777-4777-8777-777777777773', '11111111-1111-4111-8111-111111111111', 3, 'Forearm Supination with Washcloth', 'Hold the folded washcloth flat on the tabletop. Slowly rotate your forearm so your palm faces upward, pausing 3 seconds before neutral.')
ON CONFLICT (id) DO NOTHING;

-- Steps for Adult Protocol 2
INSERT INTO public.program_steps (id, program_id, position, title, instructions)
VALUES
  ('77777771-7777-4777-8777-777777777781', '44444444-4444-4444-8444-444444444444', 1, 'Cylindrical Cup Lift and Transfer', 'Place a lightweight plastic cup 6 inches in front of you. Reach forward using full active extension, grasp with all digits, lift 3 inches vertically, hold for 2 seconds, and place back down gently.'),
  ('77777772-7777-4777-8777-777777777782', '44444444-4444-4444-8444-444444444444', 2, 'Small Block Lateral Stacking', 'Pick up the wooden block using a three-jaw chuck. Move it across your midline to the target marker on your left, then release cleanly.'),
  ('77777773-7777-4777-8777-777777777783', '44444444-4444-4444-8444-444444444444', 3, 'Forearm Supination with Washcloth', 'Hold the folded washcloth flat on the tabletop. Slowly rotate your forearm so your palm faces fully upward, pausing for 3 seconds before returning to neutral.')
ON CONFLICT (id) DO NOTHING;

-- Steps for Pediatric Protocol
INSERT INTO public.program_steps (id, program_id, position, title, instructions)
VALUES
  ('77777774-7777-4777-8777-777777777774', '22222222-2222-4222-8222-222222222222', 1, 'Peg Pick & Color Sort', 'Have the child pick up 5 large colorful pegs one by one using thumb and index finger tip-to-tip, placing them into corresponding slots.'),
  ('77777775-7777-4777-8777-777777777775', '22222222-2222-4222-8222-222222222222', 2, 'Clay Pinch & Squash', 'Roll 3 small balls of therapy putty. Ask the child to use thumb and pointer finger to pinch each into a pancake.'),
  ('77777776-7777-4777-8777-777777777776', '22222222-2222-4222-8222-222222222222', 3, 'Twist-Top Container', 'Hold a small plastic container steady with the non-dominant hand while unscrewing the lid using the dominant hand fingers.')
ON CONFLICT (id) DO NOTHING;

-- Steps for Adolescent Protocol
INSERT INTO public.program_steps (id, program_id, position, title, instructions)
VALUES
  ('77777777-7777-4777-8777-777777777777', '33333333-4444-4333-8333-333333333333', 1, 'Tripod Grip Writing Drill', 'Complete 10 lines of continuous loop patterns on lined paper maintaining relaxed pencil pressure and open web space.'),
  ('77777778-7777-4777-8777-777777777778', '33333333-4444-4333-8333-333333333333', 2, 'Adaptive Scissors Precision Cut', 'Cut along complex geometric zig-zag paths using adaptive loop scissors, turning paper with non-dominant hand.'),
  ('77777779-7777-4777-8777-777777777779', '33333333-4444-4333-8333-333333333333', 3, 'Keyboard Ergonomic Posture', 'Type for 5 minutes with wrists neutral, elbows at 90 degrees, and periodic 30-second finger extensor stretches.')
ON CONFLICT (id) DO NOTHING;

-- ----------------------------------------------------------------------------
-- 4. SUBMISSIONS & STEP SUBMISSIONS
-- ----------------------------------------------------------------------------
INSERT INTO public.submissions (
  id,
  program_id,
  patient_id,
  state,
  consent_therapist,
  consent_meta_ai,
  submitted_at,
  created_at,
  updated_at
) VALUES
  (
    '55555555-5555-4555-8555-555555555555',
    '44444444-4444-4444-8444-444444444444',
    '33333333-3333-4333-8333-333333333333',
    'submitted',
    true,
    true,
    NOW() - INTERVAL '1 day',
    NOW() - INTERVAL '2 days',
    NOW() - INTERVAL '1 day'
  ),
  (
    '55555555-5555-4555-8555-555555555556',
    '22222222-2222-4222-8222-222222222222',
    '44444444-4444-4444-8444-444444444444',
    'submitted',
    true,
    true,
    NOW() - INTERVAL '12 hours',
    NOW() - INTERVAL '18 hours',
    NOW() - INTERVAL '12 hours'
  )
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.step_submissions (
  id,
  submission_id,
  program_step_id,
  video_path,
  client_comment,
  skipped,
  skip_reason
) VALUES
  (
    '88888881-8888-4888-8888-888888888881',
    '55555555-5555-4555-8555-555555555555',
    '77777771-7777-4777-8777-777777777781',
    'demo/cup_grasp_transfer.mp4',
    'Felt smoother than last week! Finger extension still feels stiff right before touching the cup.',
    false,
    null
  ),
  (
    '88888882-8888-4888-8888-888888888882',
    '55555555-5555-4555-8555-555555555555',
    '77777772-7777-4777-8777-777777777782',
    'demo/block_stacking.mp4',
    'Stacking was harder with the left hand, had to re-adjust grip twice.',
    false,
    null
  ),
  (
    '88888883-8888-4888-8888-888888888883',
    '55555555-5555-4555-8555-555555555555',
    '77777773-7777-4777-8777-777777777783',
    null,
    null,
    true,
    'Forearm felt fatigued from physical therapy session earlier in the day.'
  )
ON CONFLICT (id) DO NOTHING;

-- ----------------------------------------------------------------------------
-- 5. REVIEWS & STEP REVIEWS
-- ----------------------------------------------------------------------------
INSERT INTO public.submission_reviews (
  id,
  submission_id,
  overall_feedback,
  status,
  created_at,
  updated_at
) VALUES (
  '66666666-6666-4666-8666-666666666666',
  '55555555-5555-4555-8555-555555555555',
  'Wonderful effort this week Marcus! Your digit extension trajectory is improving consistently. Keep monitoring forearm stability.',
  'draft',
  NOW() - INTERVAL '6 hours',
  NOW() - INTERVAL '6 hours'
) ON CONFLICT (id) DO NOTHING;

INSERT INTO public.step_reviews (
  id,
  review_id,
  step_submission_id,
  therapist_note
) VALUES
  (
    '99999991-9999-4999-8999-999999999991',
    '66666666-6666-4666-8666-666666666666',
    '88888881-8888-4888-8888-888888888881',
    'Notice how your thumb abducts smoothly at 0:04. Try to pause for an extra full second before the lift.'
  )
ON CONFLICT (id) DO NOTHING;

-- ----------------------------------------------------------------------------
-- 6. SAMPLE 1-ON-1 MESSAGES
-- ----------------------------------------------------------------------------
INSERT INTO public.messages (
  id,
  patient_id,
  body,
  referenced_program_id,
  created_at
) VALUES
  (
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    '33333333-3333-4333-8333-333333333333',
    'Hi Dr. Ramos, I completed my tabletop routine this morning. My wrist felt a lot more stable during the cup lift.',
    '44444444-4444-4444-8444-444444444444',
    NOW() - INTERVAL '1 day'
  ),
  (
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    '33333333-3333-4333-8333-333333333333',
    'Great job Marcus! I reviewed your video. Your finger aperture was much cleaner today. Keep practicing step 1 daily.',
    '44444444-4444-4444-8444-444444444444',
    NOW() - INTERVAL '18 hours'
  ),
  (
    'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
    '44444444-4444-4444-8444-444444444444',
    'Hello Dr. Ramos, Leo really enjoyed the putty exercises today! He managed to make 5 mini pancakes with his index finger.',
    '22222222-2222-4222-8222-222222222222',
    NOW() - INTERVAL '10 hours'
  )
ON CONFLICT (id) DO NOTHING;
