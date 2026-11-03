import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { BIOMECH_KEYWORDS } from "@/lib/meta/biomech-prompt";
import { sam3Engine } from "@/lib/meta/sam-engine";
import { planBiomechConcepts, analyzeBiomechTask, finalizeBiomechPrompt, deriveExpectation, thresholdBand } from "@/lib/meta/biomech-planner";

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
    const durationSeconds = typeof body?.durationSeconds === "number" && Number.isFinite(body.durationSeconds) ? body.durationSeconds : undefined;
    const mediaWidth = Number(body?.mediaWidth);
    const mediaHeight = Number(body?.mediaHeight);
    const mediaSize = Number.isFinite(mediaWidth) && mediaWidth>0 && Number.isFinite(mediaHeight) && mediaHeight>0 ? { width: Math.round(mediaWidth), height: Math.round(mediaHeight)} : undefined;
    const previousMhr = body?.previousMhr || null;
    const videoStoragePath: string | null = typeof body?.videoStoragePath === "string" && body.videoStoragePath.trim() ? String(body.videoStoragePath).trim() : null;
    const rawVideoDataUrl: string | null = typeof body?.videoDataUrl === "string" && body.videoDataUrl ? String(body.videoDataUrl) : (typeof body?.videoUrl === "string" ? String(body.videoUrl) : null);

    if (!prescribedTitle && !prescribedInstructions) {
      return NextResponse.json({ error: "Prescribed activity title or instructions required — AI uses this to decide what to track." }, { status: 400 });
    }
    // Resolve video URL: prefer Storage path (bypasses Vercel 4.5 MB) else data URL
    let videoDataUrlResolved: string | null = rawVideoDataUrl;
    if (videoStoragePath) {
      const admin = createAdminClient();
      if (!admin) return NextResponse.json({ error: "Supabase not configured" }, { status: 500 });
      // Validate path is inside expected prefix to prevent arbitrary bucket reads
      if (!videoStoragePath.startsWith("playground/") && !videoStoragePath.startsWith("submissions/")) {
        return NextResponse.json({ error: "Invalid videoStoragePath prefix." }, { status: 400 });
      }
      const { data: signed, error: sErr } = await admin.storage.from("program-videos").createSignedUrl(videoStoragePath, 600);
      if (sErr || !signed?.signedUrl) return NextResponse.json({ error: `Failed to sign Storage path: ${sErr?.message || "unknown"}` }, { status: 500 });
      videoDataUrlResolved = signed.signedUrl;
    }
    if (!videoDataUrlResolved) {
      return NextResponse.json({ error: "Upload a video first (videoDataUrl or videoStoragePath)." }, { status: 400 });
    }
    const videoDataUrl: string = videoDataUrlResolved;
    if (videoDataUrl.length > 134_000_000) { // ~100 MB file → ~133 MB base64 data URL
      return NextResponse.json({ error: "Video too large — max 100 MB. Use a shorter clip." }, { status: 413 });
    }
    // Vercel λ body cap is 4.5 MB — localhost has no cap, so only enforce on Vercel
    const host = req.headers.get("host") || req.headers.get("x-forwarded-host") || "";
    const isLocalhostReq = /^(localhost|127\.0\.0\.1|\[::1\]|.*\.local)(:\d+)?$/.test(host);
    if (!videoStoragePath && !isLocalhostReq && videoDataUrl.length > 6_000_000) {
      return NextResponse.json({ error: `Video data URL is ${(videoDataUrl.length/1_000_000).toFixed(1)} MB — exceeds Vercel function payload (4.5 MB). Sign in to use Storage upload (up to 100 MB) or run on localhost:3000 (allows 100 MB direct) or use a shorter clip ≤15s / <3 MB.`, code: "PAYLOAD_TOO_LARGE" }, { status: 413 });
    }

    // Step 0: Analyze — Spark reads the prescription like a clinician and decides
    // what the agent should try to get out of the video (movement, measurable
    // targets, compensations to watch). Advisory: null when Spark is unavailable.
    // Step 1: Draft — planner picks 2-8 concepts (grounded in the analysis when present).
    // Step 2: Finalize — reviewer locks the exact SAM 3.1 tracking list (subset
    // of the draft, person-first, lock-enforced deterministically).
    const analysis = await analyzeBiomechTask({ prescribedTitle, prescribedInstructions, ageBand, therapistNeed }).catch(() => null);
    const draft = await planBiomechConcepts({ prescribedTitle, prescribedInstructions, ageBand, therapistNeed }, analysis ? { analysis } : undefined);
    const final = await finalizeBiomechPrompt({
      draftConcepts: draft.concepts,
      analysis,
      input: { prescribedTitle, prescribedInstructions, ageBand, therapistNeed },
    });
    const plan = {
      ...draft,
      concepts: final.concepts,
      rationale: final.rationale,
      dropped: final.dropped,
      perConceptUse: final.perConceptUse,
    };
    const concepts = final.concepts.filter(c=> (BIOMECH_KEYWORDS as readonly string[]).includes(c));
    if (concepts.length < 2 || !concepts.includes("person")) {
      return NextResponse.json({ error: `Planner returned invalid concepts: ${concepts.join(", ")}` }, { status: 500 });
    }

    // Step 3: Segment → Forward (SAM 3.1 tracks the finalized concepts, Modal measures)
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
          videoUrl: videoDataUrl,
          samPerson,
          options: { concepts, ageBand, activity: { title: prescribedTitle, instructions: prescribedInstructions } }
        })
      });
    } catch (e) {
      return NextResponse.json({ error: `Modal unreachable: ${e instanceof Error?e.message:String(e)}`, code:"MODAL_UNREACHABLE", plan, samPersonMeta: { boxes: samResult.boxes.length } }, { status: 502 });
    }
    if (!modalRes.ok) {
      const txt = await modalRes.text().catch(()=> "");
      if (/timed?\s*out|execution timed|cancellation signal/i.test(txt)) {
        return NextResponse.json({ error: "Movement analysis timed out — clip too long or server was cold starting. Trim to ≤15s and run again (second run is warm and faster).", code: "MODAL_TIMEOUT" }, { status: 504 });
      }
      return NextResponse.json({ error: `Modal SAM3D failed: ${modalRes.status} ${txt.slice(0,800)}`, code: modalRes.status===401?"MODAL_UNAUTHORIZED":"MODAL_FAILED", plan }, { status: 502 });
    }
    const mhr = await modalRes.json();

    // Step 4: Compare — deterministic adherence + ROM/thresholds + previous comparison
    const expectations = deriveExpectation(prescribedTitle, prescribedInstructions);
    // helper to resolve metricPath to value
    function resolveMetric(path: string, mhrObj: any): number | null {
      if (path === "summary.peakAngles.shoulderFlex_max") return mhrObj?.summary?.peakAngles?.shoulderFlex_max ?? null;
      if (path === "summary.peakAngles.neckFlex_max") return mhrObj?.summary?.peakAngles?.neckFlex_max ?? null;
      if (path === "summary.peakAngles.kneeFlex_L_max") return mhrObj?.summary?.peakAngles?.kneeFlex_L_max ?? null;
      if (path === "summary.posturalAndDeformity.meanBosMarginMm") return mhrObj?.summary?.posturalAndDeformity?.meanBosMarginMm ?? null;
      if (path === "summary.peakAngles.wristFlex_L_max") return mhrObj?.summary?.peakAngles?.wristFlex_L_max ?? mhrObj?.summary?.peakAngles?.wristFlex_max ?? null;
      if (path === "summary.peakAngles.wristFlex_R_max") return mhrObj?.summary?.peakAngles?.wristFlex_R_max ?? null;
      if (path === "summary.rom.fingerAperture_range_mm") return mhrObj?.summary?.rom?.fingerAperture_range_mm ?? null;
      if (path === "summary.peakAngles.fingerAperture_L_max_mm") return mhrObj?.summary?.peakAngles?.fingerAperture_L_max_mm ?? null;
      if (path === "frames[].angles.wristDeviation_max") {
        const vals = (mhrObj?.frames||[]).map((f:any)=> f?.angles?.wristAngles?.deviation_L ?? f?.angles?.wristAngles?.deviation_R ?? f?.angles?.wristAngles?.flexExt_L).filter((v:any)=> typeof v==="number").map((v:number)=>Math.abs(v));
        return vals.length? Math.max(...vals): null;
      }
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
      let evidenceFrames: Array<{t:number; value:number}> = [];
      if (ex.id==="trunkLean" && mhr?.frames) {
        const sorted = [...mhr.frames].map((f:any)=> ({t:f.timestampSeconds||0, value:f.angles?.trunkLean})).filter((x:any)=> typeof x.value==="number").sort((a,b)=> Math.abs(b.value) - Math.abs(a.value));
        evidenceFrames = sorted.slice(0,3);
      } else if ((ex.id==="wristFlex" || ex.id==="wristDeviation") && mhr?.frames) {
        const sorted = [...mhr.frames].map((f:any)=> ({t:f.timestampSeconds||0, value: f.angles?.wristAngles?.flexExt_L ?? f.angles?.wristAngles?.flexExt_R ?? f.angles?.wristAngles?.deviation_L})).filter((x:any)=> typeof x.value==="number").sort((a,b)=> Math.abs(b.value) - Math.abs(a.value));
        evidenceFrames = sorted.slice(0,3);
      } else if (ex.id==="fingerAperture" && mhr?.frames) {
        const sorted = [...mhr.frames].map((f:any)=> ({t:f.timestampSeconds||0, value: f.angles?.wristAngles?.fingerAperture_L_mm ?? f.angles?.wristAngles?.fingerAperture_R_mm})).filter((x:any)=> typeof x.value==="number").sort((a,b)=> b.value - a.value);
        evidenceFrames = sorted.slice(0,3);
      } else if (value!=null) {
        evidenceFrames = [{t: 0, value}];
      }
      const thresholdStr = ex.target.min!==undefined && ex.target.max!==undefined ? `Good ${ex.target.min}–${ex.target.max}${ex.unit}`
        : ex.target.min!==undefined ? `Good ≥${ex.target.min}${ex.unit}` : `Good ≤${ex.target.max}${ex.unit}`;
      const score = rating==="Good" ? 90 : rating==="Watch" ? 65 : 35;
      // build 1-2 sentence plain-language evidence (no jargon) — why AI thinks this rating
      const evTxt = evidenceFrames.length ? evidenceFrames.slice(0,2).map(f=> `${f.t.toFixed(1)}s at ${Math.round(f.value)}${ex.unit}`).join(" and ") : (value!=null ? `${Math.round(value as number)}${ex.unit} peak` : "no clean frames");
      const plainWhat: Record<string,string> = {
        shoulderFlex: "shoulder lift",
        trunkLean: "trunk lean",
        neckFlex: "neck bend",
        kneeFlex: "knee bend",
        wristFlex: "wrist bend",
        fingerAperture: "finger opening",
        wristDeviation: "wrist side-tilt",
        bos: "balance (CoM over feet)",
      };
      const what = plainWhat[ex.id] ?? ex.label.toLowerCase();
      let explanation = "";
      if (rating==="Good") explanation = `Good ${what} — measured ${value!=null?Math.round(value as number)+ex.unit:"—"} is inside ${thresholdStr}. Evidence: ${evTxt}.`;
      else if (rating==="Watch") explanation = `Watch ${what} — ${value!=null?Math.round(value as number)+ex.unit:"—"} is just outside ${thresholdStr}. Evidence: ${evTxt}; try a small cue and re-check.`;
      else explanation = `Needs support for ${what} — ${value!=null?Math.round(value as number)+ex.unit:"—"} is outside ${thresholdStr}. Evidence: ${evTxt}; the body is compensating elsewhere.`;
      return {
        id: ex.id, label: ex.label, value, unit: ex.unit, threshold: thresholdStr,
        rating, score,
        evidenceRef: ex.metricPath,
        evidenceFrames,
        explanation,
        formula: ex.id==="shoulderFlex" ? "180 - angle(pelvis, shoulder, elbow)" : ex.id==="trunkLean" ? "angle(pelvis+verticalUp, pelvis, thorax)" : ex.id==="wristFlex" ? "180 - angle(elbow, wrist, mid_tip)" : ex.id==="fingerAperture" ? "||thumb_tip - index_tip|| mm" : ex.id==="wristDeviation" ? "wrist radial/ulnar °" : "MHR deterministic",
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
    // Cleanup playground file best-effort (optional, keep for replay) — delete after 24h via Supabase retention; no immediate delete
    // Return full agentic trace (analysis → draft → finalized SAM prompt → SAM → MHR)
    return NextResponse.json({
      plan, concepts, analysis,
      sam: { boxes: samResult.boxes, svgPaths: samResult.svgPaths, tracks: samResult.tracks, failures: samResult.failures, billedRequests: samResult.billedRequests, latencyMs: samResult.latencyMs },
      mhr,
      insights, adherence, trend,
      expectations,
      meta: { processingMs, source: videoStoragePath ? "playground:storage→spark→sam3.1→modal" : "playground:spark→sam3.1→modal", prescribedTitle, prescribedInstructions, ageBand },
    });

  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    // Body too large before JSON parse throws SyntaxError — ensure JSON response, not plain text
    if (msg.includes("Body exceeded") || msg.includes("request entity") || msg.includes("Payload Too Large")) {
      return NextResponse.json({ error: "Request too large for Vercel (limit 4.5 MB). Use a shorter clip ≤15s / <3 MB on deployed site.", code: "PAYLOAD_TOO_LARGE" }, { status: 413 });
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
