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
 * Handles AI_MODE ('live' | 'mock' | 'off') deterministically.
 */

// 1. DRAFT HOME PROGRAM
export async function draftHomeProgram(
  input: DraftProgramInput
): Promise<DraftProgramOutput> {
  const { aiMode, models } = getMetaConfig();

  if (aiMode === "off") {
    throw new MetaApiError(
      "Meta AI assistant is currently disabled (AI_MODE=off). You can write or edit program steps manually.",
      "AI_DISABLED",
      400
    );
  }

  if (aiMode === "live") {
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

  // MOCK MODE: Clinically coherent restructuring
  const rawLower = input.rawInstructions.toLowerCase();
  const isPediatric =
    rawLower.includes("pediatric") ||
    rawLower.includes("child") ||
    rawLower.includes("kid") ||
    rawLower.includes("play") ||
    rawLower.includes("peg") ||
    rawLower.includes("pincer") ||
    rawLower.includes("toy");
  const isSpeech = input.discipline === "SLP" || rawLower.includes("speech") || rawLower.includes("voice") || rawLower.includes("vocal");
  const isCupExercise = rawLower.includes("cup") || rawLower.includes("grasp") || rawLower.includes("tabletop");

  let suggestedTitle = input.currentTitle || "Structured Tabletop Rehabilitation Routine";
  let mainInstructions = "Perform these exercises once daily in a well-supported seated position. Focus on steady, unhurried movements.";
  let steps = [
    {
      position: 1,
      title: "Preparation & Posture Alignment",
      instructions: "Sit upright with feet flat on the floor. Rest both forearms comfortably on the table surface to stabilize your shoulders.",
    },
    {
      position: 2,
      title: "Target Grasp and Controlled Lift",
      instructions: "Reach toward the tabletop object with steady finger extension. Secure a gentle grasp, lift 3 inches vertically, hold for 2 seconds, and release gently without tipping.",
    },
    {
      position: 3,
      title: "Release and Return to Neutral",
      instructions: "Slowly release your fingers completely from the object. Return hand and forearm to the resting table position and take a calm breath.",
    },
  ];

  if (isPediatric) {
    suggestedTitle = "Playful Pincer Grasp & Bilateral Play Routine";
    mainInstructions = "Complete these 3 playful tabletop activities together with a parent or caregiver once daily. Keep exercises fun, gentle, and encouraging.";
    steps = [
      {
        position: 1,
        title: "Colorful Peg Stacking Game",
        instructions: "Have the child use thumb and index finger (pincer grasp) to pick up 5 colorful pegs and place them into the board. Encourage keeping the helper hand steady on the table.",
      },
      {
        position: 2,
        title: "Play-Doh Bead Roll & Squash",
        instructions: "Roll three small dough balls between palms or fingers, then have the child squash each one flat with their pointer finger.",
      },
      {
        position: 3,
        title: "Two-Handed Lid Unscrewing",
        instructions: "Hold the plastic jar base steady with the non-dominant helper hand while gently turning the lid with the dominant hand.",
      },
    ];
  } else if (isSpeech) {
    suggestedTitle = "Vocal Resonance & Sustained Phonation Routine";
    mainInstructions = "Complete these 3 structured vocal exercises in a quiet room. Stop and rest if your throat feels strained or tired.";
    steps = [
      {
        position: 1,
        title: "Diaphragmatic Breath & Postural Check",
        instructions: "Place one hand on your abdomen. Inhale slowly through your nose for 3 seconds, letting your abdomen gently expand without raising your shoulders.",
      },
      {
        position: 2,
        title: "Sustained Open Vowel Phonation",
        instructions: "On a comfortable pitch, produce a relaxed 'ah' sound at conversational volume for 5-8 seconds. Keep pitch steady and natural.",
      },
      {
        position: 3,
        title: "Pitch Glide from Comfortable Mid-Range to High",
        instructions: "Glide smoothly upward on an 'oo' sound like a gentle siren. Keep facial muscles relaxed without straining your neck.",
      },
    ];
  } else if (!isCupExercise && input.rawInstructions.length > 20) {
    // Break therapist's rough instructions into numbered points if available
    const rawLines = input.rawInstructions.split(/\n+/).filter((l) => l.trim().length > 0);
    if (rawLines.length >= 2) {
      steps = rawLines.slice(0, 4).map((line, idx) => ({
        position: idx + 1,
        title: `Step ${idx + 1}: ${line.slice(0, 30)}...`,
        instructions: line.trim(),
      }));
    }
  }

  return {
    title: suggestedTitle,
    mainInstructions,
    steps,
    warnings: [
      "Review instructions to ensure pacing and repetitions match the client's current tolerance.",
    ],
    modelId: `${models.spark} (mock)`,
    latencyMs: 420,
  };
}

// 2. ANALYZE STEP VIDEO (Muse Spark 1.3)
export async function analyzeStepVideo(
  input: AnalyzeVideoInput
): Promise<AnalyzeVideoOutput> {
  const { aiMode, models } = getMetaConfig();

  if (aiMode === "off") {
    throw new MetaApiError(
      "Meta AI analysis is currently disabled (AI_MODE=off).",
      "AI_DISABLED",
      400
    );
  }

  if (aiMode === "live") {
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

  // MOCK MODE
  const instLower = input.stepInstructions.toLowerCase();
  let suggestedObject: string | null = "cup";
  if (instLower.includes("block")) suggestedObject = "block";
  else if (instLower.includes("washcloth")) suggestedObject = "washcloth";
  else if (instLower.includes("speech") || instLower.includes("voice")) suggestedObject = null;

  return {
    stepSubmissionId: input.stepSubmissionId,
    observations: [
      {
        id: "obs-1",
        description: "Subject initiates forward reach with right upper extremity toward the tabletop target.",
        approxTimestampSeconds: 2.2,
        confirmed: false,
      },
      {
        id: "obs-2",
        description: "Active cylindrical grasp formed around the object with sustained tabletop contact.",
        approxTimestampSeconds: 4.8,
        confirmed: false,
      },
      {
        id: "obs-3",
        description: "Vertical elevation of object achieved approximately 3 inches above table surface.",
        approxTimestampSeconds: 7.5,
        confirmed: false,
      },
      {
        id: "obs-4",
        description: "Descent and controlled release observed with minimal compensatory trunk tilt.",
        approxTimestampSeconds: 10.9,
        confirmed: false,
      },
    ],
    limitations: [
      "Camera positioned at approximately 45-degree oblique angle; slight finger occlusion during initial touch.",
      "Estimated 30fps clip duration 14.0s.",
    ],
    suggestedObjectConcept: suggestedObject,
    modelId: `${models.spark} (mock)`,
    latencyMs: 650,
  };
}

// 3. SEGMENT STEP VIDEO (SAM 3.1)
export async function segmentStepVideo(
  input: SegmentVideoInput
): Promise<SegmentVideoOutput> {
  const { aiMode, models } = getMetaConfig();

  if (aiMode === "off") {
    throw new MetaApiError(
      "SAM visual segmentation is disabled (AI_MODE=off).",
      "AI_DISABLED",
      400
    );
  }

  if (aiMode === "live") {
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

  // MOCK MODE: Generates clean, normalized bounding boxes & SVG masks tracking object
  const concept = input.objectConcept || "cup";
  const duration = input.durationSeconds || 14;
  const boxes = [
    { frameIndex: 0, timestampSeconds: 0.0, box: [0.42, 0.48, 0.72, 0.62] as [number, number, number, number], label: concept, confidence: 0.94 },
    { frameIndex: 1, timestampSeconds: 2.0, box: [0.42, 0.48, 0.72, 0.62] as [number, number, number, number], label: concept, confidence: 0.95 },
    { frameIndex: 2, timestampSeconds: 4.5, box: [0.41, 0.48, 0.71, 0.62] as [number, number, number, number], label: concept, confidence: 0.96 },
    { frameIndex: 3, timestampSeconds: 6.0, box: [0.32, 0.48, 0.62, 0.62] as [number, number, number, number], label: concept, confidence: 0.96 },
    { frameIndex: 4, timestampSeconds: 8.0, box: [0.30, 0.48, 0.60, 0.62] as [number, number, number, number], label: concept, confidence: 0.97 },
    { frameIndex: 5, timestampSeconds: 10.0, box: [0.38, 0.48, 0.68, 0.62] as [number, number, number, number], label: concept, confidence: 0.95 },
    { frameIndex: 6, timestampSeconds: 12.0, box: [0.42, 0.48, 0.72, 0.62] as [number, number, number, number], label: concept, confidence: 0.94 },
    { frameIndex: 7, timestampSeconds: 14.0, box: [0.42, 0.48, 0.72, 0.62] as [number, number, number, number], label: concept, confidence: 0.93 },
  ];

  // Normalized 0-1 coordinates (same convention as live SAM output).
  const svgPaths = [
    { frameIndex: 3, path: "M0.48 0.32 L0.62 0.32 L0.61 0.62 L0.49 0.62 Z" },
    { frameIndex: 4, path: "M0.48 0.30 L0.62 0.30 L0.61 0.60 L0.49 0.60 Z" },
  ];

  return {
    stepSubmissionId: input.stepSubmissionId,
    objectConcept: concept,
    detectedFramesCount: boxes.length,
    boxes,
    svgPaths,
    artifactPath: `ai-artifacts/mock-sam-${input.stepSubmissionId}.json`,
    modelId: `${models.sam} (mock)`,
    latencyMs: 820,
  };
}

// 3b. SEGMENT STEP VIDEO — MULTIPLE CONCEPTS (SAM 3.1 Engine)
// Each distinct concept is one billed SAM request; the engine dedupes,
// bounds concurrency, isolates failures, and merges labeled tracks.
export async function segmentStepVideoMulti(
  input: SegmentVideoMultiInput
): Promise<SegmentVideoMultiOutput> {
  const { aiMode, models } = getMetaConfig();

  if (aiMode === "off") {
    throw new MetaApiError(
      "SAM visual segmentation is disabled (AI_MODE=off).",
      "AI_DISABLED",
      400
    );
  }

  if (aiMode === "live") {
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

  // MOCK MODE: reuse the single-concept mock per concept and merge.
  const start = Date.now();
  const mergedBoxes: SegmentVideoMultiOutput["boxes"] = [];
  const mergedPaths: NonNullable<SegmentVideoMultiOutput["svgPaths"]> = [];
  const tracks: SegmentVideoMultiOutput["tracks"] = [];
  for (const concept of [...new Set(input.objectConcepts.map((c) => c.trim().toLowerCase()).filter(Boolean))]) {
    const single = await segmentStepVideo({
      stepSubmissionId: input.stepSubmissionId,
      videoUrl: input.videoUrl,
      objectConcept: concept,
      durationSeconds: input.durationSeconds,
    });
    mergedBoxes.push(...single.boxes);
    mergedPaths.push(...(single.svgPaths ?? []));
    tracks.push({
      trackId: `${concept}:mock`,
      label: concept,
      objectId: "mock",
      frames: [...new Set(single.boxes.map((b) => b.frameIndex))],
    });
  }
  return {
    stepSubmissionId: input.stepSubmissionId,
    objectConcepts: tracks.map((t) => t.label),
    tracks,
    boxes: mergedBoxes,
    svgPaths: mergedPaths,
    failures: [],
    billedRequests: 0,
    modelId: `${models.sam} (mock)`,
    latencyMs: Date.now() - start,
  };
}

// 4. DRAFT THERAPIST FEEDBACK (Muse Spark 1.3)
export async function draftTherapistFeedback(
  input: DraftFeedbackInput
): Promise<DraftFeedbackOutput> {
  const { aiMode, models } = getMetaConfig();

  if (aiMode === "off") {
    throw new MetaApiError(
      "Meta AI feedback drafting is disabled (AI_MODE=off).",
      "AI_DISABLED",
      400
    );
  }

  if (aiMode === "live") {
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

  // MOCK MODE
  if (input.skipped) {
    return {
      draftStepNote: `Step skipped by client (${input.skipReason || "fatigue"}). Good self-monitoring. Rest acknowledged.`,
      overallFeedbackSuggestion: `Thank you for completing your home exercises. I noticed you opted to rest on the final step—that was exactly the right choice. Honoring muscle fatigue protects joint alignment and prevents compensatory strain.`,
      modelId: `${models.spark} (mock)`,
      latencyMs: 390,
    };
  }

  const notesText = input.therapistNotes.trim();
  const stepNote = notesText
    ? `Clinician observation: ${notesText}. Active grasp and release trajectory maintained.`
    : "Steady progress on object grasp and elevation. Controlled tabletop release demonstrated.";

  return {
    draftStepNote: stepNote,
    overallFeedbackSuggestion:
      "Excellent practice session today. Your active finger extension and vertical lift showed notable control and steady posture. Keep practicing once daily with steady, deliberate pacing.",
    modelId: `${models.spark} (mock)`,
    latencyMs: 440,
  };
}

// 5. OT HELPER CHAT (Muse Spark 1.3, multimodal, prompt-cached, search-grounded)
// NOTE for /ask-ot: this always talks to live Meta AI when MODEL_API_KEY is
// present (even if AI_MODE=mock), so the chat never returns dummy answers.
// Mock is only a fallback for local dev/test without a key.
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

  // Search grounding for every clinically related turn (live AND mock so the
  // UX contract — always references when clinical — holds in all modes).
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

  if (aiMode === "live" || !!apiKey) {
    if (!apiKey) {
      throw new MetaApiError(
        "MODEL_API_KEY is missing. Add it to your environment to talk to live Muse Spark 1.3.",
        "MISSING_API_KEY",
        401
      );
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

  // MOCK FALLBACK (only when no API key is configured, e.g. local tests).
  // Never used in production once MODEL_API_KEY is set.
  const mediaNote =
    hasMedia && !clinical
      ? ""
      : hasMedia
        ? ` I can tentatively see ${images.length > 0 ? `${images.length} image(s)` : ""}${images.length > 0 && videoUrls.length > 0 ? " and " : ""}${videoUrls.length > 0 ? `${videoUrls.length} video clip(s)` : ""} attached — I describe only what is tentatively observable and note limits like lighting or camera angle.`
        : "";
  const mockBody = clinical
    ? `In simple terms, small and calm practice steps often help.${mediaNote}\n\nFor example, at mealtime you could put a few soft pieces of food on the table and pick them up one by one.\n\n- Keep it short and stop if it hurts or feels tiring.\n\nWant an idea for playtime or for mealtimes?`
    : `Hi!${mediaNote} Ask me about everyday things like eating, dressing, school, work, or play.`;

  const mockReply =
    `${mockBody}\n\nPlease check this with your own OT first — I'm a bot, not a registered OT, and I can be wrong.` +
    (clinical ? formatReferencesSection(references) : "");

  return {
    reply: mockReply,
    references,
    grounded: clinical,
    evidenceQuery,
    modelId: `${models.spark} (mock)`,
    latencyMs: 380,
    conversationId,
  };
}
