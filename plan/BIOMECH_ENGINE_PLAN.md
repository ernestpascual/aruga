# BIOMECH_ENGINE_PLAN.md — Biomechanical Agentic Loop (SAM 3.1 → Modal SAM 3D Body MHR)
**Source:** `~/.opencode/plan/biomechanical-agent-plan_1101261748.md` (1101261748) → v2 agentic 16-only 1101261752
**Meta Stack:** Meta Model API `https://api.meta.ai/v1` · Planner `muse-spark-1.3` (`reasoning:{effort:"medium"}`) / escalate `muse-wonder-1.0` long-horizon+`max` delegate-to-subagents · SAM 3.1 `sam-3.1` via `POST /v1/responses`+`/v1/files` boxes+RLE · Responses API `previous_response_id` reasoning-replay · `text.format=json_schema` / MHR JSON · `parallel_tool_calls:true` · `1M context`
**Status:** Draft for revision — edit checkboxes and approve

> **One-liner:** Therapist picks Use Case dropdown (U1-U11) → **Planner LLM picks 2-8 keywords from `BIOMECH_KEYWORDS` 16 only** → `segment_concepts` (Meta SAM 3.1) → `estimate_biomech` (Modal MHR) → `draft_soap` → `BiomechPanel` + ROM cards. One Modal inference per clip, reused across workflows. No 100-keyword engines.

---

## 0) How to revise this doc

- [ ] Confirm `BIOMECH_KEYWORDS` 16 locked (§2.1) — sole keyword source, no `sam-engines/index.ts`
- [ ] Confirm agentic loop (planner + 3 tools, §2.2) vs deterministic 2-pass
- [ ] Confirm Use Case dropdown → intent mapping (§5)
- [ ] Set `sampleFps` + `MAX_VIDEO_SECONDS` budget (§3.4)
- [ ] Approve Modal contract + agent output schema (§3, §4)
- [ ] Sign off data migration (§7)

> This file is source of truth. No code changes until `approve BIOMECH_ENGINE_PLAN`.

---

## 1) Why agentic + why split

| Layer | Where | Size / cost | Role in loop |
|---|---|---|---|
| **SAM 3.1 segmentation** | Meta Model API `https://api.meta.ai/v1/responses` | $0.20/1k frames; 0 MB client | `tool.segment_concepts(concepts: string[])` → `src/lib/meta/sam.ts:162 runSamVideoPrompt` + `sam-engine.ts:304 segmentConcepts` + `@meta-sam/parser` SSE → boxes `[ymin,xmin,ymax,xmax] 0-1` + RLE masks |
| **SAM 3D Body (MHR)** | **Modal GPU** `facebook/sam-3d-body-vith` | `model.ckpt 1.69 GB`, ONNX `3.4 GB` / INT8 `0.9 GB`; Modal L4 `$0.000222/s` / T4 `$0.000164/s` → **$0.002/clip @3 FPS naive**, $0.0006 INT8; $1 = ~115 min naive / 7 hrs INT8 | `tool.estimate_biomech(samPerson)` → `estimator.process_one_image(crop*mask)` → joints/angles/ROM |
| **Planner LLM** | Next `POST /api/agent/biomech/run` (OpenAI/server) | Tokens only | Picks 2-8 concepts from 16 per intent, validates `assertSamTextConcept` (`sam.ts:96` ≤8 words, noun phrase) |
| **SOAP drafter** | `src/app/api/ai/soap-summary` | — | `tool.draft_soap(angles,flags,ageBand)` → `page.tsx:609 handleAutoFillFromAiObservations` |
| **Next.js** | Vercel | Thin proxy + webhook | Keeps `MODEL_API_KEY` server-only (`src/lib/meta/client.ts:13`), stores trace |

**Decision:** No browser `onnxruntime-web/wasm` (65 MB already janks, 1.69 GB OOM). Modal holds GPU; Next orchestrates agentic loop. No `sam-engines/index.ts:1` 100-keyword payloads — deprecated to context reference only.

---

## 2) Agentic loop — 16 keywords only

### 2.1 BIOMECH_KEYWORDS — sole source (16 locked)

> `BIOMECH_KEYWORDS` lives in `src/lib/meta/biomech-prompt.ts` (new). **All workflows must pick subset of this array only.** `sam-engines/index.ts` 100-engines not used.

| # | Keyword | Why prioritized | Covers |
|---|---|---|---|
| 1 | `person` | Anchor — whole-body box drives MHR crop; always included | V1-V3 |
| 2 | `shoulder` | #1 compensation (hike) | U1,U5 |
| 3 | `elbow` | Flex/ext ROM core | U1 |
| 4 | `forearm` | Pron/sup proxy (washcloth `page.tsx:188`) | U1 |
| 5 | `wrist` | Flex/ext + drop flag | U1 |
| 6 | `hand` | Universal landmark | U1,U2,U7 |
| 7 | `finger` | Pincer isolation | U2 |
| 8 | `thumb` | Opposition | U2 |
| 9 | `hip` | LE anchor sit→stand/gait | U3,U4,U6 |
| 10 | `knee joint` | Largest LE angle | U3,U4 |
| 11 | `ankle joint` | Dorsiflex / balance | U3,U4 |
| 12 | `foot` | Heel-strike timing | U3 |
| 13 | `trunk` | Lean compensation #1 (`page.tsx:326 <5°`) | U5 |
| 14 | `cervical spine` | Forward-head / swallow | U5,U11 |
| 15 | `thoracic spine` | Kyphosis axis | U5,U11 |
| 16 | `neck` | Head control + chin tuck — **cross-age** (see §2.1.1) | U4,U5,U11 |

> 8 UE + 5 LE + 3 trunk = 16. Dropped `left/right` prefixes, `face/lip/chin/mouth`, `person in white` — MHR mesh gives laterality. No extra keywords outside this list.

#### 2.1.1 Neck control — all age ranges

- **Pedia (1-11):** tummy-time cervical extension, head lag
- **Adolescent (12-17):** tech-neck, scoliosis
- **Adult (18-54):** dysphagia chin tuck, whiplash
- **Geriatrics (55+):** TUG head turn, fall risk
- **Plan:** Modal returns `neckAngles: {flexExt, lateralFlex, rotation, chinTuck}` + flag `neck_compensation_forward_head` (>25°). UI Neck card on all ages.

### 2.2 Agentic workflow — planner + 3 tools (no 100-engine RAG)

**Tools (Responses flat shape `type:"function"` top-level, `strict:false` default; `tool_search` reserved; only `tool_choice:"auto"`; see [tool-calling](/docs/tool-calling)) (max 3 calls/loop, `parallel_tool_calls:true`):**

1. `tool.segment_concepts({ concepts: string[] })` — `concepts` ⊆ `BIOMECH_KEYWORDS`, 1-8 items, must include `person`. Wraps `segmentConcepts()` + `parseVideoStream` → `recordsOfKind(box|mask)` → `transformMaskPathToNormalized`. Meta billing: **1 pass** regardless of 2 or 8 concepts (single `buildObjectPrompt` call). $0.20/1k frames.
2. `tool.estimate_biomech({ samPerson, videoUrl, options })` — `POST /api/mhr/infer` → Modal `§3.1` → `pred_keypoints_3d/2d`, `pred_vertices` 18k, `angles`, `rom`, `flags`, `summary`. **One GPU invoice per clip.**
3. `tool.draft_soap({ angles, rom, flags, ageBand, useCase })` — `POST /api/ai/soap-summary` → objective/assessment/plan sentences.

**Orchestrator loop `POST /api/agent/biomech/run` (Responses recommended — preserves reasoning across tool turns; Chat Completions cannot carry reasoning externally):**

```
Input: { submissionId, stepSubmissionId, intent: "U11 neck control", ageBand: "pedia" }
  1. Planner LLM (system: "You may ONLY pick from BIOMECH_KEYWORDS 16. Return 2-8 concepts for intent. Prioritize key joints.")
     → { concepts: ["person","neck","cervical spine","trunk"], reason: "head-on-trunk" }
     Validate via assertSamTextConcept (sam.ts:96)
  2. Call segment_concepts(concepts) → { boxes,masks,mediaSize } (Meta SSE)
  3. Call estimate_biomech({ samPerson: {boxes,masks,mediaSize,sampleFps:3}, videoUrl: signed Supabase URL })
     → Modal samples @3 FPS (45 frames/15s), One-Euro filter, crop*mask, MHR→SMPL LBS, angles
  4. Call draft_soap({ angles, rom, flags }) → { objective, assessment }
  5. Return + persist trace to ai_analyses.mhr_results + agent_runs (thought/action/observation)
  Stop: flags resolved or 3 tool calls. No autonomous replanning beyond adding missing joint if compensation detected.
```

**Data flow (answers “what goes to Modal”):**

```
mp4 (Supabase, never to Modal raw)
  → Next fetches signed URL (10m TTL) + sends to Meta API (videoUrl + concepts)
  → Meta returns boxes/masks
  → Next sends ONLY { samPerson {boxes,masks,mediaSize,sampleFps}, videoUrl (signed), options } to Modal (§3.1)
  → Modal pulls frames via signed URL, crops by person box, infers, webhooks back
```

**Dropdown = intent router, not agent:** Therapist `U1-U11` dropdown in `therapist/submissions/[id]/page.tsx` maps to planner hint; dropdown alone is **workflow skill**, plus LLM picker = **agentic loop**. Multiple workflows **reuse same `mhr_results` JSON** — 1 Modal call serves all filters (e.g., U1 shoulder + U11 neck = 1 inference, client filters `angles` vs `neckAngles`).

### 2.3 Revision checklist — agentic

- [ ] Keep `sam-engines/index.ts` as deprecated reference or delete? (recommend keep but unused, no import)
- [ ] Planner model: GPT-4o mini or local? (tokens <$0.001/run)
- [ ] Max concepts per run: 8 or 6? (8 covers UE+trunk, 6 saves context)
- [ ] Allow planner to add `trunk` if compensation seen (1 extra tool call) or strict intent-only?

---

## 3) Modal server contract (receives SAM 3.1 segmentation only)

**Modal app:** `modal.App("aruga-mhr")` + `modal.Volume("sam3db-ckpts")` + `modal.Image(pytorch 2.4-cuda12.1 + facebookresearch/sam-3d-body)` + `@app.function(gpu="L4", timeout=120, keep_warm=1)` + `@app.web_endpoint`

### 3.1 Request (Next → Modal) — lightweight, no mp4

```json
{
  "submissionId": "uuid",
  "stepSubmissionId": "uuid",
  "videoUrl": "https://<supabase-signed-url>/program-videos/...mp4",
  "samPerson": {
    "boxes": [{ "frameIndex": 12, "timestampSeconds": 0.4, "box": [0.21,0.31,0.82,0.66], "confidence": 0.97 }],
    "masks": [{ "frameIndex": 12, "bounds": { "left": 410, "top": 210, "right": 820, "bottom": 940 }, "mask": { "width": 256, "height": 256, "payload": "~rle..." } }],
    "mediaSize": { "width": 1280, "height": 720 },
    "fps": 30,
    "sampleFps": 3
  },
  "options": {
    "referenceItem": { "label": "therapy putty 2-inch cube", "knownWidthCm": 5.08 },
    "focalLengthPx": 1050,
    "inferenceType": "body",
    "concepts": ["person","neck","cervical spine","trunk"]
  }
}
```

### 3.2 Response (Modal → webhook) — agent output source

```json
{
  "submissionId": "uuid",
  "modelId": "sam-3d-body-vith + MHR 1.0",
  "processingMs": 1840,
  "frames": [{
    "frameIndex": 12, "timestampSeconds": 0.4,
    "pred_keypoints_3d": [[0.01,0.42,1.21]],
    "pred_keypoints_2d": [[412,298]],
    "pred_vertices": [[...18439]],
    "pred_cam_t": [0.02, -0.08, 2.1],
    "focal_length": 1050,
    "angles": { "shoulderFlex_L": 142.3, "elbowFlex_R": 88.1, "kneeFlex_L": 12.4, "trunkLean": 4.2, "neckAngles": { "flexExt": 38, "lateralFlex": 4, "rotation": 2, "chinTuck": 12 } },
    "rom": { "shoulderFlex_max": 158, "shoulderFlex_min": 22, "elbowExt_deficit": 8, "neckFlex_max": 52, "neckFlex_min": 38 },
    "confidence": { "pose": 0.82, "angleErrorDeg": 3.5 },
    "flags": ["trunk_compensation_mild", "neck_compensation_forward_head"]
  }],
  "summary": {
    "peakAngles": { "neckFlex_max": 52 },
    "rom": { "neckFlex_range": 14, "shoulderFlex_range": 136 },
    "gait": { "stepLengthSymmetry": 0.94, "tugEstimateSec": 11.2 },
    "risk": "moderate_fall",
    "confidenceOverall": 0.78
  }
}
```

Modal internals: `estimator.process_one_image(crop_rgb)` per sampled frame (every ~10th @30fps), One-Euro box filter, mask-guided `crop*mask`, MHR→SMPL LBS, angle via joint vectors, confidence from `pose` + SAM `box.confidence`. Cached `/ckpts/model.ckpt + mhr_model.pt` on Volume.

### 3.3 Next.js routes (agentic)

- `POST /api/agent/biomech/run` — **Main agentic entry**: therapist-only, validate, planner picks concepts from 16, calls `segment_concepts` → `estimate_biomech`, creates `biomech_jobs status=queued|processing`, returns `jobId + trace`
- `POST /api/mhr/infer` — underlying Modal proxy (called by agent, also direct)
- `POST /api/mhr/webhook` — verify `x-modal-secret`, upsert `ai_analyses (mhr_results JSONB, biomech_summary JSONB, model_id='sam-3d-body-vith', analysis_kind='biomech')` + `biomech_jobs status=completed` + `agent_runs` trace
- `GET /api/agent/biomech/status?submissionId=` — poller for UI (2s), returns frames + summary + trace

### 3.4 Cost — one Modal call per clip, multiple workflows free + Meta protocol

- **Modal:** L4 naive `$0.002/clip @3 FPS (45 frames/15s)` → $1 = ~115 min naive / 7 hrs INT8 (`§1`). **Calling Modal twice = 2×** (`2×$0.002=$0.004` → 57 min/$1). **Avoid:** reuse `mhr_results` + filter by use case.
- **Meta SAM 3.1:** `$0.20/1k frames` → 45 frames = `$0.009 per segment_concepts pass` — **1 pass per agent run** regardless of 4 or 8 concepts. 16-concept naive = same 1 pass if batched. 100-engine would be 100× → agentic saves 92%.
- **Planner LLM + reasoning:** `muse-spark-1.3` `reasoning:{effort:"medium", summary:"auto"}` (reasoning tokens bill as output, share `max_output_tokens`); `logprobs` unsupported; for hardest triage `muse-wonder-1.0` `max` (beyond xhigh) but not with contributor-mode; reasoning-replay via `previous_response_id` or stateless `include:["reasoning.encrypted_content"]` + replay `reasoning` input item (see [reasoning](/docs/reasoning)). Prompt cache automatic — order stable system `BIOMECH_KEYWORDS` first, variable video/intent last, `prompt_cache_key:"aruga-biomech"` high-volume, `prompt_cache_retention:"24h"` hint; check `input_tokens_details.cached_tokens`.
- **Planner LLM (legacy):** `<$0.001/run` (4-8 keywords).
- **Responses streaming:** Tool args stream via `response.function_call_arguments.delta/done`; accumulate by `call_id` (Responses) vs `index` (Chat). Keep `call_id` 1-64 chars. **Tool search** (if U1-U11 grows >20 tools): add `{type:"tool_search"}` + `defer_loading:true` namespaces (<10 funcs, hosted or client execution) — Responses+Messages only, not Chat, not combinable with `json_schema` same turn (sequence turns) [tool-search](/docs/tool-search).

**Structured output constraints:** `text.format` (Responses) / `response_format` (Chat) depth ≤10 / 5k props / 120k string chars / 1k enum vals / 200k expanded nodes; recursive $ref rejected; `strict:true` subset roots plain object, `additionalProperties:false`+`required` every key — see [structured-output](/docs/structured-output).

**Rule:** Dropdown U1+U5+U11 = **1 Modal inference → 3 views**, no double charge.

### 3.5 Revision checklist — Modal

- [ ] Signed URL TTL 10 min vs direct upload to Volume?
- [ ] `sampleFps`: 3 (115 min/$1) or 5 (1.7× cost, smoother ROM)?
- [ ] `inferenceType`: `body` V1 or `hand` refine (5.5 mm) from start?

---

## 4) Agent output (what therapist sees)

**From `§3.2` single JSON → 3 UI layers:**

1. **Per-frame biomech (Modal):** `frames[].angles` + `rom` + `neckAngles` + `confidence {pose, angleErrorDeg}` + `flags` + `pred_keypoints_3d/2d` 55 joints, `pred_vertices` 18k
2. **Summary (BiomechPanel `components/therapist/BiomechPanel.tsx`):**
   - ROM cards: `Shoulder 142°→158°`, `Neck 38°→52°`, deficit `22° from 180°`
   - Compensation chips: `Mild trunk lean`, `Forward-head moderate (>25°)`
   - Gait/TUG (U3/U4): `Symmetry 0.94`, `TUG 11.2s`, `risk moderate_fall`
   - Chart: Recharts angle vs time + skeleton `SamOverlay mhrJoints2d` SVG (`components/ui/sam-overlay.tsx:31`)
3. **SOAP draft (tool `draft_soap` → `page.tsx:609`):**
   - `objective`: `"Cervical flex 38°→52°, chin tuck 2/5 reps; Trunk lean <5° 80%"`
   - `assessment`: `"Forward-head moderate — cue chin tuck"`
   - `plan`: `"Continue pincer/chin-tuck 1×/day, 30s rest" (`page.tsx:336`)`
   - `client_summary`: plain language

**Visibility:** therapist-only draft until `handleSaveReview publish` (`page.tsx:651`); shows `confidenceOverall 0.78` + disclaimer.

### 4.1 ROM estimation

- **How:** joints → vectors → angles per frame @3 FPS → ROM = `min/max per clip` + deficit vs normative (shoulder 180°, elbow 0°, forearm pron 80-90°). Hand `Freihand PA-MPJPE 5.5 mm` → pinch aperture.
- **Stored:** `ai_analyses.mhr_results.frames[].rom` + `biomech_summary` → longitudinal `therapist/clients/[id]` trend (U9).
- **Accuracy:** MPJPE 54.8-61.7 mm, PVE 60.3 mm (`§6`) — large ROM (shoulder/knee) ~3-5° error (reliable); small ROM (wrist 10°, chin-tuck 12mm) low confidence → flag only, therapist confirms `page.tsx:478`.

### 4.2 Confidence

- **Paper:** MPJPE 54-61 mm, PVE 60 mm, hand 5.5 mm.
- **Per-run:** SAM `box.confidence 0.97` + MHR `pose 0.82` → `confidenceOverall`, `angleErrorDeg 3.5` + `rom_confidence`. <0.6 = blur/occlusion → `low_confidence`, baggy clothes/backlight ×1.5-2 error, frontal 2-3m good light = paper numbers.

---

## 5) Use cases — dropdown intents for agentic planner (16-only)

> V1 scope = U1+U5+U11+U10 (UE ROM + trunk + neck + SOAP). Planner picks 2-8 keywords per intent from 16. All share 1 Modal inference if same clip.

| # | Use case (dropdown) | Where in app | Agent picks from 16 | Modal metric | Output → SOAP/UI | Priority |
|---|---|---|---|---|---|---|
| **U1** | **UE ROM tracking** | `therapist/submissions/[id]` — “Cup Lift”, “Washcloth” (`page.tsx:188`) | `person, shoulder, elbow, forearm, wrist` (5) | Shoulder/elbow flex, pron/sup curves, ROM min/max | `objective` “Shoulder 142°→158°, deficit 22°”; chart | [ ] P0 V1 |
| **U2** | **Hand/fine-motor** | Pedia peg/Play-Doh (`mockSteps`), adult `pinch clothespin` | `person, hand, finger, thumb` (4) | Hand 5.5 mm: pinch aperture, opposition, hold | Timeline; `plan` “Continue pincer 1×/day” | [ ] P2 |
| **U3** | **Gait symmetry & LE** | Adult/gero `gait belt, cane, walker`; `knee, foot, ankle joint` | `person, hip, knee joint, ankle joint, foot` (5) | Knee flex, dorsiflex, symmetry, foot-flat | Gait report; `knee valgus` flag | [ ] P1 |
| **U4** | **TUG / fall-risk** | Gero `rollator, toilet seat` + TUG chart (`schema.sql:144`) | `person, trunk, hip, knee joint, neck` (5) | Sit→stand, walk vel, turn → TUG sec, Berg proxy | `assessment` “TUG 11.2s”; Berg chart | [ ] P1 |
| **U5** | **Trunk compensation** | Adult hemiparesis `trunk <5°` (`page.tsx:326`) | `person, trunk, cervical spine, thoracic spine` (4) | Trunk lean, shoulder hike, pelvic obliquity | Chip “Mild — cue upright”; `draft-feedback` | [ ] P0 V1 |
| **U6** | **Sit-to-stand/transfer** | `transfer board, bed rail, bench` | `person, hip, knee joint, trunk` (4) | Hip/knee synchrony, weight shift, rise time | Score 0-4 + “30s rest” (`page.tsx:336`) | [ ] P1 |
| **U7** | **Bimanual coordination** | Pedia “Lid Unscrewing”, adult “rocker knife” | `person, hand, shoulder` (3) | Inter-hand dist, timing | Coordination % | [ ] P2 |
| **U8** | **Adherence scorer** | `HomeProgram.steps` → `GeneratedActivity` (`database.ts:240`) | `person, shoulder, elbow, wrist` varies | Completion vs ROM/reps, “4/5 @≥80%” | Badge green/yellow/red | [ ] P1 |
| **U9** | **Longitudinal dashboard** | `therapist/clients/[id]` + `dashboard` | Aggregated | Trends over `submissions.submitted_at` | Chart + PDF `lib/pdf` | [ ] P1 |
| **U10** | **Auto SOAP Objective** | `api/ai/soap-summary` + `page.tsx:609` | All picked | Sentences from `mhr_results` | “Fill Objective” → SOAP | [ ] P0 V1 |
| **U11** | **Neck control — chin tuck (all ages)** | All ages — tummy-time, tech-neck, dysphagia, TUG turn | `person, neck, cervical spine, thoracic spine, trunk` (5) | Neck flex/lateral/rotation, chin-tuck, >25° flag | `objective` “Neck 38°→52°, 2/5 reps”; Neck card | [ ] P0 V1 |

### 5.1 Revision prompts

- [ ] Reorder P0/P1/P2 — V1 top 3? (U11 now P0 cross-age)
- [ ] Drop U7 if out of scope?
- [ ] U11 separate card or merge into U5?
- [ ] Client-visible vs therapist-only per use case (`page.tsx:651` publish gate)?

---

## 6) Frontend integration (therapist side only)

- **Trigger:** Dropdown `Use Case U1-U11` + “Analyze biomechanics (Agent)” button (`page.tsx:982` beside “Analyze with Meta”) → `POST /api/agent/biomech/run {intent}` — disabled until video exists
- **Status:** `analyzingStepId` + `biomechJobs[stepId]` poll `GET /api/agent/biomech/status` 2s; show trace “Planner picked 5 concepts → SAM 12/45 → MHR Frame 12/45” + `processingMs`
- **Overlay:** `components/ui/sam-overlay.tsx:31 SamOverlay` + `mhrJoints2d?: [x,y][]` + `mhrConfidence` → SVG skeleton + angle labels + confidence color; keep `boxes/svgPaths` for objects if needed
- **Charts:** New `components/therapist/BiomechPanel.tsx` — Recharts lines (angle vs time, 1 line per picked joint), ROM min/max cards, compensation chips, Neck chin-tuck gauge, confidence badge, “Insert into Objective” → `setSoapObjective`
- **Trace drawer:** Collapsible `agent_runs` thought/action/observation for audit
- **Visibility:** Only after `handleSaveReview publish` (`page.tsx:651`); draft private like `submission_reviews`

### 6.1 Therapist journey — feedback on each `HomeProgram` step

> This is the primary usage: therapist reviews `step_submissions` one by one (each step = one assigned `GeneratedActivity` video, linked via `HomeProgram.steps → GeneratedActivity → step_submissions`, `database.ts:240`, `supabase/schema.sql` `step_submissions`). Journey repeats per step; 1 agent run = 1 step.

**Step 1 — Open submission:** Therapist navigates `therapist/submissions/[id]` (`submissions/[id]/page.tsx`). Top shows `submissions` header (client, program, `submitted_at`), tabs `Steps (N)` — one card per `step_submissions` in assigned order (`HomeProgram.steps`).

**Step 2 — Per-step video context:** Each step card shows: `GeneratedActivity` title/thumbnail, client-recorded clip (max `MAX_VIDEO_SECONDS=30`), client note if any. Video player is source for `videoUrl` (Supabase signed URL, 10m TTL) sent first to Meta, then Modal (§3).

**Step 3 — Choose intent (dropdown):** Above that step’s player: **Use Case dropdown `U1-U11`** (§5) + hint badge (e.g., step “Cylindrical Cup Lift” defaults to `U1 UE ROM`; “Tummy-time head lift” defaults to `U11 Neck`). Dropdown value = `intent` fed to planner (e.g., `U11 neck control`, `ageBand: pedia`). No global setting — intent is per-step.

**Step 4 — Run agentic loop (per step):** Click **“Analyze biomechanics (Agent)”** (`page.tsx:982` beside “Analyze with Meta”) — enabled only when that step has video. Calls `POST /api/agent/biomech/run { submissionId, stepSubmissionId, intent, ageBand }` (§3.3). Card shows live trace poll `GET /api/agent/biomech/status` 2s: `Planner picked [person,neck,cervical spine,trunk] (4) → SAM 12/45 → MHR Frame 12/45 → drafting SOAP`. `biomech_jobs` + `agent_runs` rows keyed to `step_submission_id` (not just `submission_id`).

**Step 5 — See results anchored to that step:**
- **Overlay on that step’s video:** `SamOverlay` (`components/ui/sam-overlay.tsx:31`) + `mhrJoints2d` skeleton + angle label (e.g., `neck flex 38°`) — scrub synced with chart.
- **`BiomechPanel` docked under that step’s video:** Recharts angle vs time (only lines for picked joints — e.g., U11 = neck flex/lateral/rotation + trunk lean), ROM cards `Neck 38°→52° (range 14°)`, deficit `8° from norm`, compensation chips `Forward-head moderate (>25°)`, gait/TUG if U3/U4, confidence badge `0.78`, Neck chin-tuck gauge if U11.
- **Trace drawer (audit):** collapsible `agent_runs.trace` `[thought,action,observation]` per step.

**Step 6 — Act per step (feedback):**
- **“Insert into Objective”** per card → appends formatted line to that step’s SOAP `objective` textarea (`page.tsx:609 handleAutoFillFromAiObservations`) — e.g., `Step 2 — Objective: Cervical flex 38°→52°, chin tuck 2/5 reps; Trunk lean <5° 80%`. Can insert multiple cards (ROM + flag).
- Free-type therapist feedback textarea + `confirmedObs` (`page.tsx:478`) checkboxes to confirm/reject each flag before publish.
- Mark that `step_submissions` Reviewed (badge green), auto-scroll to next step card. Cost: 1 Modal inference per step run; revisiting dropdown filters same `mhr_results` JSON — no re-bill unless re-run.

**Step 7 — Publish (all steps → client):** After all step cards Reviewed → **Save Review → Publish** (`handleSaveReview publish` `page.tsx:651`). Flips `submission_reviews status draft→published`; client sees per-step feedback + biomech summary cards (same `BiomechPanel` read-only). Draft stays therapist-only before publish, like `submission_reviews status=draft/published`.

**Key invariant:** `HomeProgram.steps` order = review order; `stepSubmissionId` is the grain for `biomech_jobs` / `agent_runs` / `mhr_results` (not `submissionId` alone), so replaying U1 then U11 on same step = 1 Modal call, 2 panel filters.

---

## 7) Data & cost

**Migration:**
```sql
alter table ai_analyses add column if not exists mhr_results jsonb;
alter table ai_analyses add column if not exists biomech_summary jsonb;
create table if not exists biomech_jobs (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references submissions(id) on delete cascade,
  step_submission_id uuid not null references step_submissions(id) on delete cascade,
  status text not null check (status in ('queued','processing','completed','failed')),
  modal_job_id text, timing_ms int, error text, created_at timestamptz default now()
);
create index on biomech_jobs(submission_id);
create table if not exists agent_runs (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references submissions(id) on delete cascade,
  intent text not null, concepts text[] not null,
  trace jsonb not null, -- [{thought, action, observation}]
  status text not null, created_at timestamptz default now()
);
```

**Meta observables per run:** `usage.input_tokens_details.cached_tokens` + `usage.output_tokens_details.reasoning_tokens` + `previous_response_id` chaining for audit; file handling: upload video mp4 via Files API `purpose:"user_data"` then `input_file:{file_id}` in Responses [file-handling](/docs/file-handling).

**Cost per 15s clip @3 FPS (45 frames, 1 agent run, 4-8 concepts):**
- Modal L4 naive `$0.002` (115 min/$1), INT8 `$0.0006` (7 hrs/$1); dense 30 FPS 10× — avoid.
- Meta SAM 3.1 `$0.009` (1 pass, 4-8 concepts batched) vs 100-engine `$0.02`→ **agentic saves 55-92%**.
- 2 workflows same clip = **reuse** → $0; 2 separate clips = 2×.

---

## 8) Phased build (16-only agentic)

- **Phase 0 (this week, no Modal):** Create `src/lib/meta/biomech-prompt.ts` `BIOMECH_KEYWORDS` 16 + `isBiomechKeyword()` + `POST /api/sam-stream` SSE proxy + mock skeleton on `SamOverlay`; deprecate `sam-engines/index.ts` import
- **Phase 1 (1 wk):** Modal `app.py` T4 naive + `POST /api/agent/biomech/run` planner (GPT-4o mini) + 3 tools + `biomech_jobs`/`agent_runs` + `BiomechPanel` + poll; demo `/demo/cup_grasp_transfer.mp4` U1+U11
- **Phase 2 (1 wk):** Switch to `embedl/sam-3d-body` INT8 TRT + hand decoder + reference-item focal; auto SOAP fill + longitudinal trend
- **Phase 3:** PDF export, HIPAA BAA note, `sam-3d-objects` alignment

---

## 9) Risks & mitigations

- **Gated ckpt 1.69 GB cold start:** Modal Volume cache + `keep_warm=1`
- **Keyword hallucination outside 16:** `assertSamTextConcept` + enum validation → reject, planner retry
- **Body-part prompts weak:** Fall back to `person` only — MHR recovers all joints without per-limb masks
- **PHI on GPU:** Signed URLs 10m TTL, no Modal persistence, `x-modal-secret` webhook, VPC if BAA
- **Accuracy ≠ Vicon:** MPJPE 54-61 mm → 3-5° error large ROM; UI disclaimer + `confirmedObs` (`page.tsx:478`) before publish

---

## 10) Open questions

1. [ ] Max concepts per agent run: 6 or 8?
2. [ ] Deprecate `sam-engines/index.ts` 100-keyword engines now or keep as reference?
3. [ ] `MAX_VIDEO_SECONDS` cap: 30 or 15s @3 FPS to stretch $1?

---

**Next step:** Edit checkboxes, commit, and say `approve BIOMECH_ENGINE_PLAN` to scaffold `BIOMECH_KEYWORDS` + `api/agent/biomech` + Modal `app.py` agentic.
