import { NextRequest, NextResponse } from "next/server";
import { BIOMECH_KEYWORDS, intentToConcepts } from "@/lib/meta/biomech-prompt";
import { sam3Engine } from "@/lib/meta/sam-engine";

export const maxDuration = 60;

/**
 * POST /api/agent/biomech/demo — demo proxy for SAM workspace (no fallback mock)
 * Body: { intent?: "U1".."U11", concepts?: string[], videoDataUrl?: string, ageBand?: string }
 * No DB required. Strictly forwards to MODAL_MHR_URL/infer env var — no local mock fallback.
 * If MODAL_MHR_URL missing or Modal fails, returns error with code for UI failure message.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const intent = typeof body?.intent === "string" ? body.intent : "U1";
    const ageBand = typeof body?.ageBand === "string" ? body.ageBand : undefined;
    let concepts: string[] = Array.isArray(body?.concepts)
      ? body.concepts.map((c: unknown) => String(c).trim()).filter(Boolean)
      : intentToConcepts(String(intent));

    // validate against locked 16
    for (const c of concepts) {
      if (!(BIOMECH_KEYWORDS as readonly string[]).includes(c)) {
        return NextResponse.json({ error: `Concept "${c}" not in BIOMECH_KEYWORDS 16` }, { status: 400 });
      }
    }

    const modalUrl = process.env.MODAL_MHR_URL || process.env.MODAL_MHR_ENDPOINT;
    if (!modalUrl) {
      return NextResponse.json(
        { error: "Biomech Engine not configured — MODAL_MHR_URL missing. Deploy modal/app.py with `modal deploy modal/app.py` and set MODAL_MHR_URL in .env.local (local) and Vercel → Settings → Environment Variables (prod), then redeploy. No mock fallback.", code: "MODAL_NOT_CONFIGURED" },
        { status: 503 }
      );
    }

    // Demo video source — must be a real video (data URL from upload) so Meta SAM 3.1 can segment it
    const samVideoUrl: string | null = (
      typeof body?.videoDataUrl === "string" && body.videoDataUrl ? String(body.videoDataUrl) :
      typeof body?.videoUrl === "string" && body.videoUrl ? String(body.videoUrl) : null
    );
    if (!samVideoUrl) {
      return NextResponse.json({ error: "No video provided for Movement check — upload a video in the workspace first. Biomech needs SAM 3.1 masks before Modal SAM3D.", code: "NO_VIDEO" }, { status: 422 });
    }
    const mediaSize = typeof body?.mediaWidth === "number" && typeof body?.mediaHeight === "number" && body.mediaWidth > 0 && body.mediaHeight > 0
      ? { width: Math.round(body.mediaWidth), height: Math.round(body.mediaHeight) }
      : undefined;

    // 1) Meta SAM 3.1 first — segment person/concepts via Meta API (no fallback mock)
    let samResult: Awaited<ReturnType<typeof sam3Engine.segmentConcepts>>;
    try {
      samResult = await sam3Engine.segmentConcepts({ videoUrl: samVideoUrl, concepts, mediaSize });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      const code = (e as { code?: string })?.code || "SAM_FAILED";
      const status = code === "MISSING_API_KEY" ? 503 : 502;
      return NextResponse.json({ error: `SAM 3.1 failed: ${msg}. Check MODEL_API_KEY/META_API_BASE_URL env.`, code, samError: msg }, { status });
    }
    if (samResult.failures.length > 0 && samResult.boxes.length === 0) {
      return NextResponse.json({ error: `SAM 3.1 found no segments for ${concepts.join(", ")} — cannot run MHR. Failures: ${samResult.failures.map(f=> `${f.concept}: ${f.message}`).join("; ")}`, code: "SAM_NO_DETECTIONS", failures: samResult.failures, concepts }, { status: 422 });
    }

    // 2) Modal SAM3D — forward SAM masks/boxes via env MODAL_MHR_URL
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
    const modalEndpoint = modalBase;
    let modalRes: Response;
    try {
      modalRes = await fetch(modalEndpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(process.env.MODAL_SECRET ? { "x-modal-secret": process.env.MODAL_SECRET } : {}),
        },
        body: JSON.stringify({
          submissionId: "demo",
          stepSubmissionId: "demo-step",
          videoUrl: samVideoUrl.startsWith("data:") ? "demo://sam-workspace-clip" : samVideoUrl,
          samPerson,
          options: { concepts, ageBand },
        }),
      });
    } catch (e) {
      return NextResponse.json({ error: `Biomech Engine unreachable at MODAL_MHR_URL: ${e instanceof Error ? e.message : String(e)}. Check MODAL_MHR_URL env and that modal app is deployed.`, code: "MODAL_UNREACHABLE", samPersonMeta: { boxes: samResult.boxes.length, billedRequests: samResult.billedRequests } }, { status: 502 });
    }
    if (!modalRes.ok) {
      const txt = await modalRes.text().catch(() => "");
      return NextResponse.json({ error: `Modal SAM3D failed: ${modalRes.status} ${txt.slice(0, 800)}`, code: modalRes.status === 401 ? "MODAL_UNAUTHORIZED" : "MODAL_FAILED", samPersonMeta: { boxes: samResult.boxes.length } }, { status: 502 });
    }
    const mhr = await modalRes.json();
    // Expose full SAM segmentation for /sam-test video overlay (masks + boxes) alongside MHR motion
    return NextResponse.json({ ...mhr, concepts, intent: intent.toUpperCase(), source: "sam3.1+modal:env", samPersonMeta: { boxes: samResult.boxes.length, tracks: samResult.tracks.length, billedRequests: samResult.billedRequests, latencyMs: samResult.latencyMs, failures: samResult.failures }, samBoxes: samResult.boxes, samSvgPaths: samResult.svgPaths, samTracks: samResult.tracks, samConcepts: samResult.conceptsRequested });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
