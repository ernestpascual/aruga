import { NextRequest, NextResponse } from "next/server";
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
// Global in-memory ring buffer for fallback and instant retrieval
interface StoredSamSession {
  id: string;
  user_id: string | null;
  prompt: string;
  file_name: string;
  duration_seconds: number | null;
  object_concepts: string[];
  tracks: unknown[];
  boxes: unknown[];
  svg_paths: unknown[];
  billed_requests: number;
  model_id: string;
  latency_ms: number;
  created_at: string;
}

const inMemorySessions: StoredSamSession[] = [];

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get("userId");
    const { createAdminClient } = await import("@/lib/supabase/admin");
    const admin = createAdminClient();

    let dbSessions: StoredSamSession[] = [];
    if (admin) {
      let query = admin
        .from("sam_test_results")
        .select(
          "id, user_id, prompt, file_name, duration_seconds, object_concepts, tracks, boxes, svg_paths, billed_requests, model_id, latency_ms, created_at"
        )
        .order("created_at", { ascending: false })
        .limit(50);

      if (userId) {
        query = query.or(`user_id.eq.${userId},user_id.is.null`);
      }

      const { data, error } = await query;
      if (!error && data) {
        dbSessions = data as StoredSamSession[];
      }
    }

    // Merge DB records and memory cache, deduplicating by id
    const seenIds = new Set(dbSessions.map((s) => s.id));
    const merged = [...dbSessions];
    for (const mem of inMemorySessions) {
      if (!seenIds.has(mem.id)) {
        merged.push(mem);
        seenIds.add(mem.id);
      }
    }

    merged.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    return NextResponse.json({ sessions: merged });
  } catch (err: unknown) {
    console.error("[sam-test GET] Failed to fetch sessions:", err);
    return NextResponse.json({ sessions: inMemorySessions });
  }
}

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

    const fileName: string = typeof body?.fileName === "string" ? body.fileName : "video.mp4";
    const userId: string | undefined = typeof body?.userId === "string" ? body.userId : undefined;

    if (!apiKey) {
      throw new MetaApiError(
        "MODEL_API_KEY is missing from environment. Real SAM API calls require an authenticated API key.",
        "MISSING_API_KEY",
        401
      );
    }

    const result = await sam3Engine.segmentConcepts({
      videoUrl: samVideoUrl,
      concepts,
      durationSeconds,
      mediaSize,
    });
    const responseData = {
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
      mode: "live" as const,
    };

    // Accurate total processing time
    const totalProcessingTimeMs = Date.now() - start;
    responseData.latencyMs = Math.round(totalProcessingTimeMs);
    (responseData as Record<string, unknown>).processingTimeMs = Math.round(totalProcessingTimeMs);

    const sessionRecord: StoredSamSession = {
      id: crypto.randomUUID(),
      user_id: userId || null,
      prompt: promptText,
      file_name: fileName,
      duration_seconds: durationSeconds ?? null,
      object_concepts: responseData.objectConcepts || [],
      tracks: responseData.tracks || [],
      boxes: responseData.boxes || [],
      svg_paths: responseData.svgPaths || [],
      billed_requests: responseData.billedRequests || 1,
      model_id: responseData.modelId || "sam-3.1",
      latency_ms: Math.round(totalProcessingTimeMs),
      created_at: new Date().toISOString(),
    };

    // Keep in-memory ring buffer
    inMemorySessions.unshift(sessionRecord);
    if (inMemorySessions.length > 50) {
      inMemorySessions.pop();
    }

    // Store in Supabase if admin is available
    try {
      const { createAdminClient } = await import("@/lib/supabase/admin");
      const admin = createAdminClient();
      if (admin) {
        await admin.from("sam_test_results").insert({
          user_id: userId || null,
          prompt: promptText,
          file_name: fileName,
          duration_seconds: durationSeconds ?? null,
          object_concepts: responseData.objectConcepts || [],
          tracks: responseData.tracks || [],
          boxes: responseData.boxes || [],
          svg_paths: responseData.svgPaths || [],
          billed_requests: responseData.billedRequests || 1,
          model_id: responseData.modelId || "sam-3.1",
          latency_ms: Math.round(totalProcessingTimeMs),
        });
      }
    } catch (dbErr) {
      console.warn("[sam-test] Database persist skipped:", dbErr);
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
