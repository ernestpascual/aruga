import { NextRequest, NextResponse } from "next/server";
import { analyzeStepVideo, segmentStepVideo } from "@/lib/meta-ai";
import { MetaApiError } from "@/lib/meta/errors";
import { getMockStore } from "@/lib/supabase/mock-store";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { stepSubmissionId, videoUrl, stepInstructions, stepTitle, runSam } = body;

    if (!stepSubmissionId || !stepInstructions) {
      return NextResponse.json(
        { error: "stepSubmissionId and stepInstructions are required" },
        { status: 400 }
      );
    }

    // 1. Analyze with Muse Spark 1.3
    const sparkAnalysis = await analyzeStepVideo({
      stepSubmissionId,
      videoUrl: videoUrl || "/demo/tabletop_exercise.mp4",
      stepInstructions,
      stepTitle,
    });

    // 2. Optionally segment with SAM 3.1 if an object concept is suggested or requested
    let samSegmentation = null;
    if (runSam !== false && sparkAnalysis.suggestedObjectConcept) {
      try {
        samSegmentation = await segmentStepVideo({
          stepSubmissionId,
          videoUrl: videoUrl || "/demo/tabletop_exercise.mp4",
          objectConcept: sparkAnalysis.suggestedObjectConcept,
        });
      } catch {
        // SAM failure is non-fatal; Muse Spark observations remain available
      }
    }

    // Persist to store if mock store is in use
    const store = getMockStore();
    const existingIndex = store.aiAnalyses.findIndex(
      (a) => a.step_submission_id === stepSubmissionId
    );

    const record = {
      id: existingIndex >= 0 ? store.aiAnalyses[existingIndex].id : `ai-${Date.now()}`,
      step_submission_id: stepSubmissionId,
      analysis_kind: "full_review" as const,
      model_id: samSegmentation ? "muse-spark-1.3 + sam-3.1" : "muse-spark-1.3",
      idempotency_key: `key-${stepSubmissionId}-v1`,
      prompt_version: "v1",
      processing_status: "completed" as const,
      spark_results: {
        observations: sparkAnalysis.observations.map((o) => ({
          id: o.id,
          description: o.description,
          approx_timestamp_seconds: o.approxTimestampSeconds,
          confirmed: false,
        })),
        limitations: sparkAnalysis.limitations,
        suggested_object_concept: sparkAnalysis.suggestedObjectConcept,
      },
      sam_results: samSegmentation
        ? {
            object_concept: samSegmentation.objectConcept,
            detected_frames_count: samSegmentation.detectedFramesCount,
            boxes: samSegmentation.boxes.map((b) => ({
              frame_index: b.frameIndex,
              timestamp_seconds: b.timestampSeconds,
              box: b.box,
              label: b.label,
              confidence: b.confidence,
            })),
            svg_paths: samSegmentation.svgPaths?.map((p) => ({
              frame_index: p.frameIndex,
              path: p.path,
            })),
            duration_analyzed_seconds: 14,
          }
        : null,
      artifact_path: samSegmentation?.artifactPath || null,
      confirmed_observations: [],
      timing_ms: sparkAnalysis.latencyMs + (samSegmentation?.latencyMs || 0),
      sanitized_error: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    if (existingIndex >= 0) {
      store.aiAnalyses[existingIndex] = record;
    } else {
      store.aiAnalyses.push(record);
    }

    try {
      const { createAdminClient } = await import("@/lib/supabase/admin");
      const admin = createAdminClient();
      if (admin) {
        await admin.from("ai_analyses").upsert(
          {
            step_submission_id: stepSubmissionId,
            analysis_kind: "full_review",
            model_id: samSegmentation ? "muse-spark-1.3 + sam-3.1" : "muse-spark-1.3",
            idempotency_key: `key-${stepSubmissionId}-v1`,
            prompt_version: "v1",
            processing_status: "completed",
            spark_results: record.spark_results,
            sam_results: record.sam_results,
            artifact_path: record.artifact_path,
            confirmed_observations: [],
            timing_ms: record.timing_ms,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "step_submission_id" }
        );
      }
    } catch {
      // Database persist optional if offline
    }

    return NextResponse.json({
      spark: sparkAnalysis,
      sam: samSegmentation,
      record,
    });
  } catch (err: unknown) {
    if (err instanceof MetaApiError) {
      return NextResponse.json(
        { error: err.message, code: err.code },
        { status: err.statusCode || 500 }
      );
    }
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
