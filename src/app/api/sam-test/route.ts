import { NextRequest, NextResponse } from "next/server";
import { segmentStepVideoMulti } from "@/lib/meta-ai";
import { MetaApiError } from "@/lib/meta/errors";
import { getMetaConfig } from "@/lib/meta/client";
import { sam3Engine, normalizeConcepts } from "@/lib/meta/sam-engine";

const MAX_TARGETS = 100;
const MAX_VIDEO_DATA_URL_CHARS = 140_000_000; // ~100MB binary as base64

/**
 * Temporary SAM 3.1 test endpoint.
 * One textbox string ("cup, hand, block") is split on commas into multiple
 * text targets. Each target is a separate SAM concept via Sam3Engine
 * (segmentConcepts) — buildObjectPrompt is only for pre-located boxes/points
 * and cannot accept text, so text targets do not use it.
 */
export async function POST(req: NextRequest) {
  const start = Date.now();
  try {
    const body = await req.json();
    const promptText: string =
      typeof body?.promptText === "string" ? body.promptText : "";
    const rawConcepts: string[] = promptText
      ? promptText.split(",")
      : Array.isArray(body?.concepts)
        ? body.concepts.map((c: unknown) => String(c))
        : [];

    const conceptsInput = rawConcepts.map((c) => c.trim()).filter(Boolean);
    if (conceptsInput.length === 0) {
      return NextResponse.json(
        { error: "Type at least one target, separated by commas (e.g. cup, hand)." },
        { status: 400 }
      );
    }
    if (conceptsInput.length > MAX_TARGETS) {
      return NextResponse.json(
        { error: `Too many targets (max ${MAX_TARGETS}).` },
        { status: 400 }
      );
    }

    const videoUrl: string =
      typeof body?.videoUrl === "string" ? body.videoUrl : "";
    const videoDataUrl: string =
      typeof body?.videoDataUrl === "string" ? body.videoDataUrl : "";
    const samVideoUrl = videoUrl || videoDataUrl;

    if (!samVideoUrl) {
      return NextResponse.json(
        { error: "Upload a video first." },
        { status: 400 }
      );
    }
    if (videoDataUrl) {
      if (!videoDataUrl.toLowerCase().startsWith("data:video/")) {
        return NextResponse.json(
          { error: "Video must be a video data URL (video/mp4, video/webm)." },
          { status: 400 }
        );
      }
      if (videoDataUrl.length > MAX_VIDEO_DATA_URL_CHARS) {
        return NextResponse.json(
          { error: "Video is too large. Use a clip under 100 MB." },
          { status: 413 }
        );
      }
    }

    const durationSeconds =
      typeof body?.durationSeconds === "number" && Number.isFinite(body.durationSeconds)
        ? body.durationSeconds
        : undefined;

    const mediaWidth = Number(body?.mediaWidth);
    const mediaHeight = Number(body?.mediaHeight);
    const mediaSize =
      Number.isFinite(mediaWidth) && mediaWidth > 0 && Number.isFinite(mediaHeight) && mediaHeight > 0
        ? { width: Math.round(mediaWidth), height: Math.round(mediaHeight) }
        : undefined;

    // Validates each target (single noun phrase) and dedupes case-insensitively.
    const concepts = normalizeConcepts(conceptsInput);

    const { aiMode, apiKey, models } = getMetaConfig();
    if (aiMode === "off") {
      throw new MetaApiError(
        "SAM visual segmentation is disabled (AI_MODE=off).",
        "AI_DISABLED",
        400
      );
    }

    // Temporary test tab: call live SAM whenever a key is present, even if
    // AI_MODE=mock, so this page tests the real engine. Without a key it
    // falls back to the mock facade so the UI still demonstrates tracking.
    const fileName: string = typeof body?.fileName === "string" ? body.fileName : "video.mp4";
    const userId: string | undefined = typeof body?.userId === "string" ? body.userId : undefined;

    let responseData;
    if (apiKey) {
      const result = await sam3Engine.segmentConcepts({
        videoUrl: samVideoUrl,
        concepts,
        durationSeconds,
        mediaSize,
      });
      responseData = {
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
        mode: "live",
      };
    } else {
      const mock = await segmentStepVideoMulti({
        stepSubmissionId: `sam-test-${Date.now()}`,
        videoUrl: samVideoUrl,
        objectConcepts: concepts,
        durationSeconds,
        mediaSize,
      });
      responseData = { ...mock, mode: "mock" };
    }

    // Store in Supabase under the user if user is signed in
    if (userId) {
      try {
        const { createAdminClient } = await import("@/lib/supabase/admin");
        const admin = createAdminClient();
        if (admin) {
          const recentWindow = new Date(Date.now() - 5000).toISOString();
          const { data: existingRecent } = await admin
            .from("sam_test_results")
            .select("id")
            .eq("user_id", userId)
            .eq("prompt", promptText)
            .eq("file_name", fileName)
            .gte("created_at", recentWindow)
            .maybeSingle();

          if (!existingRecent) {
            await admin.from("sam_test_results").insert({
              user_id: userId,
              prompt: promptText,
              file_name: fileName,
              duration_seconds: durationSeconds ?? null,
              object_concepts: responseData.objectConcepts || [],
              tracks: responseData.tracks || [],
              boxes: responseData.boxes || [],
              svg_paths: responseData.svgPaths || [],
              billed_requests: responseData.billedRequests || 1,
              model_id: responseData.modelId || "sam-3.1",
              latency_ms: responseData.latencyMs || (Date.now() - start),
            });
          }
        }
      } catch (dbErr) {
        console.warn("[sam-test] Database persist skipped:", dbErr);
      }
    }

    return NextResponse.json(responseData);
  } catch (err: unknown) {
    const elapsed = Date.now() - start;
    if (err instanceof MetaApiError) {
      console.error(`[sam-test] ${err.code} after ${elapsed}ms: ${err.message}`);
      return NextResponse.json(
        { error: err.message, code: err.code },
        { status: err.statusCode || 500 }
      );
    }
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[sam-test] UNHANDLED after ${elapsed}ms: ${msg}`);
    return NextResponse.json({ error: msg || "SAM test failed." }, { status: 500 });
  }
}
