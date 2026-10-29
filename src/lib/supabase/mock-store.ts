import {
  Profile,
  Patient,
  HomeProgram,
  ProgramStep,
  Submission,
  StepSubmission,
  SubmissionReview,
  StepReview,
  Message,
  AiAnalysisRecord,
} from "@/types/database";

export interface MockStoreData {
  profiles: Profile[];
  patients: Patient[];
  programs: HomeProgram[];
  steps: ProgramStep[];
  submissions: Submission[];
  stepSubmissions: StepSubmission[];
  reviews: SubmissionReview[];
  stepReviews: StepReview[];
  messages: Message[];
  aiAnalyses: AiAnalysisRecord[];
}

// Fixed UUIDs for predictable demo fixtures
export const DEMO_THERAPIST_ID = "11111111-1111-4111-8111-111111111111";

// Adult Demonstration Client (Marcus Vance, Age 58)
export const DEMO_CLIENT_ID = "22222222-2222-4222-8222-222222222222";
export const DEMO_PATIENT_ID = "33333333-3333-4333-8333-333333333333";
export const DEMO_PROGRAM_ID = "44444444-4444-4444-8444-444444444444";
export const DEMO_SUBMISSION_ID = "55555555-5555-4555-8555-555555555555";
export const DEMO_REVIEW_ID = "66666666-6666-4666-8666-666666666666";

export const DEMO_STEP_1_ID = "77777771-7777-4777-8777-777777777771";
export const DEMO_STEP_2_ID = "77777772-7777-4777-8777-777777777772";
export const DEMO_STEP_3_ID = "77777773-7777-4777-8777-777777777773";

export const DEMO_STEP_SUB_1_ID = "88888881-8888-4888-8888-888888888881";
export const DEMO_STEP_SUB_2_ID = "88888882-8888-4888-8888-888888888882";
export const DEMO_STEP_SUB_3_ID = "88888883-8888-4888-8888-888888888883";

// Pediatric Demonstration Client (Leo Chen, Age 6)
export const DEMO_PEDIATRIC_CLIENT_ID = "22222222-2222-4222-8222-222222222224";
export const DEMO_PEDIATRIC_PATIENT_ID = "33333333-3333-4333-8333-333333333334";
export const DEMO_PEDIATRIC_PROGRAM_ID = "44444444-4444-4444-8444-444444444445";
export const DEMO_PEDIATRIC_SUBMISSION_ID = "55555555-5555-4555-8555-555555555556";
export const DEMO_PEDIATRIC_REVIEW_ID = "66666666-6666-4666-8666-666666666667";

export const DEMO_PEDIATRIC_STEP_1_ID = "77777774-7777-4777-8777-777777777774";
export const DEMO_PEDIATRIC_STEP_2_ID = "77777775-7777-4777-8777-777777777775";
export const DEMO_PEDIATRIC_STEP_3_ID = "77777776-7777-4777-8777-777777777776";

export const DEMO_PEDIATRIC_STEP_SUB_1_ID = "88888884-8888-4888-8888-888888888884";
export const DEMO_PEDIATRIC_STEP_SUB_2_ID = "88888885-8888-4888-8888-888888888885";
export const DEMO_PEDIATRIC_STEP_SUB_3_ID = "88888886-8888-4888-8888-888888888886";

function getInitialStore(): MockStoreData {
  const profiles: Profile[] = [
    {
      id: DEMO_THERAPIST_ID,
      role: "therapist",
      display_name: "Dr. Elena Ramos, OTR/L",
      discipline: "OT",
      created_at: new Date(Date.now() - 30 * 86400000).toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      id: DEMO_CLIENT_ID,
      role: "client",
      display_name: "Marcus Vance",
      discipline: null,
      created_at: new Date(Date.now() - 20 * 86400000).toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      id: DEMO_PEDIATRIC_CLIENT_ID,
      role: "client",
      display_name: "Leo Chen (Caregiver: Sarah Chen)",
      discipline: null,
      created_at: new Date(Date.now() - 15 * 86400000).toISOString(),
      updated_at: new Date().toISOString(),
    },
  ];

  const patients: Patient[] = [
    {
      id: DEMO_PATIENT_ID,
      therapist_id: DEMO_THERAPIST_ID,
      client_user_id: DEMO_CLIENT_ID,
      name: "Marcus Vance",
      age: 58,
      gender: "Male",
      condition: "Right ischemic CVA with upper extremity hemiparesis",
      email: "marcus.vance.demo@aruga-health.local",
      caregiver_name: null,
      invitation_status: "accepted",
      invitation_sent_at: new Date(Date.now() - 20 * 86400000).toISOString(),
      created_at: new Date(Date.now() - 20 * 86400000).toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      id: DEMO_PEDIATRIC_PATIENT_ID,
      therapist_id: DEMO_THERAPIST_ID,
      client_user_id: DEMO_PEDIATRIC_CLIENT_ID,
      name: "Leo Chen",
      age: 6,
      gender: "Male",
      condition: "Pediatric Bilateral Coordination Delay & Pincer Grasp Development",
      email: "leo.chen.demo@aruga-health.local",
      caregiver_name: "Sarah Chen (Mother)",
      invitation_status: "accepted",
      invitation_sent_at: new Date(Date.now() - 15 * 86400000).toISOString(),
      created_at: new Date(Date.now() - 15 * 86400000).toISOString(),
      updated_at: new Date().toISOString(),
    },
  ];

  const programs: HomeProgram[] = [
    {
      id: DEMO_PROGRAM_ID,
      patient_id: DEMO_PATIENT_ID,
      creator_id: DEMO_THERAPIST_ID,
      title: "Tabletop Grasp & Precision Release Routine",
      main_instructions:
        "Perform these 3 coordinated tabletop exercises once daily in a seated position with good posture. Keep the forearm supported on the table and record a short 10-20 second clip of each activity.",
      status: "assigned",
      assigned_at: new Date(Date.now() - 2 * 86400000).toISOString(),
      created_at: new Date(Date.now() - 3 * 86400000).toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      id: DEMO_PEDIATRIC_PROGRAM_ID,
      patient_id: DEMO_PEDIATRIC_PATIENT_ID,
      creator_id: DEMO_THERAPIST_ID,
      title: "Playful Pincer Grasp & Bilateral Toy Routine",
      main_instructions:
        "Complete these 3 playful tabletop activities together with a parent or caregiver once daily. Keep exercises fun and encouraging, and record a 10-20s video clip of each activity.",
      status: "assigned",
      assigned_at: new Date(Date.now() - 1 * 86400000).toISOString(),
      created_at: new Date(Date.now() - 2 * 86400000).toISOString(),
      updated_at: new Date().toISOString(),
    },
  ];

  const steps: ProgramStep[] = [
    // Adult Steps
    {
      id: DEMO_STEP_1_ID,
      program_id: DEMO_PROGRAM_ID,
      position: 1,
      title: "Cylindrical Cup Lift and Transfer",
      instructions:
        "Place a lightweight plastic cup 6 inches in front of you. Reach forward using full active extension, grasp with all digits, lift 3 inches vertically, hold for 2 seconds, and place back down gently without knocking it over.",
      created_at: new Date(Date.now() - 3 * 86400000).toISOString(),
    },
    {
      id: DEMO_STEP_2_ID,
      program_id: DEMO_PROGRAM_ID,
      position: 2,
      title: "Small Block Lateral Stacking",
      instructions:
        "Pick up the wooden block using a three-jaw chuck (thumb, index, middle fingers). Move it across your midline to the target marker on your left, then release cleanly.",
      created_at: new Date(Date.now() - 3 * 86400000).toISOString(),
    },
    {
      id: DEMO_STEP_3_ID,
      program_id: DEMO_PROGRAM_ID,
      position: 3,
      title: "Forearm Supination with Washcloth",
      instructions:
        "Hold the folded washcloth flat on the tabletop. Slowly rotate your forearm so your palm faces fully upward, pausing for 3 seconds before returning to neutral.",
      created_at: new Date(Date.now() - 3 * 86400000).toISOString(),
    },
    // Pediatric Steps
    {
      id: DEMO_PEDIATRIC_STEP_1_ID,
      program_id: DEMO_PEDIATRIC_PROGRAM_ID,
      position: 1,
      title: "Colorful Peg Stacking Game",
      instructions:
        "Have Leo use thumb and index finger (pincer grasp) to pick up 5 colorful pegs and place them into the board. Encourage keeping the helper hand steady on the table.",
      created_at: new Date(Date.now() - 2 * 86400000).toISOString(),
    },
    {
      id: DEMO_PEDIATRIC_STEP_2_ID,
      program_id: DEMO_PEDIATRIC_PROGRAM_ID,
      position: 2,
      title: "Play-Doh Bead Roll & Squash",
      instructions:
        "Roll three small dough balls between palms or fingers, then have Leo squash each one flat with his pointer finger.",
      created_at: new Date(Date.now() - 2 * 86400000).toISOString(),
    },
    {
      id: DEMO_PEDIATRIC_STEP_3_ID,
      program_id: DEMO_PEDIATRIC_PROGRAM_ID,
      position: 3,
      title: "Two-Handed Lid Unscrewing",
      instructions:
        "Hold the plastic jar base steady with the non-dominant helper hand while gently turning the lid with the dominant hand.",
      created_at: new Date(Date.now() - 2 * 86400000).toISOString(),
    },
  ];

  const submissions: Submission[] = [
    // Adult Submission
    {
      id: DEMO_SUBMISSION_ID,
      program_id: DEMO_PROGRAM_ID,
      patient_id: DEMO_PATIENT_ID,
      client_id: DEMO_CLIENT_ID,
      state: "submitted",
      consent_therapist: true,
      consent_meta_ai: true,
      submitted_at: new Date(Date.now() - 86400000).toISOString(),
      reviewed_at: null,
      created_at: new Date(Date.now() - 2 * 86400000).toISOString(),
      updated_at: new Date(Date.now() - 86400000).toISOString(),
    },
    // Pediatric Submission
    {
      id: DEMO_PEDIATRIC_SUBMISSION_ID,
      program_id: DEMO_PEDIATRIC_PROGRAM_ID,
      patient_id: DEMO_PEDIATRIC_PATIENT_ID,
      client_id: DEMO_PEDIATRIC_CLIENT_ID,
      state: "submitted",
      consent_therapist: true,
      consent_meta_ai: true,
      submitted_at: new Date(Date.now() - 40000000).toISOString(),
      reviewed_at: null,
      created_at: new Date(Date.now() - 45000000).toISOString(),
      updated_at: new Date(Date.now() - 40000000).toISOString(),
    },
  ];

  const stepSubmissions: StepSubmission[] = [
    // Adult Step Submissions
    {
      id: DEMO_STEP_SUB_1_ID,
      submission_id: DEMO_SUBMISSION_ID,
      program_step_id: DEMO_STEP_1_ID,
      video_path: "demo/cup_grasp_transfer.mp4",
      media_meta: {
        mime: "video/mp4",
        sizeBytes: 8420000,
        durationSeconds: 14,
        width: 1280,
        height: 720,
        formatSupported: true,
      },
      client_comment:
        "Felt smoother than last week! Finger extension still feels stiff right before touching the cup.",
      skipped: false,
      skip_reason: null,
      created_at: new Date(Date.now() - 86400000).toISOString(),
      updated_at: new Date(Date.now() - 86400000).toISOString(),
    },
    {
      id: DEMO_STEP_SUB_2_ID,
      submission_id: DEMO_SUBMISSION_ID,
      program_step_id: DEMO_STEP_2_ID,
      video_path: "demo/block_stacking.mp4",
      media_meta: {
        mime: "video/mp4",
        sizeBytes: 7100000,
        durationSeconds: 12,
        width: 1280,
        height: 720,
        formatSupported: true,
      },
      client_comment: "Managed 4 repetitions with the small wooden block.",
      skipped: false,
      skip_reason: null,
      created_at: new Date(Date.now() - 86400000).toISOString(),
      updated_at: new Date(Date.now() - 86400000).toISOString(),
    },
    {
      id: DEMO_STEP_SUB_3_ID,
      submission_id: DEMO_SUBMISSION_ID,
      program_step_id: DEMO_STEP_3_ID,
      video_path: null,
      media_meta: {},
      client_comment: null,
      skipped: true,
      skip_reason: "Shoulder felt tight and fatigued after step 2; rested per precautions.",
      created_at: new Date(Date.now() - 86400000).toISOString(),
      updated_at: new Date(Date.now() - 86400000).toISOString(),
    },
    // Pediatric Step Submissions
    {
      id: DEMO_PEDIATRIC_STEP_SUB_1_ID,
      submission_id: DEMO_PEDIATRIC_SUBMISSION_ID,
      program_step_id: DEMO_PEDIATRIC_STEP_1_ID,
      video_path: "demo/cup_grasp_transfer.mp4",
      media_meta: {
        mime: "video/mp4",
        sizeBytes: 6500000,
        durationSeconds: 15,
        width: 1280,
        height: 720,
        formatSupported: true,
      },
      client_comment: "Leo loved picking the green and yellow pegs today!",
      skipped: false,
      skip_reason: null,
      created_at: new Date(Date.now() - 40000000).toISOString(),
      updated_at: new Date(Date.now() - 40000000).toISOString(),
    },
    {
      id: DEMO_PEDIATRIC_STEP_SUB_2_ID,
      submission_id: DEMO_PEDIATRIC_SUBMISSION_ID,
      program_step_id: DEMO_PEDIATRIC_STEP_2_ID,
      video_path: "demo/block_stacking.mp4",
      media_meta: {
        mime: "video/mp4",
        sizeBytes: 5900000,
        durationSeconds: 12,
        width: 1280,
        height: 720,
        formatSupported: true,
      },
      client_comment: "Used index finger to squash all 3 dough balls.",
      skipped: false,
      skip_reason: null,
      created_at: new Date(Date.now() - 40000000).toISOString(),
      updated_at: new Date(Date.now() - 40000000).toISOString(),
    },
    {
      id: DEMO_PEDIATRIC_STEP_SUB_3_ID,
      submission_id: DEMO_PEDIATRIC_SUBMISSION_ID,
      program_step_id: DEMO_PEDIATRIC_STEP_3_ID,
      video_path: null,
      media_meta: {},
      client_comment: null,
      skipped: true,
      skip_reason: "Jar lid was too tight for tiny hands; will practice with a looser lid tomorrow.",
      created_at: new Date(Date.now() - 40000000).toISOString(),
      updated_at: new Date(Date.now() - 40000000).toISOString(),
    },
  ];

  const reviews: SubmissionReview[] = [
    {
      id: DEMO_REVIEW_ID,
      submission_id: DEMO_SUBMISSION_ID,
      therapist_id: DEMO_THERAPIST_ID,
      overall_feedback:
        "Great effort on the tabletop transfer, Marcus. Your wrist alignment during the cup release is noticeably improved. Good decision to rest your shoulder on step 3—honoring fatigue prevents compensatory shoulder hiking.",
      status: "draft",
      published_at: null,
      created_at: new Date(Date.now() - 43200000).toISOString(),
      updated_at: new Date(Date.now() - 43200000).toISOString(),
    },
    {
      id: DEMO_PEDIATRIC_REVIEW_ID,
      submission_id: DEMO_PEDIATRIC_SUBMISSION_ID,
      therapist_id: DEMO_THERAPIST_ID,
      overall_feedback:
        "Fantastic progress, Leo! Sarah, his pincer grasp on the pegs showed wonderful isolated finger control with much less whole-hand raking. Great call on loosening the jar lid for step 3.",
      status: "draft",
      published_at: null,
      created_at: new Date(Date.now() - 20000000).toISOString(),
      updated_at: new Date(Date.now() - 20000000).toISOString(),
    },
  ];

  const stepReviews: StepReview[] = [
    {
      id: "99999991-9999-4999-8999-999999999991",
      review_id: DEMO_REVIEW_ID,
      step_submission_id: DEMO_STEP_SUB_1_ID,
      therapist_note:
        "Smooth cylindrical grasp observed. Minimal trunk compensation. Keep focusing on slow finger release.",
      created_at: new Date(Date.now() - 43200000).toISOString(),
      updated_at: new Date(Date.now() - 43200000).toISOString(),
    },
    {
      id: "99999992-9999-4999-8999-999999999992",
      review_id: DEMO_REVIEW_ID,
      step_submission_id: DEMO_STEP_SUB_2_ID,
      therapist_note:
        "Clean pinch grasp. Noticeable control when crossing midline.",
      created_at: new Date(Date.now() - 43200000).toISOString(),
      updated_at: new Date(Date.now() - 43200000).toISOString(),
    },
    {
      id: "99999993-9999-4999-8999-999999999993",
      review_id: DEMO_REVIEW_ID,
      step_submission_id: DEMO_STEP_SUB_3_ID,
      therapist_note:
        "Appropriate skip. We will re-evaluate shoulder active range of motion during our next session.",
      created_at: new Date(Date.now() - 43200000).toISOString(),
      updated_at: new Date(Date.now() - 43200000).toISOString(),
    },
    // Pediatric Step Reviews
    {
      id: "99999994-9999-4999-8999-999999999994",
      review_id: DEMO_PEDIATRIC_REVIEW_ID,
      step_submission_id: DEMO_PEDIATRIC_STEP_SUB_1_ID,
      therapist_note:
        "Clear index-thumb opposition. Helper hand stabilized the board well.",
      created_at: new Date(Date.now() - 20000000).toISOString(),
      updated_at: new Date(Date.now() - 20000000).toISOString(),
    },
    {
      id: "99999995-9999-4999-8999-999999999995",
      review_id: DEMO_PEDIATRIC_REVIEW_ID,
      step_submission_id: DEMO_PEDIATRIC_STEP_SUB_2_ID,
      therapist_note:
        "Good finger isolation when squashing the dough beads.",
      created_at: new Date(Date.now() - 20000000).toISOString(),
      updated_at: new Date(Date.now() - 20000000).toISOString(),
    },
  ];

  const messages: Message[] = [
    // Adult Thread
    {
      id: "aaaaaaa1-aaaa-4aaa-8aaa-aaaaaaaaaaa1",
      patient_id: DEMO_PATIENT_ID,
      sender_id: DEMO_THERAPIST_ID,
      body: "Hi Marcus, I have assigned your new home program. Focus on slow, controlled release of the cup.",
      referenced_program_id: DEMO_PROGRAM_ID,
      created_at: new Date(Date.now() - 2 * 86400000).toISOString(),
    },
    {
      id: "aaaaaaa2-aaaa-4aaa-8aaa-aaaaaaaaaaa2",
      patient_id: DEMO_PATIENT_ID,
      sender_id: DEMO_CLIENT_ID,
      body: "Thanks Dr. Ramos! I completed the first two steps today and rested my shoulder on step 3.",
      referenced_program_id: DEMO_PROGRAM_ID,
      created_at: new Date(Date.now() - 86400000).toISOString(),
    },
    // Pediatric Thread
    {
      id: "aaaaaaa3-aaaa-4aaa-8aaa-aaaaaaaaaaa3",
      patient_id: DEMO_PEDIATRIC_PATIENT_ID,
      sender_id: DEMO_THERAPIST_ID,
      body: "Hi Sarah! I've assigned Leo's new play routine. Focus on keeping his helper hand steady while using his pincers.",
      referenced_program_id: DEMO_PEDIATRIC_PROGRAM_ID,
      created_at: new Date(Date.now() - 2 * 86400000).toISOString(),
    },
    {
      id: "aaaaaaa4-aaaa-4aaa-8aaa-aaaaaaaaaaa4",
      patient_id: DEMO_PEDIATRIC_PATIENT_ID,
      sender_id: DEMO_PEDIATRIC_CLIENT_ID,
      body: "Hi Dr. Elena! Leo had so much fun with the peg stacking today! Uploaded the video for your review.",
      referenced_program_id: DEMO_PEDIATRIC_PROGRAM_ID,
      created_at: new Date(Date.now() - 30000000).toISOString(),
    },
  ];

  const aiAnalyses: AiAnalysisRecord[] = [
    {
      id: "bbbbbbb1-bbbb-4bbb-8bbb-bbbbbbbbbbb1",
      step_submission_id: DEMO_STEP_SUB_1_ID,
      analysis_kind: "full_review",
      model_id: "muse-spark-1.3 + sam-3.1",
      idempotency_key: `spark-sam-${DEMO_STEP_SUB_1_ID}-v1`,
      prompt_version: "v1",
      processing_status: "completed",
      spark_results: {
        observations: [
          {
            id: "obs-1",
            description: "Subject reaches forward with right upper extremity toward a blue plastic cup.",
            approx_timestamp_seconds: 2.4,
            confirmed: true,
          },
          {
            id: "obs-2",
            description: "Full active cylindrical grasp achieved around the midsection of the cup.",
            approx_timestamp_seconds: 5.1,
            confirmed: true,
          },
          {
            id: "obs-3",
            description: "Cup lifted approximately 3-4 inches above table surface without tilting.",
            approx_timestamp_seconds: 7.8,
            confirmed: true,
          },
          {
            id: "obs-4",
            description: "Controlled descent and release with minimal trunk lateral flexion.",
            approx_timestamp_seconds: 11.2,
            confirmed: false,
          },
        ],
        limitations: [
          "Camera angle is slightly angled from the right side; partial wrist occlusion during initial contact.",
          "Video frame rate is approximately 30fps; rapid finger release occurs over 4 frames.",
        ],
        suggested_object_concept: "cup",
        clinical_note_draft:
          "Video reveals smooth cylindrical grasp and sustained vertical lift of the target cup with intact tabletop release.",
      },
      sam_results: {
        object_concept: "cup",
        detected_frames_count: 8,
        boxes: [
          { frame_index: 0, timestamp_seconds: 0.0, box: [0.42, 0.48, 0.72, 0.62], label: "cup", confidence: 0.94 },
          { frame_index: 1, timestamp_seconds: 2.0, box: [0.42, 0.48, 0.72, 0.62], label: "cup", confidence: 0.95 },
          { frame_index: 2, timestamp_seconds: 4.5, box: [0.41, 0.48, 0.71, 0.62], label: "cup", confidence: 0.96 },
          { frame_index: 3, timestamp_seconds: 6.0, box: [0.32, 0.48, 0.62, 0.62], label: "cup", confidence: 0.96 },
          { frame_index: 4, timestamp_seconds: 8.0, box: [0.30, 0.48, 0.60, 0.62], label: "cup", confidence: 0.97 },
          { frame_index: 5, timestamp_seconds: 10.0, box: [0.38, 0.48, 0.68, 0.62], label: "cup", confidence: 0.95 },
          { frame_index: 6, timestamp_seconds: 12.0, box: [0.42, 0.48, 0.72, 0.62], label: "cup", confidence: 0.94 },
          { frame_index: 7, timestamp_seconds: 14.0, box: [0.42, 0.48, 0.72, 0.62], label: "cup", confidence: 0.93 },
        ],
        svg_paths: [
          { frame_index: 3, path: "M0.48 0.32 L0.62 0.32 L0.61 0.62 L0.49 0.62 Z" },
          { frame_index: 4, path: "M0.48 0.30 L0.62 0.30 L0.61 0.60 L0.49 0.60 Z" },
        ],
        duration_analyzed_seconds: 14,
      },
      artifact_path: "ai-artifacts/sam-cup-demo.json",
      confirmed_observations: ["obs-1", "obs-2", "obs-3"],
      timing_ms: 1840,
      sanitized_error: null,
      created_at: new Date(Date.now() - 40000000).toISOString(),
      updated_at: new Date(Date.now() - 40000000).toISOString(),
    },
    {
      id: "bbbbbbb2-bbbb-4bbb-8bbb-bbbbbbbbbbb2",
      step_submission_id: DEMO_PEDIATRIC_STEP_SUB_1_ID,
      analysis_kind: "full_review",
      model_id: "muse-spark-1.3 + sam-3.1",
      idempotency_key: `spark-sam-${DEMO_PEDIATRIC_STEP_SUB_1_ID}-v1`,
      prompt_version: "v1",
      processing_status: "completed",
      spark_results: {
        observations: [
          {
            id: "ped-obs-1",
            description: "Child reaches toward colorful peg using thumb and index pad opposition (pincer grasp).",
            approx_timestamp_seconds: 3.1,
            confirmed: true,
          },
          {
            id: "ped-obs-2",
            description: "Helper hand maintains gentle tabletop stabilization on pegboard edge.",
            approx_timestamp_seconds: 6.4,
            confirmed: true,
          },
          {
            id: "ped-obs-3",
            description: "Clean vertical peg insertion without knocking adjacent pegs.",
            approx_timestamp_seconds: 9.8,
            confirmed: true,
          },
        ],
        limitations: [
          "Caregiver hand occasionally enters upper peripheral frame during encouraging prompt.",
        ],
        suggested_object_concept: "peg",
        clinical_note_draft:
          "Video demonstrates emerging fine pincer grasp on small pegboard target with intact helper hand positioning.",
      },
      sam_results: {
        object_concept: "peg",
        detected_frames_count: 6,
        boxes: [
          { frame_index: 0, timestamp_seconds: 0.0, box: [0.45, 0.45, 0.65, 0.55], label: "peg", confidence: 0.92 },
          { frame_index: 1, timestamp_seconds: 3.0, box: [0.44, 0.45, 0.64, 0.55], label: "peg", confidence: 0.95 },
          { frame_index: 2, timestamp_seconds: 6.0, box: [0.35, 0.45, 0.55, 0.55], label: "peg", confidence: 0.96 },
          { frame_index: 3, timestamp_seconds: 9.0, box: [0.40, 0.45, 0.60, 0.55], label: "peg", confidence: 0.94 },
        ],
        svg_paths: [],
        duration_analyzed_seconds: 15,
      },
      artifact_path: "ai-artifacts/sam-peg-demo.json",
      confirmed_observations: ["ped-obs-1", "ped-obs-2", "ped-obs-3"],
      timing_ms: 1450,
      sanitized_error: null,
      created_at: new Date(Date.now() - 35000000).toISOString(),
      updated_at: new Date(Date.now() - 35000000).toISOString(),
    },
  ];

  return {
    profiles,
    patients,
    programs,
    steps,
    submissions,
    stepSubmissions,
    reviews,
    stepReviews,
    messages,
    aiAnalyses,
  };
}

// Global in-memory singleton for development / mock mode
declare global {
  // eslint-disable-next-line no-var
  var __aruga_mock_store: MockStoreData | undefined;
}

export function getMockStore(): MockStoreData {
  if (!globalThis.__aruga_mock_store) {
    globalThis.__aruga_mock_store = getInitialStore();
  }
  return globalThis.__aruga_mock_store;
}

export function resetMockStore(): MockStoreData {
  globalThis.__aruga_mock_store = getInitialStore();
  return globalThis.__aruga_mock_store;
}
