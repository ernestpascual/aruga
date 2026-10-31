import "server-only";
import { getMetaConfig } from "./meta/client";
import { MetaApiError } from "./meta/errors";
import {
  runSparkDraftProgram,
  runSparkAnalyzeVideo,
  runSparkDraftFeedback,
  runSparkOtChat,
} from "./meta/spark";
import { runSamVideoSegmentation } from "./meta/sam";
import { sam3Engine } from "./meta/sam-engine";
import {
  isClinicallyRelated,
  searchClinicalEvidence,
  formatReferencesSection,
} from "./meta/grounding";
import { DEFAULT_OT_CHAT_MODEL, isOtChatModel } from "./meta/models";
import {
  DraftProgramInput,
  DraftProgramOutput,
  AnalyzeVideoInput,
  AnalyzeVideoOutput,
  SegmentVideoInput,
  SegmentVideoOutput,
  SegmentVideoMultiInput,
  SegmentVideoMultiOutput,
  DraftFeedbackInput,
  DraftFeedbackOutput,
  OtChatInput,
  OtChatOutput,
} from "@/types/meta";

/**
 * High-Level Application-Facing Meta AI Service
 * Strictly executes live AI functions against the configured model endpoints.
 * Never mocks AI functions or returns canned dummy data.
 */

// 1. DRAFT HOME PROGRAM (Muse Spark 1.3)
export async function draftHomeProgram(
  input: DraftProgramInput
): Promise<DraftProgramOutput> {
  const { aiMode, models, apiKey } = getMetaConfig();

  if (aiMode === "off") {
    throw new MetaApiError(
      "Meta AI assistant is currently disabled (AI_MODE=off). You can write or edit program steps manually.",
      "AI_DISABLED",
      400
    );
  }

  if (!apiKey) {
    throw new MetaApiError(
      "MODEL_API_KEY is missing from environment. Real Meta AI program drafting requires an authenticated API key.",
      "MISSING_API_KEY",
      401
    );
  }

  const { result, latencyMs } = await runSparkDraftProgram({
    rawInstructions: input.rawInstructions,
    discipline: input.discipline,
    currentTitle: input.currentTitle,
  });

  return {
    title: result.title,
    mainInstructions: result.mainInstructions,
    steps: result.steps.map((s) => ({
      position: s.position,
      title: s.title,
      instructions: s.instructions,
    })),
    warnings: result.warnings,
    modelId: models.spark,
    latencyMs,
  };
}

// 2. ANALYZE STEP VIDEO (Muse Spark 1.3)
export async function analyzeStepVideo(
  input: AnalyzeVideoInput
): Promise<AnalyzeVideoOutput> {
  const { aiMode, models, apiKey } = getMetaConfig();

  if (aiMode === "off") {
    throw new MetaApiError(
      "Meta AI analysis is currently disabled (AI_MODE=off).",
      "AI_DISABLED",
      400
    );
  }

  if (!apiKey) {
    throw new MetaApiError(
      "MODEL_API_KEY is missing from environment. Real Meta AI video analysis requires an authenticated API key.",
      "MISSING_API_KEY",
      401
    );
  }

  const { result, latencyMs } = await runSparkAnalyzeVideo({
    videoUrl: input.videoUrl,
    stepInstructions: input.stepInstructions,
    stepTitle: input.stepTitle,
    durationSeconds: input.durationSeconds,
  });

  return {
    stepSubmissionId: input.stepSubmissionId,
    observations: result.observations.map((obs) => ({
      id: obs.id,
      description: obs.description,
      approxTimestampSeconds: obs.approxTimestampSeconds ?? null,
      confidenceNote: obs.confidenceNote,
      confirmed: false,
    })),
    limitations: result.limitations,
    suggestedObjectConcept: result.suggestedObjectConcept ?? null,
    modelId: models.spark,
    latencyMs,
  };
}

// 3. SEGMENT STEP VIDEO (SAM 3.1)
export async function segmentStepVideo(
  input: SegmentVideoInput
): Promise<SegmentVideoOutput> {
  const { aiMode, models, apiKey } = getMetaConfig();

  if (aiMode === "off") {
    throw new MetaApiError(
      "SAM visual segmentation is disabled (AI_MODE=off).",
      "AI_DISABLED",
      400
    );
  }

  if (!apiKey) {
    throw new MetaApiError(
      "MODEL_API_KEY is missing from environment. Real SAM visual segmentation requires an authenticated API key.",
      "MISSING_API_KEY",
      401
    );
  }

  const { result, latencyMs } = await runSamVideoSegmentation({
    videoUrl: input.videoUrl,
    objectConcept: input.objectConcept,
    durationSeconds: input.durationSeconds,
    mediaSize: input.mediaSize,
  });

  return {
    stepSubmissionId: input.stepSubmissionId,
    objectConcept: result.objectConcept,
    detectedFramesCount: result.detectedFramesCount,
    boxes: result.boxes,
    svgPaths: result.svgPaths,
    modelId: models.sam,
    latencyMs,
  };
}

// 3b. SEGMENT STEP VIDEO — MULTIPLE CONCEPTS (SAM 3.1 Engine)
export async function segmentStepVideoMulti(
  input: SegmentVideoMultiInput
): Promise<SegmentVideoMultiOutput> {
  const { aiMode, models, apiKey } = getMetaConfig();

  if (aiMode === "off") {
    throw new MetaApiError(
      "SAM visual segmentation is disabled (AI_MODE=off).",
      "AI_DISABLED",
      400
    );
  }

  if (!apiKey) {
    throw new MetaApiError(
      "MODEL_API_KEY is missing from environment. Real SAM visual segmentation requires an authenticated API key.",
      "MISSING_API_KEY",
      401
    );
  }

  const result = await sam3Engine.segmentConcepts({
    videoUrl: input.videoUrl,
    concepts: input.objectConcepts,
    durationSeconds: input.durationSeconds,
    mediaSize: input.mediaSize,
  });

  return {
    stepSubmissionId: input.stepSubmissionId,
    objectConcepts: result.conceptsRequested,
    tracks: result.tracks.map((t) => ({
      trackId: t.trackId,
      label: t.label,
      objectId: t.objectId,
      frames: t.frames,
    })),
    boxes: result.boxes,
    svgPaths: result.svgPaths,
    failures: result.failures,
    billedRequests: result.billedRequests,
    modelId: models.sam,
    latencyMs: result.latencyMs,
  };
}

// 4. DRAFT THERAPIST FEEDBACK (Muse Spark 1.3)
export async function draftTherapistFeedback(
  input: DraftFeedbackInput
): Promise<DraftFeedbackOutput> {
  const { aiMode, models, apiKey } = getMetaConfig();

  if (aiMode === "off") {
    throw new MetaApiError(
      "Meta AI feedback drafting is disabled (AI_MODE=off).",
      "AI_DISABLED",
      400
    );
  }

  if (!apiKey) {
    throw new MetaApiError(
      "MODEL_API_KEY is missing from environment. Real Meta AI feedback drafting requires an authenticated API key.",
      "MISSING_API_KEY",
      401
    );
  }

  const { result, latencyMs } = await runSparkDraftFeedback({
    stepInstructions: input.stepInstructions,
    therapistNotes: input.therapistNotes,
    confirmedObservations: input.confirmedObservations,
    clientComment: input.clientComment,
    skipped: input.skipped,
    skipReason: input.skipReason,
  });

  return {
    draftStepNote: result.draftStepNote,
    overallFeedbackSuggestion: result.overallFeedbackSuggestion,
    modelId: models.spark,
    latencyMs,
  };
}

// 5. OT HELPER CHAT (Muse Spark 1.3, multimodal, prompt-cached, search-grounded)
export async function otChatAssistant(input: OtChatInput): Promise<OtChatOutput> {
  const { aiMode, models, apiKey } = getMetaConfig();
  const conversationId =
    input.conversationId?.trim() || `ot-${Date.now().toString(36)}`;
  const requestedModel =
    input.model && isOtChatModel(input.model)
      ? input.model
      : models.spark && isOtChatModel(models.spark)
        ? models.spark
        : DEFAULT_OT_CHAT_MODEL;

  if (aiMode === "off") {
    throw new MetaApiError(
      "OT Helper chat is currently disabled (AI_MODE=off).",
      "AI_DISABLED",
      400
    );
  }

  if (!apiKey) {
    throw new MetaApiError(
      "MODEL_API_KEY is missing from environment. Real OT Helper chat requires an authenticated API key.",
      "MISSING_API_KEY",
      401
    );
  }

  const attachments = (input.attachments || []).slice(0, 6);
  // Classify by actual data-URL MIME, not just `kind`: video clips arrive as
  // extracted JPEG frames (image data URLs), which must go down the image path.
  const images = attachments
    .filter((a) => a.dataUrl?.toLowerCase().startsWith("data:image/"))
    .map((a) => a.dataUrl)
    .filter(Boolean);
  const videoUrls = attachments
    .filter((a) => a.dataUrl?.toLowerCase().startsWith("data:video/"))
    .map((a) => a.dataUrl)
    .filter(Boolean);
  const hasMedia = images.length > 0 || videoUrls.length > 0;
  const clinical = isClinicallyRelated(input.userText, hasMedia);

  // Search grounding for every clinically related turn
  let evidenceQuery: string | undefined;
  let evidenceBlock = "";
  let references: OtChatOutput["references"] = [];
  if (clinical) {
    try {
      const evidence = await searchClinicalEvidence(input.userText);
      evidenceQuery = evidence.query;
      evidenceBlock = evidence.contextBlock;
      references = evidence.references;
    } catch {
      evidenceBlock =
        "SEARCH-GROUNDED CLINICAL EVIDENCE: live search errored for this turn. Give general educational information only and advise confirming with a licensed OT.";
    }
  }

  const { text, latencyMs, modelId: usedModel } = await runSparkOtChat({
    history: input.history,
    userText: input.userText,
    images,
    videoUrls,
    conversationId,
    evidenceContext: clinical ? evidenceBlock : undefined,
    model: requestedModel,
  });

  // Enforce the References contract even if the model omits it.
  let reply = text;
  if (clinical && references.length > 0 && !/references/i.test(reply)) {
    reply += formatReferencesSection(references);
  }

  return {
    reply,
    references,
    grounded: clinical,
    evidenceQuery,
    modelId: usedModel,
    latencyMs,
    conversationId,
  };
}
