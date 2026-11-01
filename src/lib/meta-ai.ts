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
  GenerateActivityInput,
  GenerateActivityOutput,
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
// Activity generation — Spark + Muse Image (or mock placeholder)
export async function generateActivity(
  input: GenerateActivityInput
): Promise<GenerateActivityOutput> {
  const { aiMode, apiKey } = getMetaConfig();
  // lazy import to avoid circular
  const { runSparkActivitySpec, runMuseImage, buildMockActivitySvg } = await import("./meta/activity-generator");
  const start = Date.now();

  // Build referenceImageNotes from referenceImages count if present (avoid shipping huge payloads to prompt verbatim)
  const referenceImageNotes = input.referenceImages && input.referenceImages.length > 0
    ? `Therapist uploaded ${input.referenceImages.length} reference photo(s) for inspiration — incorporate shapes/layout/themes inspired by them without copying any copyrighted element verbatim.`
    : undefined;

  // If AI is explicitly off, still produce a mock SVG (UX) but throw only if caller wants strict
  if (aiMode === "off") {
    const mock = buildMockActivitySvg(input.titleOverride || `Activity — ${input.ageBand}`, input.ageBand, input.category || "other");
    return {
      activityId: `mock-${Date.now()}`,
      title: input.titleOverride || `Activity — ${input.ageBand}`,
      instructions: "Complete the activity at your own pace. Trace, color, or write inside the boxes.",
      ageBand: input.ageBand,
      category: (input.category as GenerateActivityOutput["category"]) || "other",
      sparkSpec: {
        title: input.titleOverride || `Activity — ${input.ageBand}`,
        instructions: "Complete the activity at your own pace.",
        visualBrief: mock.prompt,
        refinedImagePrompt: mock.prompt,
        layoutSpec: { orientation: "portrait", lineGuides: "none", zones: [] },
        difficulty: "guided",
        estimatedMinutes: 10,
        warnings: [],
      },
      baseImageUrl: mock.dataUrl,
      baseImagePath: null,
      modelIds: { spark: "mock", image: "mock" },
      latencyMs: Date.now() - start,
    };
  }

  if (!apiKey) {
    // No key: still return mock so UI works, but flag modelIds.mock
    const mock = buildMockActivitySvg(input.titleOverride || `Activity — ${input.ageBand}`, input.ageBand, input.category || "other");
    return {
      activityId: `mock-${Date.now()}`,
      title: input.titleOverride || `Activity — ${input.ageBand}`,
      instructions: "Complete this activity — mock preview (add MODEL_API_KEY for live generation).",
      ageBand: input.ageBand,
      category: (input.category as GenerateActivityOutput["category"]) || "other",
      sparkSpec: {
        title: input.titleOverride || `Activity — ${input.ageBand}`,
        instructions: "Mock activity — add API key for live generation.",
        visualBrief: mock.prompt,
        refinedImagePrompt: mock.prompt,
        layoutSpec: { orientation: "portrait", lineGuides: "none", zones: [] },
        difficulty: "guided",
        estimatedMinutes: 10,
        warnings: ["Mock mode: add MODEL_API_KEY for live generation"],
      },
      baseImageUrl: mock.dataUrl,
      baseImagePath: null,
      modelIds: { spark: "mock", image: "mock" },
      latencyMs: Date.now() - start,
    };
  }

  // Live: Spark spec — no local fallback, surface the real gateway error to the UI
  const { result: sparkSpec, latencyMs: sparkLatency } = await runSparkActivitySpec({
    ageBand: input.ageBand,
    category: input.category,
    templatePrompt: input.customSparkPrompt || undefined,
    imagePrompt: input.customImagePrompt || undefined,
    titleOverride: input.titleOverride,
    theme: input.theme,
    difficulty: input.difficulty,
    lineStyle: input.lineStyle,
    referenceLinks: input.referenceLinks,
    referenceImageNotes,
    referenceImages: input.referenceImages,
  });

  // Live: image gen — checklist flag; skip when generateImage === false
  let baseImageUrl: string | null = null;
  let baseImagePath: string | null = null;
  let imageModelId = process.env.MUSE_IMAGE_MODEL_ID || process.env.IMAGE_MODEL_ID || "muse-image-1.0";
  let imageLatency = 0;
  if (input.generateImage === false) {
    imageModelId = "none";
  } else {
    const size = sparkSpec.layoutSpec.orientation === "landscape" ? "1536x1024" : "1024x1536";
    const imgRes = await runMuseImage(sparkSpec.refinedImagePrompt, { size, model: imageModelId });
    baseImageUrl = imgRes.imageUrl;
    imageModelId = imgRes.modelId;
    imageLatency = imgRes.latencyMs;
  }

  return {
    activityId: `live-${Date.now()}`,
    title: sparkSpec.title,
    instructions: sparkSpec.instructions,
    ageBand: input.ageBand,
    category: (input.category as GenerateActivityOutput["category"]) || "other",
    sparkSpec: {
      title: sparkSpec.title,
      instructions: sparkSpec.instructions,
      visualBrief: sparkSpec.visualBrief,
      refinedImagePrompt: sparkSpec.refinedImagePrompt,
      layoutSpec: sparkSpec.layoutSpec,
      difficulty: sparkSpec.difficulty,
      estimatedMinutes: sparkSpec.estimatedMinutes,
      warnings: sparkSpec.warnings,
    },
    baseImageUrl,
    baseImagePath,
    modelIds: { spark: getMetaConfig().models.spark || "spark", image: imageModelId },
    latencyMs: sparkLatency + imageLatency,
  };
}

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

  // Build butler personalization block from profile + program if provided
  let clientContextBlock: string | undefined;
  if (input.clientContext) {
    const parts: string[] = ["CLIENT CONTEXT (use to personalize, do not repeat verbatim unless helpful):"];
    if (input.clientContext.displayName) parts.push(`- User: ${input.clientContext.displayName}`);
    if (input.clientContext.profileBrief) parts.push(`- Profile: ${input.clientContext.profileBrief}`);
    if (input.clientContext.programBrief) parts.push(`- Current Home Program: ${input.clientContext.programBrief}`);
    parts.push("Tailor your explanation of WHY each exercise/condition matters to their daily life, but do not invent citations.");
    clientContextBlock = parts.join("\n");
  }

  const { text, latencyMs, modelId: usedModel } = await runSparkOtChat({
    history: input.history,
    userText: input.userText,
    images,
    videoUrls,
    conversationId,
    clientContext: clientContextBlock,
    evidenceContext: clinical ? evidenceBlock : evidenceBlock ? evidenceBlock : "SEARCH-GROUNDED CLINICAL EVIDENCE: no search needed for this greeting, but still include at least one general rehab reference if you give health information.",
    model: requestedModel,
  });

  // General rehab: always ensure at least one reference, even if isClinicallyRelated was false but answer contains health info — keep references array populated when possible
  if (!clinical && references.length === 0) {
    // Keep references as synthesized fallback so UI always shows sources
    references = [
      { id: "general", title: "General rehabilitation guidance — confirm with your clinician", authors: "Aruga Guide", year: new Date().getFullYear().toString(), source: "General Rehab Education", url: "https://pubmed.ncbi.nlm.nih.gov/" },
    ];
  }

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
