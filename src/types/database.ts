/**
 * Database Types for Aruga
 * Maps directly to PostgreSQL Database Schema
 */

export type UserRole = "therapist" | "client";

export type Discipline = "SLP" | "OT" | "PT";

export type ProgramStatus = "draft" | "assigned" | "archived";

export type SubmissionState = "draft" | "submitted" | "reviewed";

export type ReviewStatus = "draft" | "published";

export type InvitationStatus = "pending" | "accepted" | "declined" | "failed" | "unlinked";

export type AiAnalysisStatus = "pending" | "processing" | "completed" | "failed";

export type AiAnalysisKind = "spark_observation" | "sam_segmentation" | "full_review" | "activity_generation";

export type AgeBand = "pedia" | "adolescent" | "adult" | "geriatric";
export type ActivityCategory = "coloring" | "handwriting" | "tracing" | "maze" | "matching" | "cognitive" | "adl_sim" | "visual_motor" | "fine_motor" | "other";
export type LineStyle = "none" | "double-line" | "triple-line" | "seyes" | "dotted";
export type ActivityStatus = "generating" | "ready" | "failed";
export type CompletionMethod = "canvas" | "photo" | "print_upload";
export type TemplateOwnerScope = "system" | "therapist";

export type ClientCategory = "adult" | "adolescent" | "pedia" | "geriatric" | "old_people";

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
  long_term_goals?: string[] | null;
  short_term_goals?: string[] | null;
  care_guide?: string | null;
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
  generated_activity_id?: string | null;
  generated_activity?: GeneratedActivity | null;
  created_at: string;
}

export interface ActivityTemplate {
  id: string;
  therapist_id: string | null;
  owner_scope: TemplateOwnerScope;
  title: string;
  description: string | null;
  age_band: AgeBand;
  category: ActivityCategory;
  spark_prompt: string;
  image_prompt: string;
  default_params: {
    difficulty?: string;
    theme?: string;
    lineStyle?: LineStyle;
    orientation?: "portrait" | "landscape";
    estimatedMinutes?: number;
    [k: string]: unknown;
  };
  thumbnail_path: string | null;
  is_featured: boolean;
  created_at: string;
  updated_at: string;
}

export interface GeneratedActivity {
  id: string;
  creator_id: string | null;
  patient_id: string | null;
  template_id: string | null;
  age_band: AgeBand;
  title: string;
  instructions: string;
  worksheet_kind?: WorksheetKind;
  written_tasks?: Array<{ step: number; text: string; kind: "do" | "check" | "write" }>;
  spark_prompt_used: string;
  image_prompt_used: string;
  reference_links: string[];
  reference_image_paths: string[];
  spark_spec: ActivitySparkSpec | null;
  base_image_path: string | null;
  base_image_url: string | null;
  composed_pdf_path: string | null;
  model_ids: Record<string, string>;
  status: ActivityStatus;
  error_message?: string | null;
  created_at: string;
  updated_at: string;
  // Joined
  template?: ActivityTemplate | null;
}

export interface ActivitySparkSpec {
  title: string;
  instructions: string;
  worksheetKind?: WorksheetKind;
  writtenTasks?: Array<{ step: number; text: string; kind: "do" | "check" | "write" }>;
  visualBrief: string;
  refinedImagePrompt: string;
  layoutSpec: {
    orientation: "portrait" | "landscape";
    lineGuides: LineStyle;
    zones: Array<{ label: string; type: string }>;
  };
  difficulty: string;
  estimatedMinutes: number;
  warnings: string[];
}

export type WorksheetKind = "drawable" | "written" | "mixed";

export interface ActivityCompletion {
  id: string;
  generated_activity_id: string;
  step_submission_id: string | null;
  patient_id: string;
  client_id: string | null;
  drawing_data_url: string | null;
  drawing_storage_path: string | null;
  drawing_strokes: Array<{
    color: string;
    width: number;
    points: Array<{ x: number; y: number }>;
  }>;
  photo_upload_path: string | null;
  text_response?: string | null;
  checklist_state?: Array<{ index: number; done: boolean; note?: string }>;
  completion_method: CompletionMethod;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
  generated_activity?: GeneratedActivity | null;
}

export interface HomeProgram {
  id: string;
  patient_id: string;
  creator_id: string;
  title: string;
  main_instructions: string;
  status: ProgramStatus;
  scheduled_dates?: string[]; // Up to 10 dates specified by therapist (each date is one submission)
  assigned_at: string | null;
  created_at: string;
  updated_at: string;
  // Joined fields
  steps?: ProgramStep[];
  patient?: Patient;
  submissions?: Submission[];
  latest_submission?: Submission | null;
}

export interface StepSubmission {
  id: string;
  submission_id: string;
  program_step_id: string;
  video_path: string | null; // generic media path: holds photo OR video URL (Supabase program-videos bucket)
  media_meta: {
    mime?: string;
    mediaKind?: "photo" | "video";
    sizeBytes?: number;
    durationSeconds?: number;
    width?: number;
    height?: number;
    formatSupported?: boolean;
    storagePath?: string;
    bucket?: string;
    freeTierCompliant?: boolean;
    uploadedAt?: string;
    uploadedToCloudStorage?: boolean;
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
  scheduled_date?: string | null; // Date (YYYY-MM-DD) this submission is for
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
  session_recording_url?: string | null;
  subjective?: string | null;
  objective?: string | null;
  assessment?: string | null;
  assessment_links?: SoapNoteAssessmentLink[] | null;
  plan?: string | null;
  client_summary?: string | null;
  status: ReviewStatus;
  published_at: string | null;
  created_at: string;
  updated_at: string;
  step_reviews?: StepReview[];
}

export interface SoapNoteAssessmentLink {
  title: string;
  url: string;
}

export interface SoapNote {
  id: string;
  patient_id: string;
  therapist_id: string;
  session_date: string;
  session_title: string;
  session_recording_url?: string | null;
  subjective: string;
  objective: string;
  assessment: string;
  assessment_links?: SoapNoteAssessmentLink[] | null;
  plan: string;
  client_summary: string;
  created_at: string;
  updated_at: string;
  // Joined
  therapist_profile?: Profile;
  patient?: Patient;
}

export interface Message {
  id: string;
  patient_id: string;
  sender_id: string;
  body: string;
  referenced_program_id: string | null;
  created_at: string;
  attachment_url?: string | null;
  attachment_storage_path?: string | null;
  attachment_type?: "image" | "video" | null;
  attachment_meta?: { w?: number; h?: number; size?: number; mime?: string } | null;
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
