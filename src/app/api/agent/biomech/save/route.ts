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

    // Slim the payload before storage: full per-frame 3D keypoints + SVG masks are
    // megabytes of JSON and blow past Postgres statement timeouts on upsert.
    // Keep everything the review UI actually renders (summary, flags, angles,
    // insights, adherence, plan) and drop the heavy replay blobs.
    // Segmentation boxes + masks are STRIDE-SAMPLED across the whole clip
    // (never head-sliced): a head slice keeps only the first ~2s, so a reloaded
    // analysis would show HUD everywhere but boxes nowhere past the opening.
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
        const allBoxes = Array.isArray(s.boxes) ? (s.boxes as unknown[]) : [];
        const allPaths = Array.isArray(s.svgPaths) ? (s.svgPaths as unknown[]) : [];
        const tracks = Array.isArray(s.tracks) ? (s.tracks as unknown[]).slice(0, 20) : [];
        const failures = Array.isArray(s.failures) ? (s.failures as unknown[]).slice(0, 10) : [];
        out.sam = {
          billedRequests: s.billedRequests,
          latencyMs: s.latencyMs,
          boxes: sampleEvery(allBoxes, 40),
          svgPaths: sampleEvery(allPaths, 40),
          tracks,
          failures,
          boxCount: allBoxes.length,
        };
      }
      if (input.mhr && typeof input.mhr === "object") {
        const m = input.mhr as Record<string, unknown>;
        const frames = Array.isArray(m.frames)
          ? (m.frames as Array<Record<string, unknown>>).map((f) => ({
              frameIndex: f.frameIndex,
              timestampSeconds: f.timestampSeconds,
              angles: f.angles,
              flags: f.flags,
              motionAnnotations: Array.isArray(f.motionAnnotations)
                ? (f.motionAnnotations as unknown[]).slice(0, 6)
                : f.motionAnnotations,
              confidence: f.confidence,
            }))
          : [];
        out.mhr = { summary: m.summary, flags: m.flags, frames, modelId: m.modelId, processingMs: m.processingMs };
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
    let artifact: { bucket: string; path: string } | null = null;
    let artifactError: string | null = null;
    try {
      const heavy = {
        version: 1,
        frames: (r.mhr as any)?.frames ?? [],
        sam: {
          boxes: (r.sam as any)?.boxes ?? [],
          svgPaths: (r.sam as any)?.svgPaths ?? [],
          tracks: (r.sam as any)?.tracks ?? [],
        },
      };
      const bytes = Buffer.from(JSON.stringify(heavy));
      if (bytes.length === 0) {
        artifactError = "nothing to store (empty analysis)";
      } else if (bytes.length > 20_000_000) {
        artifactError = `3D payload too large (${(bytes.length / 1_000_000).toFixed(1)} MB) — trim the clip and re-run`;
      } else {
        const path = `biomech/${stepSubmissionId}/AGENT.json`;
        const { error: upErr } = await admin.storage.from("program-videos").upload(path, bytes, { contentType: "application/json", upsert: true });
        if (upErr) artifactError = upErr.message;
        else artifact = { bucket: "program-videos", path };
      }
    } catch (e) {
      artifactError = e instanceof Error ? e.message : String(e);
    }
    if (artifactError) console.warn("[biomech-save] artifact not stored:", artifactError);

    // Store slim agent output + activity context so reload needs no re-inference
    const mhrResult = {
      ...slimForStorage(r),
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
    if (error) {
      if (/statement timeout|canceling statement/i.test(error.message)) {
        return NextResponse.json({ error: "Database timed out while saving — retry once. If it persists, run a shorter clip so the result payload is smaller." }, { status: 504 });
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ success: true, saved: data, artifactSaved: !!artifact, artifactError });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
