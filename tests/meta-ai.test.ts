import { describe, it, expect } from "vitest";
import {
  DraftProgramSchema,
  AnalyzeVideoSchema,
  DraftFeedbackSchema,
  SamResultSchema,
} from "../src/lib/meta/schemas";
import {
  draftHomeProgram,
  analyzeStepVideo,
  segmentStepVideo,
  draftTherapistFeedback,
} from "../src/lib/meta-ai";
import {
  MetaRefusalError,
  MetaRateLimitError,
  MissingConsentError,
} from "../src/lib/meta/errors";

describe("Meta AI Muse Spark 1.3 Schemas & Prompts", () => {
  it("validates structured program drafting schema strictly", () => {
    const validOutput = {
      title: "Tabletop Grasp and Release",
      mainInstructions: "Perform once daily in seated position.",
      steps: [
        {
          position: 1,
          title: "Alignment",
          instructions: "Sit upright with forearms supported.",
        },
        {
          position: 2,
          title: "Grasp",
          instructions: "Reach toward cup and gently secure grasp.",
        },
      ],
      warnings: ["Check wrist tolerance."],
    };

    const parsed = DraftProgramSchema.safeParse(validOutput);
    expect(parsed.success).toBe(true);
  });

  it("rejects program output with missing steps or invalid positions", () => {
    const invalid = {
      title: "Routine",
      mainInstructions: "Instructions",
      steps: [], // empty steps
      warnings: [],
    };
    const parsed = DraftProgramSchema.safeParse(invalid);
    expect(parsed.success).toBe(false);
  });

  it("validates observable visual activities without clinical scoring", () => {
    const validAnalysis = {
      observations: [
        {
          id: "obs-1",
          description: "Subject reaches forward with right hand toward a cup.",
          approxTimestampSeconds: 2.5,
        },
      ],
      limitations: ["Camera positioned obliquely."],
      suggestedObjectConcept: "cup",
    };

    const parsed = AnalyzeVideoSchema.safeParse(validAnalysis);
    expect(parsed.success).toBe(true);
  });

  it("validates therapist feedback schema with confirmed observations", () => {
    const validFeedback = {
      draftStepNote: "Smooth cylindrical grasp observed.",
      overallFeedbackSuggestion: "Great work maintaining posture today.",
    };

    const parsed = DraftFeedbackSchema.safeParse(validFeedback);
    expect(parsed.success).toBe(true);
  });
});

describe("Meta AI SAM 3.1 Schemas & Tracking", () => {
  it("validates normalized bounding box format [ymin, xmin, ymax, xmax]", () => {
    const validSam = {
      objectConcept: "cup",
      detectedFramesCount: 2,
      boxes: [
        {
          frameIndex: 0,
          timestampSeconds: 0.0,
          box: [0.3, 0.4, 0.6, 0.7] as [number, number, number, number],
          label: "cup",
          confidence: 0.96,
        },
      ],
      durationAnalyzedSeconds: 14,
    };

    const parsed = SamResultSchema.safeParse(validSam);
    expect(parsed.success).toBe(true);
  });
});

describe("Meta AI Service Application Interface (Mock & Isolation)", () => {
  it("drafts structured program through draftHomeProgram", async () => {
    const result = await draftHomeProgram({
      rawInstructions: "Do tabletop cup reaches, grasp, lift 3 inches, hold 2 seconds, release.",
      discipline: "OT",
    });

    expect(result.title).toBeDefined();
    expect(result.steps.length).toBeGreaterThanOrEqual(1);
    expect(result.modelId).toContain("muse-spark-1.");
  });

  it("analyzes step video returning tentative observations and object concept", async () => {
    const result = await analyzeStepVideo({
      stepSubmissionId: "sub-step-1",
      videoUrl: "/demo/cup_grasp_transfer.mp4",
      stepInstructions: "Reach and grasp cup.",
    });

    expect(result.observations.length).toBeGreaterThan(0);
    expect(result.suggestedObjectConcept).toBe("cup");
  });

  it("segments video returning SAM tracking boxes", async () => {
    const result = await segmentStepVideo({
      stepSubmissionId: "sub-step-1",
      videoUrl: "/demo/cup_grasp_transfer.mp4",
      objectConcept: "cup",
    });

    expect(result.boxes.length).toBeGreaterThan(0);
    expect(result.boxes[0].box).toHaveLength(4);
    expect(result.objectConcept).toBe("cup");
  });

  it("drafts therapist feedback with confirmed observations", async () => {
    const result = await draftTherapistFeedback({
      stepInstructions: "Cylindrical grasp on tabletop cup.",
      therapistNotes: "Wrist alignment improved.",
      confirmedObservations: ["Active cylindrical grasp achieved."],
    });

    expect(result.draftStepNote).toContain("Wrist alignment");
    expect(result.overallFeedbackSuggestion).toBeDefined();
  });
});
