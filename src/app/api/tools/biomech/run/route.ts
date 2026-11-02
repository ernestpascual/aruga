import { NextRequest, NextResponse } from "next/server";
import { BIOMECH_KEYWORDS } from "@/lib/meta/biomech-prompt";
import { sam3Engine } from "@/lib/meta/sam-engine";
import { planBiomechConcepts, deriveExpectation, thresholdBand } from "@/lib/meta/biomech-planner";

export const maxDuration = 60;

/**
 * POST /api/tools/biomech/run — playground agentic loop (no DB, no 700 word bank)
 * Body: {
 *   prescribedTitle: string, prescribedInstructions: string,
 *   therapistNeed?: string, ageBand?: string,
 *   videoDataUrl: string (data:video/...), durationSeconds?, mediaWidth?, mediaHeight?,
 *   previousMhr?: any // optional previous run to compare trend
 * }
 * Flow: Spark planner (activity → concepts) → SAM 3.1 → Modal SAM3D → deterministic adherence + Spark synthesis (optional)
 */
export async function POST(req: NextRequest) {
  const t0 = Date.now();
  try {
    const body = await req.json().catch(()=> ({}));
    const prescribedTitle = String(body?.prescribedTitle || body?.activityTitle || "").trim();
    const prescribedInstructions = String(body?.prescribedInstructions || body?.activityInstructions || body?.instructions || "").trim();
    const therapistNeed = String(body?.therapistNeed || "").trim();
    const ageBand = String(body?.ageBand || "adult").trim();
    const videoDataUrl: string | null = typeof body?.videoDataUrl === "string" && body.videoDataUrl ? String(body.videoDataUrl) : (typeof body?.videoUrl === "string" ? String(body.videoUrl) : null);
    const durationSeconds = typeof body?.durationSeconds === "number" && Number.isFinite(body.durationSeconds) ? body.durationSeconds : undefined;
    const mediaWidth = Number(body?.mediaWidth);
    const mediaHeight = Number(body?.mediaHeight);
    const mediaSize = Number.isFinite(mediaWidth) && mediaWidth>0 && Number.isFinite(mediaHeight) && mediaHeight>0 ? { width: Math.round(mediaWidth), height: Math.round(mediaHeight)} : undefined;
    const previousMhr = body?.previousMhr || null;

    if (!prescribedTitle && !prescribedInstructions) {
      return NextResponse.json({ error: "Prescribed activity title or instructions required — AI uses this to decide what to track." }, { status: 400 });
    }
    if (!videoDataUrl) {
      return NextResponse.json({ error: "Upload a video first (videoDataUrl)." }, { status: 400 });
    }
    if (videoDataUrl.length > 140_000_000) {
      return NextResponse.json({ error: "Video too large (>100MB as data URL)." }, { status: 413 });
    }

    // Step 1: Determine — Spark planner picks 2-8 concepts from BIOMECH_KEYWORDS 16 only
    const plan = await planBiomechConcepts({ prescribedTitle, prescribedInstructions, ageBand, therapistNeed });
    const concepts = plan.concepts.filter(c=> (BIOMECH_KEYWORDS as readonly string[]).includes(c));
    if (concepts.length < 2 || !concepts.includes("person")) {
      return NextResponse.json({ error: `Planner returned invalid concepts: ${concepts.join(", ")}` }, { status: 500 });
    }

    // Step 2: Segment → Forward
    const modalUrl = process.env.MODAL_MHR_URL || process.env.MODAL_MHR_ENDPOINT;
    if (!modalUrl) {
      return NextResponse.json(
        { error: "Biomech Engine not configured — MODAL_MHR_URL missing. Deploy modal/app.py and set env. Steps 1 (planner) succeeded.", code: "MODAL_NOT_CONFIGURED", plan, concepts },
        { status: 503 }
      );
    }

    let samResult: Awaited<ReturnType<typeof sam3Engine.segmentConcepts>>;
    try {
      samResult = await sam3Engine.segmentConcepts({ videoUrl: videoDataUrl, concepts, mediaSize, durationSeconds });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      const code = (e as { code?: string })?.code || "SAM_FAILED";
      return NextResponse.json({ error: `SAM 3.1 failed: ${msg}`, code, plan, concepts }, { status: code==="MISSING_API_KEY"?503:502 });
    }
    if (samResult.failures.length>0 && samResult.boxes.length===0) {
      return NextResponse.json({ error: `SAM found no person/segment for ${concepts.join(", ")} — failures: ${samResult.failures.map(f=>`${f.concept}: ${f.message}`).join("; ")}`, code: "SAM_NO_DETECTIONS", plan, concepts, failures: samResult.failures }, { status: 422 });
    }

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
    const modalBase = modalUrl.replace(/\/$/, "").replace(/\/infer$/,"");
    let modalRes: Response;
    try {
      modalRes = await fetch(modalBase, {
        method: "POST",
        headers: { "Content-Type":"application/json", ...(process.env.MODAL_SECRET?{"x-modal-secret":process.env.MODAL_SECRET}:{}) },
        body: JSON.stringify({
          submissionId: "playground",
          stepSubmissionId: "playground-step",
          videoUrl: videoDataUrl.startsWith("data:") ? "demo://playground-clip" : videoDataUrl,
          samPerson,
          options: { concepts, ageBand, activity: { title: prescribedTitle, instructions: prescribedInstructions } }
        })
      });
    } catch (e) {
      return NextResponse.json({ error: `Modal unreachable: ${e instanceof Error?e.message:String(e)}`, code:"MODAL_UNREACHABLE", plan, samPersonMeta: { boxes: samResult.boxes.length } }, { status: 502 });
    }
    if (!modalRes.ok) {
      const txt = await modalRes.text().catch(()=> "");
      return NextResponse.json({ error: `Modal SAM3D failed: ${modalRes.status} ${txt.slice(0,800)}`, code: modalRes.status===401?"MODAL_UNAUTHORIZED":"MODAL_FAILED", plan }, { status: 502 });
    }
    const mhr = await modalRes.json();

    // Step 3: Compare — deterministic adherence + ROM/thresholds + previous comparison
    const expectations = deriveExpectation(prescribedTitle, prescribedInstructions);
    // helper to resolve metricPath to value
    function resolveMetric(path: string, mhrObj: any): number | null {
      if (path === "summary.peakAngles.shoulderFlex_max") return mhrObj?.summary?.peakAngles?.shoulderFlex_max ?? null;
      if (path === "summary.peakAngles.neckFlex_max") return mhrObj?.summary?.peakAngles?.neckFlex_max ?? null;
      if (path === "summary.peakAngles.kneeFlex_L_max") return mhrObj?.summary?.peakAngles?.kneeFlex_L_max ?? null;
      if (path === "summary.posturalAndDeformity.meanBosMarginMm") return mhrObj?.summary?.posturalAndDeformity?.meanBosMarginMm ?? null;
      if (path === "frames[].angles.trunkLean_max") {
        const vals = (mhrObj?.frames||[]).map((f:any)=> f?.angles?.trunkLean).filter((v:any)=> typeof v==="number");
        return vals.length? Math.max(...vals): null;
      }
      if (path === "frames[].angles.trunkLean") {
        const vals = (mhrObj?.frames||[]).map((f:any)=> f?.angles?.trunkLean).filter((v:any)=> typeof v==="number");
        return vals.length? Math.max(...vals): null;
      }
      return null;
    }

    const insights = expectations.map(ex => {
      const value = resolveMetric(ex.metricPath, mhr);
      const rating = thresholdBand(value, ex.target);
      // evidence frames: top 3 where value farthest from target
      let evidenceFrames: Array<{t:number; value:number}> = [];
      if (ex.id==="trunkLean" && mhr?.frames) {
        const sorted = [...mhr.frames].map((f:any)=> ({t:f.timestampSeconds||0, value:f.angles?.trunkLean})).filter((x:any)=> typeof x.value==="number").sort((a,b)=> Math.abs(b.value) - Math.abs(a.value));
        evidenceFrames = sorted.slice(0,3);
      } else if (value!=null) {
        evidenceFrames = [{t: 0, value}];
      }
      const thresholdStr = ex.target.min!==undefined && ex.target.max!==undefined ? `Good ${ex.target.min}–${ex.target.max}${ex.unit}`
        : ex.target.min!==undefined ? `Good ≥${ex.target.min}${ex.unit}` : `Good ≤${ex.target.max}${ex.unit}`;
      const score = rating==="Good" ? 90 : rating==="Watch" ? 65 : 35;
      return {
        id: ex.id, label: ex.label, value, unit: ex.unit, threshold: thresholdStr,
        rating, score,
        evidenceRef: ex.metricPath,
        evidenceFrames,
        explanation: rating==="Good" ? `Within target — ${value ?? "?"}${ex.unit} meets ${thresholdStr}.` : rating==="Watch" ? `Borderline — ${value ?? "?"}${ex.unit} near threshold (${thresholdStr}). Cue and re-check next session.` : `Needs support — ${value ?? "?"}${ex.unit} outside ${thresholdStr}. Consider compensatory strategy.`,
        formula: ex.id==="shoulderFlex" ? "180 - angle(pelvis, shoulder, elbow)" : ex.id==="trunkLean" ? "angle(pelvis+verticalUp, pelvis, thorax)" : "MHR deterministic",
      };
    });

    const goodCount = insights.filter(i=> i.rating==="Good").length;
    const watchCount = insights.filter(i=> i.rating==="Watch").length;
    const kinematicPct = insights.length ? Math.round(((goodCount + watchCount*0.6)/insights.length)*100) : 0;
    const adherence = {
      pct: kinematicPct,
      label: kinematicPct>=80 ? "Strong adherence" : kinematicPct>=50 ? "Partial adherence" : "Needs support",
      kinematicPct,
      checklistPct: 100, // no checklist in playground
      explanation: `${goodCount}/${insights.length} metrics in target; ${watchCount} borderline. Based on prescribed activity "${prescribedTitle||"activity"}" expectations.`,
    };

    // History / previous comparison if provided
    let trend: any = null;
    if (previousMhr?.summary) {
      const prev = previousMhr.summary;
      const cur = mhr.summary;
      const deltaSh = (cur?.peakAngles?.shoulderFlex_max ?? 0) - (prev?.peakAngles?.shoulderFlex_max ?? 0);
      const deltaTrunk = (cur?.peakAngles ? (cur.posturalAndDeformity?.meanBosMarginMm ?? 0) : 0) - (prev?.posturalAndDeformity?.meanBosMarginMm ?? 0);
      trend = {
        direction: deltaSh > 2 ? "improving" : deltaSh < -2 ? "regressing" : "stable",
        delta: Math.round(deltaSh*10)/10,
        unit: "° shoulder",
        summary: `Shoulder ${deltaSh>0?"+":""}${deltaSh.toFixed(1)}° vs previous; BoS ${deltaTrunk>0?"+":""}${deltaTrunk.toFixed(0)}mm. ${Math.abs(deltaSh)>3 ? "Meaningful change." : "Within measurement noise (±3-5°)."}`
      };
    }

    const processingMs = Date.now() - t0;

    // Return full agentic trace
    return NextResponse.json({
      plan, concepts,
      sam: { boxes: samResult.boxes, svgPaths: samResult.svgPaths, tracks: samResult.tracks, failures: samResult.failures, billedRequests: samResult.billedRequests, latencyMs: samResult.latencyMs },
      mhr,
      insights, adherence, trend,
      expectations,
      meta: { processingMs, source: "playground:spark→sam3.1→modal", prescribedTitle, prescribedInstructions, ageBand },
    });

  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
