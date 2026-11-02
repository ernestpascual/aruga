# BIOMECHANIC_AGENT.md — Agentic Biomechanical Analysis (SAM 3.1 → Modal SAM 3D Body → Spark Reasoning)

**Source:** `plan/BIOMECH_ENGINE_PLAN.md` + `docs/BIOMECHANICAL_DATAPOINTS.md:51-100` + therapist request for activity-adherence + historic comparison + SAM-Test-style viz
**Meta Stack:** `https://api.meta.ai/v1` · Planner `muse-spark-1.3` (`reasoning:{effort:"medium"}`) + SAM 3.1 `sam-3.1` boxes+masks · Modal L4 `facebookresearch/sam-3d-body` `modal/app.py:415` · Spark synthesis `muse-spark-1.3` evidence-backed rating
**Status:** Draft for build — replaces piecemeal U1-U11 with unified agentic loop

> **One-liner:** Therapist intent + activity + patient history → **Spark planner picks 2-8 concepts from `BIOMECH_KEYWORDS` 16** → `segment_concepts` (Meta SAM 3.1) → `estimate_biomech` (Modal SAM 3D Body @3 FPS + One-Euro) → `evaluate_adherence` (ROM/kinematics vs activity spec vs history/trend) → same `BiomechOverlay + SamOverlay` video-scrub UX as SAM Test.

---

## 0) How to use this doc

- [ ] Confirm 4-step loop vs legacy direct `POST /api/agent/biomech/run` (§2)
- [ ] Approve Spark tool schemas + evidence-backed rating contract (§3.3, §5)
- [ ] Approve Modal contract unchanged, reuse `samPerson` forwarding (§4)
- [ ] Approve adherence + history data model + `biomech_jobs` extension (§6)
- [ ] Approve SAM-Test parity viz: moving boxes + skeleton + measurement HUD (§7)
- [ ] Sign off cost + phased build (§8-9)

> This file is source of truth for biomechanic agent. `BIOMECH_ENGINE_PLAN.md` remains reference for 16-keyword rationale; this doc supersedes its 3-tool loop.

---

## 1) Why agentic + why these 4 steps

| Step | What | Where | Cost / size | Why needed |
|---|---|---|---|---|
| **1. Determine** | Spark planner picks concepts to segment | Next `POST /api/agent/biomech/run` | tokens only <$0.001 | Activity + history + therapist need decide *what* to look at; avoids 16-concept waste |
| **2. Segment → Forward** | SAM 3.1 segment + Modal SAM3D infer | Meta API + Modal L4 `modal/app.py:382` | $0.009 + $0.002/clip | SAM already does detection; Modal skips ViTDet `100ms/frame` instead of `1060ms` |
| **3. Compare** | Adherence, ROM/kinematics, history trend, Spark synthesis | Next (deterministic + Spark) | tokens only | Turns raw joint angles into therapist-readable rating with evidence |
| **4. Show** | Moving boxes + skeleton + measurement HUD | Frontend `sam-test/page.tsx` parity | 0 | Therapist already knows SAM Test - reuse mental model |

**Decision:** Keep deterministic kinematics (`modal/app.py:111 compute_frame_biomech_and_scene`) as ground truth. Spark never invents angles - it filters, thresholds, compares to history, and narrates with inline evidence refs.

---

## 2) Agentic loop — overview

```
Input: { submissionId, stepSubmissionId, intent: "U1".."U11", therapistNeed?: string,
         ageBand?: "pedia"|"adolescent"|"adult"|"geriatric" }

  ┌─────────────────────────────────────────────────────────────────┐
  │ Spark Planner (muse-spark-1.3 reasoning:medium, 16-only guard) │
  │ System: "You may ONLY pick from BIOMECH_KEYWORDS 16.           │
  │          Return 2-8 concepts + rationale for intent + activity. │
  │          Consider patient history flags if provided."           │
  └────────────────────────┬────────────────────────────────────────┘
                           │ {concepts, rationale} e.g. ["person","shoulder","elbow","trunk"]
                           ▼
  ┌─────────────────────────────────────────────────────────────────┐
  │ Step 1: Determine (this doc §3)                                │
  │ Retrieve activity spec + patient history (no extra cost)        │
  │ Planner + guard -> validated concepts list                      │
  └────────────────────────┬────────────────────────────────────────┘
                           │
                           ▼
  ┌─────────────────────────────────────────────────────────────────┐
  │ Step 2: Segment + Estimate (this doc §4)                        │
  │ tool.segment_concepts(concepts) -> Meta SSE boxes/masks/tracks  │
  │          │                                                      │
  │          └─► tool.estimate_biomech({samPerson, videoUrl})       │
  │                POST {MODAL_MHR_URL}/infer -> frames[].angles    │
  │                + motionAnnotations + biomechTelemetry + summary  │
  └────────────────────────┬────────────────────────────────────────┘
                           │ mhr JSON (deterministic)
                           ▼
  ┌─────────────────────────────────────────────────────────────────┐
  │ Step 3: Compare (this doc §5)                                  │
  │ Deterministic: ROM/kinematics vs activity spec vs history trend │
  │ + Spark: evidence-backed rating + adherence + goal progress     │
  │ -> {insights[], adherence, trend, assessment draft}             │
  └────────────────────────┬────────────────────────────────────────┘
                           │
                           ▼
  ┌─────────────────────────────────────────────────────────────────┐
  │ Step 4: Show (this doc §7)                                     │
  │ Video: BiomechSkeletonOverlay + SamOverlay + BiomechInVideoHud  │
  │ Panel: BiomechPanel 2.0 with evidence, adherence, history chart │
  │       + spark reasoning badge + Add to notes                    │
  └─────────────────────────────────────────────────────────────────┘
  Persist: biomech_jobs + agent_runs + ai_analyses
```

Max 4 tool calls/loop, `parallel_tool_calls:true` where safe. One Modal inference per step submission; revisiting intents filters same `mhr_result` - no re-bill unless explicit re-run.

---

## 3) Step 1: Determine what to segment (Spark planner)

### 3.1 Inputs gathered before planner call

`src/app/api/agent/biomech/run/route.ts:30` already fetches `step_submissions`; extend to:

```ts
// Existing: stepSub { id, submission_id, video_path, media_meta }
const [{ data: stepSub }, { data: programStep }, { data: patient }, history] = await Promise.all([
  admin.from("step_submissions").select("id, submission_id, video_path, media_meta, program_step_id").eq("id", stepSubmissionId).maybeSingle(),
  admin.from("program_steps").select("id, title, instructions, position, generated_activity_id").eq("id", stepSub.program_step_id).maybeSingle(),
  admin.from("patients").select("id, age, condition, long_term_goals, short_term_goals, client_category").eq("id", patientId).maybeSingle(),
  fetchHistory(patientId, programStep?.generated_activity_id), // last 5 biomech_jobs for same activity|patient
]);
```

Activity spec source: `program_steps.instructions` + `generated_activities.spark_spec` `src/types/database.ts:147,182` if linked. History source: `biomech_jobs` filtered by `patient_id + generated_activity_id` (or `intent` fallback) ordered by `created_at desc limit 5`.

### 3.2 Planner LLM call

**Model:** `muse-spark-1.3` `temperature 0.2` `max_tokens 800` with structured output `response_format: {type:"json_schema", strict:true}`. `prompt_cache_key:"aruga-biomech-planner"` - stable BIOMECH_KEYWORDS prefix, variable intent/activity/history last.

**System prompt:**

```
You are the Aruga biomechanic planner. You may ONLY pick from BIOMECH_KEYWORDS 16:
["person","shoulder","elbow","forearm","wrist","hand","finger","thumb","hip","knee joint","ankle joint","foot","trunk","cervical spine","thoracic spine","neck"]
Return 2-8 concepts, must include "person". Prioritize joints most informative for the given intent + activity instructions + patient history flags.
Do not invent concepts outside the list. Respond as JSON: {concepts: string[], rationale: string}
```

**User prompt (constructed):**

```
Intent: U1 UE ROM tracking (Cup Lift)
Activity: "Cylindrical Cup Lift - shoulder 90° hold 3s"
  Instructions: "Lift 8oz cup to mouth height, hold 3s, avoid trunk lean"
Patient: pedia, age 7, condition: hemiparesis L, STG: shoulder flex 150°
History flags (last 3): trunk_compensation_mild (x2), shoulder asymmetry 18%
Therapist need: "focus on trunk stability"
AgeBand: pedia
```

**Expected output:**

```json
{ "concepts": ["person","shoulder","elbow","trunk","neck"], "rationale": "UE ROM + trunk compensation check per history + neck head control for pedia" }
```

**Guard:** `src/lib/meta/biomech-prompt.ts:30 assertSamTextConcept` + `BIOMECH_KEYWORDS` membership. On violation, retry planner once with stricter reminder; on second failure, fallback to `intentToConcepts(intent)` `biomech-prompt.ts:52`.

**Cost:** <$0.001/run, cacheable for identical (intent, activity, ageBand) triple.

### 3.3 Spark tool definitions (for possible function-calling loop)

If migrating to full `tool_choice:"auto"` agent, expose as tools instead of single planner call:

1. `tool.get_activity_and_history({ stepSubmissionId })` - returns activity spec + last 5 summaries (local DB, 0 cost)
2. `tool.plan_concepts({ intent, activity, patient, history })` - above planner
3. `tool.segment_concepts({ concepts })` - §4.1
4. `tool.estimate_biomech({ samPerson, videoUrl })` - §4.2
5. `tool.synthesize_insights({ mhr, activity, history, goals })` - §5.3

MVP (this plan) uses steps 3.1-3.2 deterministically without tool-choice loop to keep latency low; upgrade to tool loop when therapist free-text `therapistNeed` needs multi-turn disambiguation.

---

## 4) Step 2: Segment and forward to Modal

### 4.1 Segment (Meta SAM 3.1)

Same as `src/app/api/agent/biomech/run/route.ts:53` + `src/app/api/agent/biomech/demo/route.ts:49`:

```ts
const mediaSize = parseMediaSize(stepSub.media_meta); // {width,height}
let samResult = await sam3Engine.segmentConcepts({ videoUrl: signedVideoUrl, concepts, mediaSize });
// sam3Engine: src/lib/meta/sam-engine.ts:304 — concurrency 2, cache TTL 5m, IoU 0.9 dedup via resolveCrossConceptOverlaps
// Each distinct concept = 1 billed /v1/responses SSE request; identical (video,concept) within TTL = 0 billed
```

**Signed URL:** `admin.storage.from("program-videos").createSignedUrl(video_path, 600)` `route.ts:48` - 10m TTL, never send raw mp4 to Modal; both Meta and Modal fetch same URL.

**Error handling:** If `failures.length && boxes.length===0` -> return `422 SAM_NO_DETECTIONS` with per-concept failures for UI `src/app/sam-test/page.tsx:72`.

### 4.2 Forward to Modal SAM 3D Body

Unchanged contract `modal/app.py:391 infer`:

```ts
const samPerson = {
  concepts,
  sampleFps: 3, // 45 frames/15s -> $0.002/clip; do not use 30 FPS (10x cost)
  fps: 30,
  mediaSize: mediaSize ? [mediaSize.width, mediaSize.height] : null, // list [w,h] per Modal contract
  boxes: samResult.boxes,       // [{frameIndex, timestampSeconds, box:[ymin,xmin,ymax,xmax] 0-1, confidence, label}]
  svgPaths: samResult.svgPaths, // [{frameIndex, path, label}] normalized 0-1 via transformMaskPathToNormalized src/lib/meta/sam.ts:50
  tracks: samResult.tracks,     // per-object grouping src/lib/meta/sam-engine.ts:185 buildTracks
  failures: samResult.failures,
  billedRequests: samResult.billedRequests,
  samLatencyMs: samResult.latencyMs,
};
const modalRes = await fetch(modalUrl.replace(/\/infer$/,""), {
  method:"POST",
  headers: {"Content-Type":"application/json", ...(process.env.MODAL_SECRET?{"x-modal-secret":process.env.MODAL_SECRET}:{})},
  body: JSON.stringify({ submissionId, stepSubmissionId, videoUrl: signedVideoUrl, samPerson, options:{concepts, ageBand, activity: {title, instructions}} }),
});
const mhr = await modalRes.json();
```

**Modal internals `modal/app.py:415 _run_real_sam3db`:** Decode `boxes_by_frame` list->dict `app.py:431`, denorm `0-1 -> pixels` using `mediaSize`, `cv2.VideoCapture` signed URL, `step = srcFps/sampleFps`, `OneEuroFilter3D` `app.py:59` smoothing, `bboxes=np.array([sam_box])` to skip SAM3D ViTDet, `estimator.process_one_image(frame_rgb, bboxes=bbox_np)`, `compute_frame_biomech_and_scene` `app.py:111` per sampled frame, `_build_final_response` `app.py:620` aggregations.

**Per-frame output** (added in this plan vs legacy, see `docs/BIOMECHANICAL_DATAPOINTS.md:396-450` functionalAdlAndErgonomics):

```json
{
  "frameIndex": 12, "timestampSeconds": 0.40,
  "pred_keypoints_3d": [[0.01,0.42,1.21] /* 17 joints, kpts_3d[0]=Head,5=L_Sh etc app.py:124 */],
  "pred_keypoints_2d": [[412,298]],
  "pred_cam_t": [0.02,-0.08,2.10], "focal_length": 1050,
  "angles": { "shoulderFlex_L":142.3, "elbowFlex_R":88.1, "trunkLean":4.2, "neckAngles":{...} },
  "motionAnnotations": [{joint:"shoulder_L", motion:"Flexion 142.3°", value:142.3, anchor:"shoulder"}],
  "biomechTelemetry": { "com3dMeters":[0.1,0.2,2.1], "bosMarginMm":88.1, ... },
  "sceneUnderstanding": { "subjectDistanceMeters":2.1, "isTruncatedByFrameEdge":false, ... },
  "functionalAdlAndErgonomics": { "badlSelfCare":{...}, "ergonomicsAndWork":{ "rulaGrandScore":3 } /* Tier 1 pure-kinematics subset */ },
  "flags": ["trunk_compensation_mild"],
  "confidence": {"pose":0.91, "angleErrorDeg":2.1}
}
```

**Summary** `summary: {peakAngles, rom, gait:{comSwayVelocityMmPerSec}, posturalAndDeformity, sceneSummary, risk, confidenceOverall, functionalAndWorkSummary}` with `rulaMean/max, nioshMultipliers, strikeZone distribution, overheadDutyCyclePct` etc.

---

## 5) Step 3: Compare — adherence, kinematics, history

### 5.1 Deterministic adherence scoring (no LLM)

Runs in Next after Modal response, before Spark synthesis:

```ts
// 5.1a Activity expectation registry (maps program_steps keywords -> relevant insights)
// e.g. title "Cup Lift" -> expects: shoulderFlex >=90°, handToMouth dist <180mm, elbow hold <10° sway
const expectation = deriveExpectation(programStep.title, programStep.instructions);
// Heuristic: string match "cup|drink|mouth" -> ["handToMouthTrajectory","rulaGrandScore"]
//            "shoulder|overhead|reach" -> ["shoulderFlex","overheadHairGrooming","sbanStrikeZone"]
//            "trunk|lean|balance" -> ["trunkLean","bosMarginMm","pelvicObliquityDeg"]
// Each expectation has {metricPath, targetRange, tolerance}

// 5.1b Per-insight thresholding -> rating bands
// Good: within target ± tolerance; Watch: within 1.5x tolerance; Needs support: outside
// Example: shoulderFlex target 150° ±10° -> Good >=140°, Watch 120-140°, Needs support <120°
// Uses same thresholds as docs/BIOMECHANICAL_DATAPOINTS.md RULA/REBA/OWAS published bands
for (const insight of mhr.functionalAndWorkSummary.ergonomicRiskProfile) {
  rating = thresholdBand(value, expectation.targetRange);
  evidenceFrames = frames.filter(f => isOutside(f[metricPath], target)).map(f=>({t:f.timestampSeconds, value:f[metricPath]}));
}
```

Adherence score `0-100`:

```
adherence = 0.5 * checklistCompletion + 0.5 * kinematicCompletion
checklistCompletion = ActivityCompletion.checklist_state?.filter(c=>c.done).length / total
  src/types/database.ts:243; falls back to 1 if no checklist
kinematicCompletion = (# expected metrics in Good/Watch) / (# expected metrics)
  e.g. 3/4 expectations met -> 75% -> blended with checklist -> 80% -> "4/5 reps @≥80% ROM"
```

### 5.2 History comparison (trend)

`fetchHistory` returns last 5 `biomech_jobs.mhr_result.summary` for same `(patient, generated_activity_id)`:

```ts
const history = await admin.from("biomech_jobs")
  .select("mhr_result, created_at")
  .eq("patient_id", patientId).eq("activity_id", activityId)
  .order("created_at", {ascending:false}).limit(5);
// Compute per-metric delta:
deltaShoulder = current.summary.peakAngles.shoulderFlex_max - history[0].summary.peakAngles.shoulderFlex_max // e.g. +4°
trendSlope = linearRegression(history.map(h=>h.peakAngles.shoulderFlex_max)) // +2.1°/session
consistency = history.map(h=>h.summary.posturalAndDeformity.meanBosMarginMm) // sparkline
vsGoalProgress = (current - baseline) / (goalTarget - baseline) *100
  // baseline = first history or intake; goalTarget parsed from patients.long_term_goals e.g. "shoulder flex 180°"
```

Emit `trend: { direction:"improving"|"stable"|"regressing", delta, slope, vsGoalPct, sparklineValues }` for Spark to narrate.

### 5.3 Spark synthesis (evidence-backed rating)

**Second Spark call** after deterministic scoring - turns numbers into therapist narrative without hallucination.

**Model:** `muse-spark-1.3` `temperature 0.25` `reasoning medium` `response_format json_schema strict:true`. Must cite evidence refs; validated post-call that every `value` exists in `mhr` JSON.

**System:**

```
You are Aruga clinical synthesis. You receive deterministic biomechanics + history + activity spec.
Do not invent joint angles. Every insight must cite its source path e.g. "frames[2].angles.shoulderFlex_L=142°".
Return JSON matching schema. Use plain language for therapist draft.
```

**Schema `text.format json_schema`:**

```json
{
  "type":"object",
  "properties":{
    "insights": {"type":"array","items":{"type":"object","properties":{
      "id":{"type":"string"}, "label":{"type":"string"},
      "rating":{"type":"string","enum":["Good","Watch","Needs support"]},
      "score":{"type":"number"}, "value":{"type":"number"}, "unit":{"type":"string"},
      "threshold":{"type":"string"}, "formula":{"type":"string"},
      "evidenceRef":{"type":"string"}, "evidenceFrames":{"type":"array","items":{"type":"object","properties":{"t":{"type":"number"},"value":{"type":"number"}}}},
      "explanation":{"type":"string"}, "vsHistory":{"type":"string"}, "samAssisted":{"type":"boolean"}
    },"required":["id","label","rating","score","value","unit","threshold","evidenceRef","explanation"],"additionalProperties":false}},
    "adherence": {"type":"object","properties":{"pct":{"type":"number"},"label":{"type":"string"},"checklistPct":{"type":"number"},"kinematicPct":{"type":"number"},"explanation":{"type":"string"}}},
    "trend": {"type":"object","properties":{"direction":{"type":"string","enum":["improving","stable","regressing"]}, "delta":{"type":"number"},"unit":{"type":"string"},"summary":{"type":"string"}}},
    "goalProgress": {"type":"object","properties":{"stg":{"type":"string"},"ltg":{"type":"string"},"ltgPct":{"type":"number"}}},
    "objectiveDraft": {"type":"string"}, "assessmentDraft": {"type":"string"}, "planSuggestion": {"type":"string"},
    "confidenceNote": {"type":"string"}
  },
  "required":["insights","adherence","objectiveDraft","assessmentDraft"],"additionalProperties":false
}
```

**User payload (trimmed):**

```
Activity: Cup Lift - shoulder 90° hold 3s | Instructions: Lift 8oz cup to mouth height, hold 3s
Current MHR: {summary.peakAngles.shoulderFlex_max 152°, rom.shoulderFlex_range 44°, trunkLean max 8°, rulaMax 3, handToMouth min 165mm, flags:[]}
Expectation: shoulderFlex target 150°±10°, trunkLean <5°, handToMouth <180mm
History: last 3 shoulders 142°->148°->152° (+4° now), trunk 14°->12°->8° (improving), adherence last 60%->75%
Goals: STG shoulder 150° (now 152° hit), LTG shoulder 180° (52% progress)
```

**Expected Spark output:**

```json
{
  "insights":[
    {"id":"shoulderFlex","label":"Shoulder flexion","rating":"Good","score":92,"value":152,"unit":"°","threshold":"Good ≥140° (target 150°±10°)","formula":"180 - angle(pelvis,shoulder,elbow)","evidenceRef":"summary.peakAngles.shoulderFlex_max 152° (frames 3-5)","evidenceFrames":[{"t":0.4,"value":152}],"explanation":"Reached 152° - exceeds 150° STG and +4° vs last session. Within functional range.","vsHistory":"+4° vs 148° last, trend +3°/session","samAssisted":false},
    {"id":"trunkLean","label":"Trunk compensation","rating":"Watch","score":68,"value":8,"unit":"°","threshold":"Good <5°, Watch 5-14°, Support >14°","formula":"angle(pelvis+verticalUp, pelvis, thorax)","evidenceRef":"frames[4].angles.trunkLean 8°","explanation":"Mild lean on 3/8 frames, improved from 14° - cue upright.","vsHistory":"14°->8° (-6° improving)","samAssisted":false}
  ],
  "adherence":{"pct":80,"label":"4/5 reps @≥80%","checklistPct":100,"kinematicPct":60,"explanation":"All checklist items done; 3/4 kinematic targets met (trunk lean out of target on 3 frames)"},
  "trend":{"direction":"improving","delta":4,"unit":"°","summary":"Shoulder +4° vs last, trunk -6°, 3-session upward trend"},
  "goalProgress":{"stg":"STG 150° met (152°)","ltg":"LTG 180° 52% progress","ltgPct":52},
  "objectiveDraft":"Shoulder flexion 152° peak (range 44°, +4° vs last) - STG met; trunk lean 8° mild on 3/8 frames (improved from 14°); hand-to-mouth 165mm within target.",
  "assessmentDraft":"Improving UE reach with reduced compensation - continue progression.",
  "planSuggestion":"Increase hold 3s->5s, add trunk cue card.",
  "confidenceNote":"Large ROM reliable ±3-5°; fine pinch not assessed this clip."
}
```

**Post-validation:** Reject response if any `insight.value` not found within `0.1` tolerance in `mhr` JSON - prevents hallucination (evidence-gated like `route.ts:8`).

---

## 6) Persistence

Extend `supabase/schema.sql` `biomech_jobs`:

```sql
alter table biomech_jobs add column if not exists patient_id uuid references patients(id);
alter table biomech_jobs add column if not exists generated_activity_id uuid references generated_activities(id);
alter table biomech_jobs add column if not exists intent text;
alter table biomech_jobs add column if not exists concepts text[];
alter table biomech_jobs add column if not exists sam_result jsonb; -- {boxes,svgPaths,tracks,billedRequests,latencyMs,failures}
alter table biomech_jobs add column if not exists adherence jsonb; -- {pct,label,checklistPct,kinematicPct}
alter table biomech_jobs add column if not exists history_refs uuid[]; -- ids of previous jobs used for trend
alter table biomech_jobs add column if not exists spark_insights jsonb; -- §5.3 output
-- ai_analyses.mhr_results already stores full mhr; keep as canonical
create index if not exists idx_biomech_jobs_patient_activity on biomech_jobs(patient_id, generated_activity_id, created_at desc);
```

`agent_runs` `plan/BIOMECH_ENGINE_PLAN.md:310` stores loop trace `[{thought, action:{tool, args}, observation:{samBoxes, mhrPeak, adherence}, latencyMs}]` for audit.

---

## 7) Step 4: Show segmentation + measurements (SAM Test parity)

Reuse `src/app/sam-test/page.tsx` UX so therapist transfers knowledge. Three layers over same `<video>` `page.tsx:982`:

### 7.1 Moving boxes (SAM 3.1)

`src/lib/meta/sam.ts:245 boxes` already normalized `0-1`; render like `page.tsx:999`:

```tsx
// In therapist/submissions/[id]/page.tsx per stepSubmission card:
const activeBoxes = getActiveBoxes(overlaySourceBoxes, currentTime); // nearest 0.75s window, grouped by label+objectId
<div className="absolute inset-0 pointer-events-none">
  <svg viewBox="0 0 1 1" preserveAspectRatio="none">{activePaths.map(p=> <path d={p.path} fill={styleFor(p.label).color} fillOpacity={0.35} />)}</svg>
  {visibleActiveBoxes.map(b=> <div style={{top:`${b.box[0]*100}%`, left:`${b.box[1]*100}%`, width:`${(b.box[3]-b.box[1])*100}%`, height:`${(b.box[2]-b.box[0])*100}%`, border:`2px solid ${styleFor(b.label).color}`}}><span>{b.label} {Math.round(b.confidence*100)}%</span></div>)}
</div>
```

Isolate toggle + palette `page.tsx:640 colorFor / styleFor` + mask opacity/thickness controls carried over. New: per-step label filter chips `person | shoulder | trunk` matching planner concepts.

### 7.2 Skeleton + measurement HUD (Modal SAM3D)

`src/components/therapist/BiomechOverlay.tsx:328 BiomechSkeletonOverlay` + `src/components/therapist/BiomechOverlay.tsx:160 SkeletonSvg` + `MotionTags`:

```tsx
<BiomechSkeletonOverlay mhr={mhr} currentTime={currentTime} mediaSize={[width,height]} style={biomechStyle} />
<MotionTags kpts2d={frame.pred_keypoints_2d} annotations={frame.motionAnnotations} /> // "Flexion 142°" anchors at joint index
<BiomechInVideoHud mhr={mhr} currentTime={currentTime} /> // bottom gradient: shoulderL/R, elbow, knee, trunk, neck + BoS mm + timestamp + flags
```

Controls `BiomechMaskControls` `BiomechOverlay.tsx:341` for opacity/thick/dots/showLabels - exposed in per-step card header.

### 7.3 Measurement panel (BiomechPanel 2.0)

Extends `src/components/therapist/BiomechPanel.tsx:30` ROM cards (4-up grid). New layout per step:

```
[Video scrubber + play/pause + timestamp]
[Overlay toggles: Boxes | Skeleton | HUD]
[Row 1: ROM cards] Shoulder 152° | Neck 38° | BoS 88mm | Risk Low   (peakAngles + flags)
[Row 2: Evidence insights — collapsible per metric]
  ▸ Shoulder flexion — Good 92/100 — 152° (target 150°±10°) [sparkline] evidence: frames 3-5, +4° vs last
    "Reached 152° - exceeds STG" — formula: 180-angle(pelvis,shoulder,elbow) — sampler: threshold bar Good/Watch/Support
  ▸ Trunk compensation — Watch 68/100 — 8° (target <5°) [3/8 frames flagged]
    "Mild lean improved 14°->8°" — evidence: f4 0.8s 8°, 1.2s 7.5° ...
[Row 3: Adherence + Trend]
  Adherence 80% "4/5 reps @≥80%" — progress bar — checklist 100% + kinematic 60%
  Trend sparkline (last 5 shoulders 142-152°) — "improving +3°/session, STG met, LTG 52%"
[Row 4: Spark drafts] Objective / Assessment / Plan suggestion + confidenceNote — "Add to notes" per field
[Trace drawer] agent_runs thought/action/observation for auditors
```

Sparklines reuse `BiomechOverlay.tsx:77 Sparkline` + `BiomechLiveHud` `RangeBar` `BiomechOverlay.tsx:60` with `currentIdx` synced to `video.currentTime`. Flags row same amber chips `BiomechPanel.tsx:36`.

### 7.4 SAM Test parity checklist

| SAM Test `page.tsx` | Biomechanic agent equivalent |
|---|---|
| Engine selector 8 options | Intent U1-U11 dropdown + therapistNeed free-text (planner rationale badge) |
| Payload textarea 100 targets | Concept chips `person, shoulder...` (planner output, editable before re-run) |
| Test/Custom button -> `POST /api/sam-test` | Analyze Movement button -> `POST /api/agent/biomech/run` (disabled until video) |
| Video drop + metadata width/height | Same; `media_meta.width/height` used for SAM normalization `sam.ts:250` |
| Timeline scrub + activeBoxes `0.75s` window | Same + `findActiveFrame` `BiomechOverlay.tsx:45` for skeleton/HUD sync |
| Color palette + mask style per label | Reuse `PALETTE` `page.tsx:114` + `MaskStyle`; biomech skeleton uses `BiomechMaskStyle` separate controls |
| Past sessions reload | History sparkline + click to load previous `biomech_jobs` mhr into comparison pane |
| Latency + billedRequests badge | `processingMs + samLatencyMs + billedRequests` header badge `route.ts:120 samPerson` |

---

## 8) Cost + performance

Same as `BIOMECH_ENGINE_PLAN.md:181`: `L4 $0.000222/s -> $0.002/clip @3 FPS (45f/15s)` naive, `$0.0006` INT8; `SAM 3.1 $0.20/1k frames -> $0.009/clip 1 pass` regardless of 4 or 8 concepts (batched in `sam-engine`); planner + synthesis ~$0.002 combined with `prompt_cache_key` `plan/BIOMECH_ENGINE_PLAN.md:185`.

**Do not:** call Modal twice (2x cost `route.ts:89`); sample at 30 FPS; use 100-engine `sam-engines/index.ts` (deprecated reference only). Reuse `mhr_result` for intent re-filter - `HomeProgram.steps` grain is `step_submission_id` not `submission_id` `BIOMECH_ENGINE_PLAN.md:292`.

---

## 9) Phased build

- **Phase 0 (this PR):** Wire `retrieve_history` + planner prompt + deterministic adherence (5.1-5.2) + SAM-Test overlay parity in one step card (read-only, no Spark synthesis yet). Ship behind `FEATURE_BIOMECH_AGENT=1`.
- **Phase 1 (1 wk):** Add Spark synthesis `§5.3` JSON schema + `spark_insights` column + Evidence collapsibles + `Add to notes` -> `POST /api/ai/soap-summary` objective/assessment fill `page.tsx:609 handleAutoFillFromAiObservations`.
- **Phase 2 (1 wk):** INT8 TRT `modal/app.py` switch, `pred_vertices` mesh for Tier-1 functionalAdl (handToMouth etc `docs/BIOMECHANICAL_DATAPOINTS.md:396`), history dashboard `therapist/clients/[id]` trend chart `plan/GOAL_TRACKING_AGENT_PLAN.md`.
- **Phase 3:** SAM object concepts allowlist for Tier 2-3 (`docs/BIOMECHANICAL_DATAPOINTS.md:51-100` cup/chair/box), `monitorToEyeViewingGeometry` OSHA check, PDF export.

---

## 10) Risks & mitigations

- **Concept hallucination outside 16:** `assertSamTextConcept` `sam.ts:96` + `BIOMECH_KEYWORDS` guard + retry -> fallback `intentToConcepts` `biomech-prompt.ts:52`.
- **SAM weak body-part prompts:** Fallback to `person` only - MHR recovers all joints without per-limb masks (paper MPJPE 54.8mm).
- **Accuracy vs Vicon:** Large ROM ±3-5° reliable; wrist/chin-tuck ±1.5cm low confidence -> UI `confidenceNote` + `confirmedObs` checkboxes before publish `BIOMECH_ENGINE_PLAN.md:223`.
- **PHI on GPU:** Signed URLs 10m TTL, no Modal persistence, `x-modal-secret` header `modal/app.py:392`, `volume` cache only ckpts.
- **Spark invention:** Post-validate every `value` against `mhr` JSON; refuse to render ungrounded insight (evidence-gated `route.ts:8`).

---

## 11) Open questions

1. [ ] Max concepts per run 6 or 8? (8 covers UE+trunk, 6 saves context+billing)
2. [ ] Deprecate `sam-engines/index.ts` 100-keyword payloads now or keep as reference playground?
3. [ ] `MAX_VIDEO_SECONDS` cap 30 or 15s @3 FPS to stretch $1 (115min/$1 vs 57min/$1)?
4. [ ] Adherence expectation authoring: heuristic keyword map (Phase 0) vs therapist-editable thresholds per `generated_activity`?

---

**Next step:** Review checkboxes, then `approve BIOMECHANIC_AGENT` to scaffold `src/lib/meta/biomech-planner.ts` + extend `POST /api/agent/biomech/run` with §3.1-5.3 + `BiomechPanel 2.0` step card with §7 overlay parity.

