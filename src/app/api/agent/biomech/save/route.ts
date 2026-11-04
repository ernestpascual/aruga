import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const maxDuration = 30;

/**
 * POST /api/agent/biomech/save — persist a therapist-reviewed Biomechanic Agent result
 * Body: { submissionId, stepSubmissionId, prescribedTitle?, prescribedInstructions?, therapistNeed?, ageBand?, result }
 * Upserts into biomech_jobs (intent AGENT) so the review can reload it instantly without re-running SAM+Modal.
 *
 * GET /api/agent/biomech/save?stepSubmissionId= — latest saved result for this step (cache check)
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const stepSubmissionId = searchParams.get("stepSubmissionId");
    if (!stepSubmissionId) return NextResponse.json({ error: "stepSubmissionId required" }, { status: 400 });
    const admin = createAdminClient();
    if (!admin) return NextResponse.json({ error: "Supabase not configured" }, { status: 500 });
    const { data, error } = await admin
      .from("biomech_jobs")
      .select("id, submission_id, step_submission_id, intent, concepts, status, mhr_result, timing_ms, created_at, updated_at")
      .eq("step_submission_id", stepSubmissionId)
      .eq("status", "completed")
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!data) return NextResponse.json({ saved: null });
    // Heavy per-frame 3D + SAM masks live in Storage (too big for the row) — mint a short-lived link
    let artifactUrl: string | null = null;
    try {
      const art = (data.mhr_result as any)?.artifact;
      if (art?.bucket && art?.path) {
        const { data: signed } = await admin.storage.from(art.bucket).createSignedUrl(art.path, 600);
        artifactUrl = signed?.signedUrl || null;
      }
    } catch {}
    return NextResponse.json({ saved: { ...data, artifactUrl } });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { submissionId, stepSubmissionId, prescribedTitle, prescribedInstructions, therapistNeed, ageBand, result } = body as {
      submissionId?: string;
      stepSubmissionId?: string;
      prescribedTitle?: string;
      prescribedInstructions?: string;
      therapistNeed?: string;
      ageBand?: string;
      result?: unknown;
    };
    if (!submissionId || !stepSubmissionId) {
      return NextResponse.json({ error: "submissionId and stepSubmissionId required" }, { status: 400 });
    }
    if (!result || typeof result !== "object") {
      return NextResponse.json({ error: "result (agent output) required — run analysis first, review it, then save." }, { status: 400 });
    }
    const admin = createAdminClient();
    if (!admin) return NextResponse.json({ error: "Supabase not configured" }, { status: 500 });

    const r = result as Record<string, unknown>;
    const concepts = (Array.isArray(r.concepts) ? (r.concepts as unknown[]).map(String) : []) as string[];
    const timingMs =
      typeof (r.meta as Record<string, unknown> | undefined)?.processingMs === "number"
        ? ((r.meta as Record<string, unknown>).processingMs as number)
        : null;

    // Storage-first slimming: the Postgres row must stay small and CONSTANT-size
    // (<~90 KB) no matter how long the clip is, or the upsert hits statement
    // timeouts. So the row carries NO replay blobs at all — no SAM boxes, no SVG
    // mask paths, no tracks, no 3D keypoints. Those live only in the Storage
    // artifact (AGENT.json) and are merged back over the row on load
    // (see mergeBiomechArtifact). The row keeps what lists/summaries render:
    // summary, flags, angles-only frames (stride-sampled), insights, plan.
    function sampleEvery<T>(arr: T[], max: number): T[] {
      if (arr.length <= max) return arr;
      const step = arr.length / max;
      const out: T[] = [];
      for (let i = 0; i < max; i++) out.push(arr[Math.floor(i * step)]);
      return out;
    }
    function slimForStorage(input: Record<string, unknown>): Record<string, unknown> {
      const out: Record<string, unknown> = {};
      if (input.plan && typeof input.plan === "object") {
        const p = input.plan as Record<string, unknown>;
        out.plan = {
          source: p.source,
          rationale: p.rationale,
          latencyMs: p.latencyMs,
          dropped: Array.isArray(p.dropped) ? (p.dropped as unknown[]).slice(0, 8) : [],
          perConceptUse: Array.isArray(p.perConceptUse) ? (p.perConceptUse as unknown[]).slice(0, 8) : [],
        };
      }
      if (Array.isArray(input.concepts)) out.concepts = (input.concepts as unknown[]).map(String).slice(0, 8);
      if (input.sam && typeof input.sam === "object") {
        const s = input.sam as Record<string, unknown>;
        const failures = Array.isArray(s.failures) ? (s.failures as unknown[]).slice(0, 10) : [];
        out.sam = {
          billedRequests: s.billedRequests,
          latencyMs: s.latencyMs,
          // Counts only — boxes/svgPaths/tracks are replay blobs, Storage-only.
          boxCount: Array.isArray(s.boxes) ? s.boxes.length : 0,
          pathCount: Array.isArray(s.svgPaths) ? s.svgPaths.length : 0,
          trackCount: Array.isArray(s.tracks) ? s.tracks.length : 0,
          failures,
        };
      }
      if (input.mhr && typeof input.mhr === "object") {
        const m = input.mhr as Record<string, unknown>;
        const allFrames = Array.isArray(m.frames) ? (m.frames as Array<Record<string, unknown>>) : [];
        // Angles-only, stride-sampled across the whole clip (never head-sliced).
        const frames = sampleEvery(allFrames, 24).map((f) => ({
          frameIndex: f.frameIndex,
          timestampSeconds: f.timestampSeconds,
          angles: f.angles,
          flags: f.flags,
          confidence: f.confidence,
        }));
        out.mhr = { summary: m.summary, flags: m.flags, frames, frameCount: allFrames.length, modelId: m.modelId, processingMs: m.processingMs };
      }
      if (Array.isArray(input.insights)) out.insights = (input.insights as unknown[]).slice(0, 12);
    if (input.analysis && typeof input.analysis === "object") {
      const a = input.analysis as Record<string, unknown>;
      out.analysis = {
        movementAnalysis: a.movementAnalysis,
        targets: Array.isArray(a.targets) ? (a.targets as unknown[]).slice(0, 8) : [],
        watchFor: Array.isArray(a.watchFor) ? (a.watchFor as unknown[]).slice(0, 8) : [],
        candidateConcepts: Array.isArray(a.candidateConcepts) ? (a.candidateConcepts as unknown[]).slice(0, 8) : [],
      };
    }
      if (input.adherence && typeof input.adherence === "object") out.adherence = input.adherence;
      if (input.trend) out.trend = input.trend;
      if (input.meta && typeof input.meta === "object") {
        const mt = input.meta as Record<string, unknown>;
        out.meta = { processingMs: mt.processingMs, source: mt.source, prescribedTitle: mt.prescribedTitle, ageBand: mt.ageBand };
      }
      return out;
    }

    // Heavy replay blobs (full per-frame 3D/2D keypoints + SAM masks) go to Storage —
    // they are megabytes and would blow past Postgres statement timeouts in the row.
    // The row keeps the slim renderable result + a pointer to the artifact.
    // Oversized artifacts are stride-DOWNSAMPLED to fit instead of failing the save.
    const tArtifact0 = Date.now();
    let artifact: { bucket: string; path: string } | null = null;
    let artifactError: string | null = null;
    let heavyBytes = 0;
    try {
      let heavyFrames: unknown[] = Array.isArray((r.mhr as any)?.frames) ? (r.mhr as any).frames : [];
      let heavyBoxes: unknown[] = Array.isArray((r.sam as any)?.boxes) ? (r.sam as any).boxes : [];
      let heavyPaths: unknown[] = Array.isArray((r.sam as any)?.svgPaths) ? (r.sam as any).svgPaths : [];
      const heavyTracks: unknown[] = Array.isArray((r.sam as any)?.tracks) ? (r.sam as any).tracks : [];
      const buildHeavy = () => Buffer.from(JSON.stringify({ version: 1, frames: heavyFrames, sam: { boxes: heavyBoxes, svgPaths: heavyPaths, tracks: heavyTracks } }));
      let bytes = buildHeavy();
      let downsampled = false;
      while (bytes.length > 19_000_000 && (heavyFrames.length > 8 || heavyBoxes.length > 8 || heavyPaths.length > 8)) {
        heavyFrames = sampleEvery(heavyFrames as never[], Math.max(8, Math.floor(heavyFrames.length / 2)));
        heavyBoxes = sampleEvery(heavyBoxes as never[], Math.max(8, Math.floor(heavyBoxes.length / 2)));
        heavyPaths = sampleEvery(heavyPaths as never[], Math.max(8, Math.floor(heavyPaths.length / 2)));
        downsampled = true;
        bytes = buildHeavy();
      }
      heavyBytes = bytes.length;
      if (bytes.length === 0) {
        artifactError = "nothing to store (empty analysis)";
      } else if (bytes.length > 20_000_000) {
        artifactError = `3D payload too large even after downsampling (${(bytes.length / 1_000_000).toFixed(1)} MB)`;
      } else {
        const path = `biomech/${stepSubmissionId}/AGENT.json`;
        const { error: upErr } = await admin.storage.from("program-videos").upload(path, bytes, { contentType: "application/json", upsert: true });
        if (upErr) artifactError = upErr.message;
        else artifact = { bucket: "program-videos", path, ...(downsampled ? { downsampled: true } : {}) } as { bucket: string; path: string };
      }
    } catch (e) {
      artifactError = e instanceof Error ? e.message : String(e);
    }
    const artifactMs = Date.now() - tArtifact0;
    if (artifactError) console.warn("[biomech-save] artifact not stored:", artifactError);

    // Store slim agent output + activity context so reload needs no re-inference.
    // Guarantee the row fits: shrink angles-only frames until under ~90 KB.
    let slim = slimForStorage(r);
    let slimBytes = Buffer.byteLength(JSON.stringify(slim));
    while (slimBytes > 90_000 && Array.isArray((slim.mhr as any)?.frames) && (slim.mhr as any).frames.length > 4) {
      const m = slim.mhr as Record<string, unknown>;
      slim = { ...slim, mhr: { ...m, frames: sampleEvery(m.frames as unknown[], Math.max(4, Math.floor((m.frames as unknown[]).length / 2))) } };
      slimBytes = Buffer.byteLength(JSON.stringify(slim));
    }
    const mhrResult = {
      ...slim,
      artifact,
      activity: {
        title: String(prescribedTitle || ""),
        instructions: String(prescribedInstructions || ""),
        therapistNeed: String(therapistNeed || ""),
        ageBand: String(ageBand || "adult"),
      },
      savedFrom: "review-modal",
      savedAt: new Date().toISOString(),
    };
    console.info("[biomech-save] sizes", { stepSubmissionId, heavyBytes, slimBytes, artifactMs, artifactSaved: !!artifact });

    const tUpsert0 = Date.now();
    const { data, error } = await admin
      .from("biomech_jobs")
      .upsert(
        {
          submission_id: submissionId,
          step_submission_id: stepSubmissionId,
          intent: "AGENT",
          concepts,
          status: "completed",
          mhr_result: mhrResult,
          timing_ms: timingMs,
        },
        { onConflict: "step_submission_id,intent" }
      )
      .select("id, updated_at")
      .single();
    console.info("[biomech-save] upsert", { stepSubmissionId, upsertMs: Date.now() - tUpsert0, ok: !error });
    if (error) {
      if (/statement timeout|canceling statement/i.test(error.message)) {
        return NextResponse.json(
          {
            error: `Database timed out while saving the ${(slimBytes / 1000).toFixed(0)} KB summary row (3D artifact: ${(heavyBytes / 1_000_000).toFixed(1)} MB, stored separately). This is a database hiccup, not your clip — press Save again. Your analysis is still on screen, and Download JSON below keeps a full copy you can load back anytime.`,
            code: "DB_STATEMENT_TIMEOUT",
            sizes: { slimBytes, heavyBytes },
          },
          { status: 504 }
        );
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ success: true, saved: data, artifactSaved: !!artifact, artifactError, sizes: { slimBytes, heavyBytes } });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
