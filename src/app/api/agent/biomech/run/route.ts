import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { BIOMECH_KEYWORDS, intentToConcepts } from "@/lib/meta/biomech-prompt";
import { sam3Engine } from "@/lib/meta/sam-engine";

export const maxDuration = 60;

/**
 * POST /api/agent/biomech/run — evidence-gated, no mock fallback
 * Body: { submissionId, stepSubmissionId, intent: "U1".."U11", ageBand? }
 * Requires real video in program-videos and real Modal MHR endpoint (MODAL_MHR_URL).
 * Never invents ROM/flags.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(()=> ({}));
    const { submissionId, stepSubmissionId, intent, ageBand } = body as { submissionId?: string; stepSubmissionId?: string; intent?: string; ageBand?: string };
    if (!submissionId || !stepSubmissionId) return NextResponse.json({ error: "submissionId and stepSubmissionId required" }, { status: 400 });
    if (!intent) return NextResponse.json({ error: "intent (U1-U11) required" }, { status: 400 });

    const concepts = intentToConcepts(String(intent));
    // Validate locked keywords
    for (const c of concepts) {
      if (!(BIOMECH_KEYWORDS as readonly string[]).includes(c)) return NextResponse.json({ error: `Concept "${c}" not in BIOMECH_KEYWORDS 16` }, { status: 400 });
    }

    const admin = createAdminClient();
    if (!admin) return NextResponse.json({ error: "Supabase not configured" }, { status: 500 });

    // Verify step submission exists and has video
    const { data: stepSub, error: stepErr } = await admin.from("step_submissions").select("id, submission_id, video_path, media_meta").eq("id", stepSubmissionId).maybeSingle();
    if (stepErr) return NextResponse.json({ error: stepErr.message }, { status: 500 });
    if (!stepSub) return NextResponse.json({ error: "Step submission not found" }, { status: 404 });
    if (!stepSub.video_path) return NextResponse.json({ error: "No video for this step — client has not uploaded video. Cannot run Biomech.", code: "NO_VIDEO" }, { status: 422 });

    // Require Modal endpoint for real inference — no mock fallback
    const modalUrl = process.env.MODAL_MHR_URL || process.env.MODAL_MHR_ENDPOINT;
    if (!modalUrl) {
      return NextResponse.json(
        { error: "Biomech Engine not configured — MODAL_MHR_URL missing. Deploy modal/app.py (Modal L4) and set env to enable real SAM 3.1 → MHR inference. No mock fallback.", code: "MODAL_NOT_CONFIGURED", concepts },
        { status: 503 }
      );
    }

    // Create signed URL for both SAM and Modal to fetch video (10m TTL)
    let signedVideoUrl: string | null = null;
    try {
      const { data: signed } = await admin.storage.from("program-videos").createSignedUrl(String(stepSub.video_path), 600);
      signedVideoUrl = signed?.signedUrl || null;
    } catch {}
    if (!signedVideoUrl) return NextResponse.json({ error: "Failed to create signed video URL for SAM/Modal" }, { status: 500 });

    // 1) Meta SAM 3.1 — segment person + intent concepts first via Meta API (billing: 1 request per concept via sam-engine)
    // Boxes/masks are then forwarded to Modal SAM3D for biomechanics — no mock fallback
    const mediaMeta = (stepSub.media_meta as Record<string, unknown>) || {};
    const mediaSize = typeof mediaMeta.width === "number" && typeof mediaMeta.height === "number" && (mediaMeta.width as number) > 0 && (mediaMeta.height as number) > 0
      ? { width: Math.round(mediaMeta.width as number), height: Math.round(mediaMeta.height as number) }
      : undefined;
    let samResult: Awaited<ReturnType<typeof sam3Engine.segmentConcepts>>;
    try {
      samResult = await sam3Engine.segmentConcepts({
        videoUrl: signedVideoUrl,
        concepts,
        mediaSize,
      });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      const code = (e as { code?: string })?.code || "SAM_FAILED";
      const status = code === "MISSING_API_KEY" ? 503 : 502;
      return NextResponse.json({ error: `SAM 3.1 failed before Modal: ${msg}. Check MODEL_API_KEY/META_API_BASE_URL env and video accessibility.`, code, samError: msg }, { status });
    }
    if (samResult.failures.length > 0 && samResult.boxes.length === 0) {
      return NextResponse.json({ error: `SAM 3.1 found no person/segment for ${concepts.join(", ")} — cannot run MHR. Failures: ${samResult.failures.map(f=> `${f.concept}: ${f.message}`).join("; ")}`, code: "SAM_NO_DETECTIONS", failures: samResult.failures, concepts }, { status: 422 });
    }

    // 2) Forward SAM outputs to Modal SAM3D via MODAL_MHR_URL env
    const samPerson = {
      concepts,
      sampleFps: 3,
      fps: 30,
      mediaSize: mediaSize ? [mediaSize.width, mediaSize.height] : null,
      boxes: samResult.boxes,
      svgPaths: samResult.svgPaths,
      tracks: samResult.tracks,
      failures: samResult.failures,
      billedRequests: samResult.billedRequests,
      samLatencyMs: samResult.latencyMs,
    };
    const modalBase = modalUrl.replace(/\/$/, "").replace(/\/infer$/, "");
    const modalEndpoint = modalBase; // fastapi_endpoint root is already ...--aruga-mhr-infer.modal.run
    const modalRes = await fetch(modalEndpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(process.env.MODAL_SECRET ? { "x-modal-secret": process.env.MODAL_SECRET } : {}) },
      body: JSON.stringify({
        submissionId,
        stepSubmissionId,
        videoUrl: signedVideoUrl,
        samPerson,
        options: { concepts, ageBand },
      }),
    });
    if (!modalRes.ok) {
      const txt = await modalRes.text().catch(()=> "");
      return NextResponse.json({ error: `Modal MHR failed: ${modalRes.status} ${txt.slice(0,500)}`, code: "MODAL_FAILED" }, { status: 502 });
    }
    const mhr = await modalRes.json();

    // Persist job trace (best effort) — no mock data inserted on failure
    try {
      await admin.from("biomech_jobs").insert({
        submission_id: submissionId,
        step_submission_id: stepSubmissionId,
        intent: String(intent).toUpperCase(),
        concepts,
        status: "completed",
        mhr_result: mhr,
      });
    } catch {}

    return NextResponse.json({ ...mhr, concepts, intent: String(intent).toUpperCase(), samPerson: { boxes: samResult.boxes.length, tracks: samResult.tracks.length, failures: samResult.failures, billedRequests: samResult.billedRequests, latencyMs: samResult.latencyMs, mediaSize: mediaSize ? [mediaSize.width, mediaSize.height] : null }, samBoxes: samResult.boxes, samSvgPaths: samResult.svgPaths, samTracks: samResult.tracks, source: "sam3.1+modal:env" });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
