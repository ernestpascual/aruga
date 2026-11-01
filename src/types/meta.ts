/**
 * Shared Browser-Safe Types for Meta AI Integration
 * Used across client and server without leaking server-only dependencies.
 */

export type AiMode = "off" | "live" | "mock";

export interface DraftProgramInput {
  rawInstructions: string;
  discipline?: "SLP" | "OT" | "PT";
  currentTitle?: string;
  existingSteps?: Array<{ title?: string; instructions: string }>;
}

export interface DraftProgramStepOutput {
  position: number;
  title: string;
  instructions: string;
}

export interface DraftProgramOutput {
  title: string;
  mainInstructions: string;
  steps: DraftProgramStepOutput[];
  warnings: string[];
  modelId: string;
  latencyMs: number;
}

export interface VisibleObservation {
  id: string;
  description: string;
  approxTimestampSeconds: number | null;
  confidenceNote?: string;
  confirmed?: boolean;
}

export interface AnalyzeVideoInput {
  stepSubmissionId: string;
  videoUrl: string;
  stepInstructions: string;
  stepTitle?: string;
  mimeType?: string;
  durationSeconds?: number;
}

export interface AnalyzeVideoOutput {
  stepSubmissionId: string;
  observations: VisibleObservation[];
  limitations: string[];
  suggestedObjectConcept: string | null;
  modelId: string;
  latencyMs: number;
}

export interface SamBox {
  frameIndex: number;
  timestampSeconds: number;
  box: [number, number, number, number]; // [ymin, xmin, ymax, xmax] normalized 0-1
  label: string;
  objectId?: string;
  confidence?: number;
}

export interface SamMaskPath {
  frameIndex: number;
  path: string;
  objectId?: string;
  label?: string;
}

export interface SegmentVideoInput {
  stepSubmissionId: string;
  videoUrl: string;
  objectConcept: string;
  durationSeconds?: number;
  /** Source video size in pixels; required to normalize SAM pixel coords to 0-1. */
  mediaSize?: { width: number; height: number };
}

export interface SegmentVideoOutput {
  stepSubmissionId: string;
  objectConcept: string;
  detectedFramesCount: number;
  boxes: SamBox[];
  svgPaths?: SamMaskPath[];
  artifactPath?: string;
  modelId: string;
  latencyMs: number;
  unsupportedReason?: string;
}

export interface SegmentVideoMultiInput {
  stepSubmissionId: string;
  videoUrl: string;
  /** Distinct concepts, e.g. ["dog", "person in white"]. One API request each. */
  objectConcepts: string[];
  durationSeconds?: number;
  /** Source video size in pixels; required to normalize SAM pixel coords to 0-1. */
  mediaSize?: { width: number; height: number };
}

export interface SegmentVideoMultiOutput {
  stepSubmissionId: string;
  /** Concepts actually requested (deduped). */
  objectConcepts: string[];
  tracks: Array<{
    trackId: string;
    label: string;
    objectId?: string;
    frames: number[];
  }>;
  boxes: SamBox[];
  svgPaths?: SamMaskPath[];
  failures: Array<{ concept: string; code: string; message: string }>;
  /** Billed SAM /responses requests (0 for mock / cache-served concepts). */
  billedRequests: number;
  modelId: string;
  latencyMs: number;
}

export interface DraftFeedbackInput {
  stepSubmissionId?: string;
  stepInstructions: string;
  therapistNotes: string;
  confirmedObservations: string[];
  clientComment?: string;
  skipped?: boolean;
  skipReason?: string;
}

export interface DraftFeedbackOutput {
  draftStepNote: string;
  overallFeedbackSuggestion: string;
  modelId: string;
  latencyMs: number;
}

export interface AiProvenance {
  model: string;
  purpose: string;
  isMock: boolean;
  timestamp: string;
}

export interface OtChatTurn {
  role: "user" | "assistant";
  content: string;
}

export interface OtChatAttachment {
  kind: "image" | "video";
  dataUrl: string;
  mimeType?: string;
  name?: string;
}

export interface OtChatInput {
  history: OtChatTurn[];
  userText: string;
  attachments?: OtChatAttachment[];
  conversationId?: string;
  /** Model ID for /aruga-guide. Must be one of OT_CHAT_MODELS; defaults server-side. */
  model?: string;
  /** Butler context: lightweight profile + active home program summary for personalized explanations */
  clientContext?: {
    profileBrief?: string;
    programBrief?: string;
    displayName?: string;
  };
}

export interface OtChatReference {
  id: string;
  title: string;
  authors: string;
  year: string;
  source: string;
  url: string;
}

export interface OtChatOutput {
  reply: string;
  references: OtChatReference[];
  grounded: boolean;
  evidenceQuery?: string;
  modelId: string;
  latencyMs: number;
  conversationId: string;
}

// Activity generation (Muse Spark + Muse Image)
export type ActivityAgeBand = "pedia" | "adolescent" | "adult" | "geriatric";
export type ActivityCategoryMeta = "coloring" | "handwriting" | "tracing" | "maze" | "matching" | "cognitive" | "adl_sim" | "visual_motor" | "fine_motor" | "other";

export interface GenerateActivityInput {
  templateId?: string;
  ageBand: ActivityAgeBand;
  category?: ActivityCategoryMeta;
  titleOverride?: string;
  theme?: string;
  difficulty?: string;
  lineStyle?: string;
  customSparkPrompt?: string;
  customImagePrompt?: string;
  referenceLinks?: string[];
  referenceImages?: string[]; // data URLs or http URLs
  patientId?: string;
  generateImage?: boolean; // when false, skip Muse Image (text-only worksheet)
}

export interface GenerateActivityOutput {
  activityId: string;
  title: string;
  instructions: string;
  ageBand: ActivityAgeBand;
  category: ActivityCategoryMeta;
  sparkSpec: {
    title: string;
    instructions: string;
    visualBrief: string;
    refinedImagePrompt: string;
    layoutSpec: { orientation: "portrait" | "landscape"; lineGuides: string; zones: Array<{ label: string; type: string }> };
    difficulty: string;
    estimatedMinutes: number;
    warnings: string[];
  };
  baseImageUrl: string | null;
  baseImagePath: string | null;
  modelIds: Record<string, string>;
  latencyMs: number;
}
