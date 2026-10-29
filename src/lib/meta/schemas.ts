import { z } from "zod";

// Schema for Muse Spark 1.3 Program Drafting
export const DraftProgramStepSchema = z.object({
  position: z.number().int().min(1),
  title: z.string().min(1).max(150),
  instructions: z.string().min(10).max(2000),
});

export const DraftProgramSchema = z.object({
  title: z.string().min(3).max(200),
  mainInstructions: z.string().min(10).max(2500),
  steps: z.array(DraftProgramStepSchema).min(1).max(10),
  warnings: z.array(z.string()).default([]),
});

export type DraftProgramParsed = z.infer<typeof DraftProgramSchema>;

// Schema for Muse Spark 1.3 Video Observations
export const VisibleObservationSchema = z.object({
  id: z.string(),
  description: z.string().min(5).max(500),
  approxTimestampSeconds: z.number().nullable().optional(),
  confidenceNote: z.string().optional(),
});

export const AnalyzeVideoSchema = z.object({
  observations: z.array(VisibleObservationSchema),
  limitations: z.array(z.string()).default([]),
  suggestedObjectConcept: z.string().nullable().optional(),
});

export type AnalyzeVideoParsed = z.infer<typeof AnalyzeVideoSchema>;

// Schema for Muse Spark 1.3 Therapist Feedback Drafting
export const DraftFeedbackSchema = z.object({
  draftStepNote: z.string().min(5).max(1500),
  overallFeedbackSuggestion: z.string().min(10).max(2500),
});

export type DraftFeedbackParsed = z.infer<typeof DraftFeedbackSchema>;

// Schema for SAM 3.1 Bounding Box and Result
export const SamBoxSchema = z.object({
  frameIndex: z.number().int().min(0),
  timestampSeconds: z.number().min(0),
  box: z.tuple([z.number(), z.number(), z.number(), z.number()]), // [ymin, xmin, ymax, xmax] normalized
  label: z.string(),
  objectId: z.string().optional(),
  confidence: z.number().min(0).max(1).optional(),
});

export const SamSvgPathSchema = z.object({
  frameIndex: z.number().int().min(0),
  path: z.string(),
  objectId: z.string().optional(),
  label: z.string().optional(),
});

export const SamResultSchema = z.object({
  objectConcept: z.string(),
  detectedFramesCount: z.number().int().min(0),
  boxes: z.array(SamBoxSchema),
  svgPaths: z.array(SamSvgPathSchema).optional(),
  durationAnalyzedSeconds: z.number().optional(),
});

export type SamResultParsed = z.infer<typeof SamResultSchema>;
