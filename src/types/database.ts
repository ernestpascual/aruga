/**
 * Database Types for Aruga
 * Maps directly to PostgreSQL / Supabase Schema
 */

export type UserRole = "therapist" | "client";

export type Discipline = "SLP" | "OT" | "PT";

export type ProgramStatus = "draft" | "assigned" | "archived";

export type SubmissionState = "draft" | "submitted" | "reviewed";

export type ReviewStatus = "draft" | "published";

export type InvitationStatus = "pending" | "accepted" | "declined" | "failed" | "unlinked";

export type AiAnalysisStatus = "pending" | "processing" | "completed" | "failed";

export type AiAnalysisKind = "spark_observation" | "sam_segmentation" | "full_review";

export type ClientCategory = "adult" | "adolescent" | "pedia" | "old_people";

export interface Profile {
  id: string;
  role: UserRole;
  display_name: string;
  email?: string | null;
  discipline: Discipline | null;
  client_category?: ClientCategory | null;

  // Therapist specific profile fields
  license_number?: string | null;
  facility_name?: string | null;
  specialties?: string | null;
  phone?: string | null;
  office_hours?: string | null;
  caseload_focus?: string | null;
  bio?: string | null;

  // Client specific profile fields (Adult, Adolescent, Pediatric)
  age?: number | null;
  date_of_birth?: string | null;
  primary_condition?: string | null;
  caregiver_name?: string | null;
  caregiver_relationship?: string | null;
  emergency_phone?: string | null;
  therapy_goals?: string | null;
  preferred_schedule?: string | null;
  sensory_preferences?: string | null;
  school_or_workplace?: string | null;
  clinician_name?: string | null;

  created_at: string;
  updated_at: string;
}

export interface SamTestRecord {
  id: string;
  user_id: string;
  prompt: string;
  file_name?: string | null;
  duration_seconds?: number | null;
  object_concepts: string[];
  tracks: Array<{ trackId: string; label: string; objectId?: string; frames: number[] }>;
  boxes: Array<{
    frameIndex: number;
    timestampSeconds: number;
    box: [number, number, number, number];
    label: string;
    confidence?: number;
  }>;
  svg_paths?: Array<{
    frameIndex: number;
    path: string;
    label?: string;
  }>;
  billed_requests: number;
  model_id?: string | null;
  latency_ms?: number | null;
  created_at: string;
}

export interface OtConversation {
  id: string;
  user_id: string;
  title: string;
  model_id: string;
  created_at: string;
  updated_at: string;
}

export interface OtMessage {
  id: string;
  conversation_id: string;
  role: "user" | "assistant";
  content: string;
  attachments?: Array<{
    kind: "image" | "video";
    dataUrl?: string;
    name?: string;
  }>;
  sam_result?: Record<string, unknown> | null;
  created_at: string;
}

export interface Patient {
  id: string;
  therapist_id: string;
  client_user_id: string | null;
  name: string;
  age: number; // Integer: pediatric (<18) or adult (>=18)
  gender: string; // 'Female' | 'Male' | 'Non-binary' | 'Prefer not to say' | etc.
  condition: string;
  email: string;
  caregiver_name?: string | null;
  client_category?: ClientCategory | null;
  invitation_status: InvitationStatus;
  invitation_sent_at: string | null;
  invitation_initiated_by?: "therapist" | "client" | null;
  therapist_name?: string | null;
  previous_therapist_id?: string | null;
  previous_therapist_name?: string | null;
  handover_notes?: string | null;
  pending_therapist_email?: string | null;
  temporary_password?: string | null;
  first_login_at?: string | null;
  credentials_cleared_at?: string | null;
  created_at: string;
  updated_at: string;
  // Join fields
  active_programs_count?: number;
  awaiting_review_count?: number;
  last_activity?: string | null;
}

export interface ProgramStep {
  id: string;
  program_id: string;
  position: number;
  title: string | null;
  instructions: string;
  created_at: string;
}

export interface HomeProgram {
  id: string;
  patient_id: string;
  creator_id: string;
  title: string;
  main_instructions: string;
  status: ProgramStatus;
  assigned_at: string | null;
  created_at: string;
  updated_at: string;
  // Joined fields
  steps?: ProgramStep[];
  patient?: Patient;
}

export interface StepSubmission {
  id: string;
  submission_id: string;
  program_step_id: string;
  video_path: string | null;
  media_meta: {
    mime?: string;
    sizeBytes?: number;
    durationSeconds?: number;
    width?: number;
    height?: number;
    formatSupported?: boolean;
    storagePath?: string;
    bucket?: string;
    freeTierCompliant?: boolean;
    uploadedAt?: string;
    uploadedToSupabaseStorage?: boolean;
  };
  client_comment: string | null;
  skipped: boolean;
  skip_reason: string | null;
  created_at: string;
  updated_at: string;
  // Joined step info
  step?: ProgramStep;
  ai_analysis?: AiAnalysisRecord | null;
}

export interface Submission {
  id: string;
  program_id: string;
  patient_id: string;
  client_id: string;
  state: SubmissionState;
  consent_therapist: boolean;
  consent_meta_ai: boolean;
  submitted_at: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
  // Joined
  program?: HomeProgram;
  step_submissions?: StepSubmission[];
  review?: SubmissionReview | null;
}

export interface StepReview {
  id: string;
  review_id: string;
  step_submission_id: string;
  therapist_note: string;
  created_at: string;
  updated_at: string;
}

export interface SubmissionReview {
  id: string;
  submission_id: string;
  therapist_id: string;
  overall_feedback: string | null;
  subjective?: string | null;
  objective?: string | null;
  assessment?: string | null;
  plan?: string | null;
  client_summary?: string | null;
  status: ReviewStatus;
  published_at: string | null;
  created_at: string;
  updated_at: string;
  step_reviews?: StepReview[];
}

export interface SoapNote {
  id: string;
  patient_id: string;
  therapist_id: string;
  session_date: string;
  session_title: string;
  subjective: string;
  objective: string;
  assessment: string;
  plan: string;
  client_summary: string;
  created_at: string;
  updated_at: string;
  // Joined
  therapist_profile?: Profile;
}

export interface Message {
  id: string;
  patient_id: string;
  sender_id: string;
  body: string;
  referenced_program_id: string | null;
  created_at: string;
  // Joined
  sender_profile?: Profile;
  referenced_program?: {
    id: string;
    title: string;
    status: ProgramStatus;
  };
}

export interface AiAnalysisRecord {
  id: string;
  step_submission_id: string;
  analysis_kind: AiAnalysisKind;
  model_id: string;
  idempotency_key: string;
  prompt_version: string;
  processing_status: AiAnalysisStatus;
  spark_results: {
    observations: Array<{
      id: string;
      description: string;
      approx_timestamp_seconds?: number | null;
      confirmed?: boolean;
    }>;
    limitations: string[];
    suggested_object_concept?: string | null;
    clinical_note_draft?: string;
  } | null;
  sam_results: {
    object_concept: string;
    detected_frames_count: number;
    boxes: Array<{
      frame_index: number;
      timestamp_seconds: number;
      box: [number, number, number, number]; // [ymin, xmin, ymax, xmax] normalized 0-1
      label: string;
      confidence?: number;
    }>;
    svg_paths?: Array<{
      frame_index: number;
      path: string;
    }>;
    duration_analyzed_seconds?: number;
  } | null;
  artifact_path: string | null;
  confirmed_observations: string[]; // IDs of confirmed observations
  timing_ms: number | null;
  sanitized_error: string | null;
  created_at: string;
  updated_at: string;
}

export interface AuditEvent {
  id: string;
  actor_id: string | null;
  action: string;
  affected_resource: string;
  resource_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}
