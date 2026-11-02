# Aruga Agents Guide — Agentic Workflows for Clinical Home Programs

**Document Version:** 1.2  
**Date:** 2026-11-02  
**Plans Source of Truth:** `plan/ACTIVITY_AGENT_PLAN.md` · `plan/BIOMECH_ENGINE_PLAN.md` · `plan/BIOMECHANIC_AGENT.md` · `plan/GOAL_TRACKING_AGENT_PLAN.md` · `plan/HIGHLIGHTS_AGENT_PLAN.md`  
**Meta Stack:** Meta Model API `https://api.meta.ai/v1` · `muse-spark-1.3` · `muse-spark-1.3-contributor` · `muse-image-1.0` · `sam-3.1` · `muse-wonder-1.0` (escalation) · `web_search` grounding  
**Status:** Activity + Aruga Guide live; **Biomechanic Agent playground live at `/tools/biomech`** (Spark→SAM 3.1→Modal→Synthesize+Viz); Goal/Highlights in staged rollout (see §10)

> **One-liner:** Five agents turn a home program from prescription → performance → progress — with an always-on companion. Therapist stays in control — **1 button per agent**, always **draft pending approval**, never silent writes.

---

## Table of Contents

1. [Executive Summary — What Are Aruga Agents?](#1-executive-summary--what-are-aruga-agents)
2. [Meta AI Products & Other Services Used](#2-meta-ai-products--other-services-used)
3. [System Architecture — How Agents Compose](#3-system-architecture--how-agents-compose)
4. [Agent 1 — Activity Agent (Generate Activity per Step)](#4-agent-1--activity-agent-generate-activity-per-step)
5. [Agent 2 — Biomech Engine (SAM 3.1 → Modal MHR)](#5-agent-2--biomech-engine-sam-31--modal-mhr)
6. [Agent 3 — Goal Tracking Agent (STG/LTG vs SOAP + Performance)](#6-agent-3--goal-tracking-agent-stgltg-vs-soap--performance)
7. [Agent 4 — Highlights Agent (Monthly 7 Adaptive Highlights)](#7-agent-4--highlights-agent-monthly-7-adaptive-highlights)
8. [Agent 5 — Aruga Guide (Always-On Client Companion)](#8-agent-5--aruga-guide-always-on-client-companion)
9. [Activation — 1 Button Per Agent](#9-activation--1-button-per-agent)
10. [Shared Agentic Infrastructure (Meta Vision)](#10-shared-agentic-infrastructure-meta-vision)
11. [File Map — Where Each Agent Lives](#11-file-map--where-each-agent-lives)
12. [Safety, Human-in-the-Loop & HIPAA](#12-safety-human-in-the-loop--hipaa)
13. [Cost Per Agent](#13-cost-per-agent)
14. [Phased Build Status](#14-phased-build-status)

---

## 1. Executive Summary — What Are Aruga Agents?

Rehabilitation home programs fail when they are generic. Aruga's five agents make each `HomeProgram` step **patient-aware**, **measurable**, **trackable over time**, and **explainable to the client** — while keeping the licensed therapist as the final decision-maker.

| Agent | One-line job | Where therapist/client clicks | Autonomy |
|---|---|---|---|
| **Activity Agent** | Drafts a patient-tailored printable worksheet (line art + instructions) for **each step** | `therapist/clients/[id]/programs/new` → per-step `Draft with Agent` | **Auto-draft on edit (debounced) → pending approval** |
| **Biomech Engine** | Segments video (SAM 3.1) → estimates 3D biomechanics (MHR on Modal) → ROM + flags + overlay | `therapist/submissions/[id]` → per-video `Analyze biomechanics (Agent)` + Use Case dropdown · **Playground** `Tools → Biomechanic Agent` `/tools/biomech` (no word bank — Spark thinks from prescribed activity) | **1 click → Spark picks 2-8/16 → 1 SAM pass + 1 Modal inference; dropdown/preset re-filters cached `mhr_results`, no re-bill** |
| **Goal Tracking** | Checks STG/LTG vs SOAP S/O/A/P + biomech + adherence → verdict `on_track/at_risk/behind/achieved/gap` | `therapist/clients/[id]` header → `Check goals` | **Manual + auto on new data, always draft until Publish** |
| **Highlights** | **Thinks and picks the best 7 data points** for the month from SOAP + Home Program feedback + goals + adherence + activity performance | `therapist/clients/[id]` or `client/dashboard` → `Generate highlights` (or monthly auto 1st) | **Draft 7 → Publish to client strip** |
| **Aruga Guide** ★ | Always-on companion — explains home program in everyday words, answers questions with web-grounded citations, handles images/video frames, escalates to therapist | `Aruga Guide` `/aruga-guide` (client + therapist) → `Send message` + attach image/video · `Send to clinician` gate | **Conversational, no draft** — therapist verifies via *Send to clinician* `page.tsx:690`; 6/7 Meta compliant, web_search grounded |

**Shared invariant:** The 4 program agents produce a **draft** — nothing published until therapist taps **Approve / Publish**. **Aruga Guide** is conversational (no draft) but **never silently writes to chart** — *Send to clinician* is the human gate. All agents assistive, not autonomous clinicians.

---

## 2. Meta AI Products & Other Services Used

### 2.1 Meta AI Products (primary)

| Product | Model ID | What Aruga uses it for | Billing unit | File |
|---|---|---|---|---|
| **Muse Spark 1.3** (reasoning) | `muse-spark-1.3` (standard) / `muse-spark-1.3-contributor` (cheap) | Activity spec JSON, biomech planner concept picking, goal verdicts, highlights curation; Responses API `reasoning:{effort:"medium"/"high", summary:"auto"}` | Input $1.25/1M + Output $4.25/1M (standard); Contributor $0.10/$0.20 | `src/lib/meta/client.ts` `activity-generator.ts` `agent.ts` |
| **Muse Spark — Structured Output** | `text.format=json_schema` strict | All agent outputs validated against Zod (`ActivitySpecSchema`, goal/highlights schemas); depth ≤10 / 5k props / 120k chars — `MAX_TOKENS 6000` retry `7000` concise on `finish_reason=length` | Same as above (reasoning tokens bill as output) | `src/lib/meta/schemas.ts` |
| **Muse Image** | `muse-image-1.0` | Printable line-art worksheet render from `refinedImagePrompt` (≤600ch); toggle via `Generate image with Muse Image` checklist | $0.01 / image | `src/lib/meta/activity-generator.ts:runMuseImage` |
| **SAM 3.1** (media segmentation) | `sam-3.1` via `POST /v1/responses` + `@meta-sam/parser` SSE | Temporal object segmentation: `segment_concepts(concepts: BIOMECH_KEYWORDS[16])` → boxes `[ymin,xmin,ymax,xmax] 0-1` + RLE masks → overlay · **Biomechanic playground** `sam-engine.ts:304` concurrency 2, cache 5m, IoU 0.9 dedup; moving `viewBox 0 0 1 1` boxes + `BiomechOverlay.tsx:328` skeleton/HUD parity with `/sam-test:999` | $0.20 / 1k frames (min 50) → ~$0.009 per 45-frame pass | `src/lib/meta/sam.ts` `sam-engine.ts` `src/app/tools/biomech/page.tsx` |
| **Muse Wonder 1.0** (optional) | `muse-wonder-1.0` `reasoning:{effort:"max"}` delegate-to-subagents | Escalation for complex triage (long-horizon, max reasoning) — not on contributor; Highlights may delegate for month-over-month synthesis | Standard pricing, higher output budget | Plan § meta-notes |
| **Files API** | `POST /v1/files` `purpose:"user_data"` + `input_file:{file_id}` | Video mp4 upload for SAM 3.1 (not raw to Modal); 10m TTL signed Supabase URL handoff | Free upload; billed on inference | `src/lib/meta/client.ts` |
| **Responses API** | `openai.responses.create` `previous_response_id` reasoning replay · `parallel_tool_calls:true` · `prompt_cache_key`+`24h` | All agentic loops (planner + tools) — preserves reasoning chain across tool turns; Chat Completions cannot replay `reasoning_content` · **Biomechanic Agent** `biomech-agent.ts` `reasoning:{effort:"medium", summary:"auto"}` + 4 tools `get_prescribed_activity_context / select_biomech_concepts / evaluate_history_trend / draft_clinical_insights` + `tool_choice:auto` + `previous_response_id` chaining | Token counting preflight `POST /v1/responses/input_tokens` | `plan/BIOMECHANIC_AGENT.md:§3-5` `src/lib/meta/biomech-agent.ts` |
| **Prompt Caching** | `prompt_cache_key:"aruga-*"` `prompt_cache_retention:"24h"` | Stable system prompt first (BIOMECH_KEYWORDS, age-band guidance), variable input last → `cached_tokens` reduced billing · Biomech `prompt_cache_key:"aruga-biomech-planner"` | Automatic; monitor `usage.input_tokens_details.cached_tokens` | `src/lib/meta/client.ts` `src/lib/meta/biomech-planner.ts:5` |
| **Tool Search** | `{type:"tool_search"}` namespaces | When tool count grows >20 (e.g., U1-U11 + goals + highlights tools) — Responses+Messages only, not combinable with `json_schema` same turn (sequence turns) | — | Plan §3.4 |

**Docs:** [dev.meta.ai/docs/overview](https://dev.meta.ai/docs/overview) · `/docs/tool-calling` · `/docs/prompt-caching` · `/docs/reasoning` · `/docs/structured-output` · `/docs/pricing-rate-limits` · `/docs/file-handling`

### 2.1a Aruga Guide AI Agent — How It Fares on Meta Docs (2026-11-02)

> **Location:** `src/app/aruga-guide/page.tsx` · `src/lib/meta/spark.ts:runSparkOtChatAgentic` · `src/lib/meta-ai.ts:otChatAssistant` · `src/app/api/ot-chat/route.ts`  
> **Evaluation date:** 2026-11-02 · **Base:** `https://dev.meta.ai/docs/overview` + `protocols/responses` + `tool-calling` + `reasoning` + `search-grounding` + `structured-output` + `prompt-caching` + `pricing-rate-limits`

| Meta capability | What docs require | Aruga Guide verdict | Evidence |
|---|---|---|---|
| **Overview — agentic identity** | Agent = planner + tools + memory + human approval (`overview: Muse Spark is an agent model`) | ✅ **Agentic** — planner decides grounding, web_search runs, therapist verifies via *Send to clinician* `page.tsx:690` | `spark.ts:runSparkOtChatAgentic` owns loop; UI keeps human gate |
| **Protocols — Responses API** | `POST /v1/responses` with typed `input[]`, `instructions`, `store:false`+`include:["reasoning.encrypted_content"]` or `previous_response_id` (`protocols/responses:38,60`) | ✅ **Compliant** — typed `input` (`input_text`/`input_image`), `instructions: buildOtChatSystemPrompt()`, `store:false`, `include: reasoning.encrypted_content` (skipped on `contributor` where `max` unsupported) | `spark.ts: runSparkOtChatAgentic` `input: [...]` + `store:false` + `baseReq.max_output_tokens:4000` |
| **Tool calling** | `tools:[{type:"function"}]` + `parallel_tool_calls:true`, `tool_choice:"auto"` only, `call_id 1-64` (`tool-calling:20,108`) | ✅ **Compliant** — built-in `web_search` (`search-grounding` variant) with `tool_choice:auto` + `parallel_tool_calls:true`; `call_id` validated 1-64 on any future `function` tools (`fetch_profile` etc.) | `tools:[{type:"web_search"}]` `spark.ts: baseReq.tools`; fallback without tools if host rejects |
| **Search grounding** | `tools:[{type:"web_search"}]` server-side, annotations inline (`search-grounding`) | ✅ **Web articles** — replaces PubMed/OpenAlex `grounding.ts:98,151`; annotations → `ClinicalReference[]` `grounding.ts:3` same `References (n)` UI `page.tsx:902` | `refs` dedup `spark.ts: agenticRefs` → `meta-ai.ts: references.map(web→ClinicalReference)` |
| **Reasoning** | `reasoning:{effort:"minimal"/"low"/"medium"/"high"/"xhigh"/"max", summary:"auto"/"concise"/"detailed"}`; reasoning tokens bill as output, share `max_output_tokens` (`reasoning:22,84,98`) | ✅ **Medium + auto** — `reasoning:{effort:"medium", summary:"auto"}` on 1.3; `max` correctly avoided on `contributor` (`spark.ts: isContributor`) | `baseReq.reasoning` + `include: reasoning.encrypted_content` |
| **Structured output** | `text.format=json_schema` strict on Responses, `response_format` on Chat (`structured-output`) | ✅ **For agents** (`ActivitySpecSchema` `schemas.ts:70` via `text.format` / `response_format`); **Guide is free-form** (intended) — still validates `ClinicalReference[]` shape before render | `spark.ts: callSparkStructured` + Guide `formatReferencesSection` `grounding.ts:217` |
| **Prompt caching** | `prompt_cache_key` + `prompt_cache_retention:"24h"`; stable prefix first (`prompt-caching`) | ⚠️ **Partial** — `instructions` byte-identical + `clientContext` first `input` item cache-friendly; explicit `prompt_cache_key` not yet set (next: `aruga-guide-${conversationId}`) | Roadmap: add `prompt_cache_key` + count `cached_tokens` from `usage` |
| **Pricing** | Input $1.25/1M + Output $4.25/1M (standard), Contributor $0.10/$0.20 + reasoning billed as output (`pricing-rate-limits`) | ✅ **Tracked** — ~$0.003–0.006/msg (`medium` + web_search) → ~300 msgs/$1 vs $0.012–0.015 Activity (Spark+Image) | `docs/COST_GUIDE.md` + `COST_GUIDE` margins 94-96% remain |
| **Error handling** | 504 on non-stream long calls, `rate`/`timeout` typed, `store:true` persists after disconnect (`protocols/responses:72` + `error-handling`) | ✅ **Resilient** — 55s timeout `spark.ts: baseReq timeout 55000`, fallback to Chat Completions on `web_search` unsupported, `maxDuration:60` `ot-chat/route.ts:6` | `catch → fallback runSparkOtChat` `meta-ai.ts: otChatAssistant` |

**Overall: 6/7 fully compliant, 1 partial** (prompt caching key). PubMed/OpenAlex `src/lib/meta/grounding.ts` retained for fallback/history import only; **web search is now primary grounding** per request — references render identically `src/lib/meta/grounding.ts:217` → `page.tsx:904`.

### 2.2 Other Services That Come With It

| Service | Role in agent loop | Why not Meta alone |
|---|---|---|
| **Modal (GPU)** `facebook/sam-3d-body-vith` L4 | **MHR 3D Body inference**: `estimate_biomech(samPerson)` → `pred_keypoints_3d/2d`, `pred_vertices` 18k, `angles`, `rom`, `flags`, `confidenceOverall` | Muse/SAM cannot do 3D joint angles; Modal holds 1.69 GB ckpt + 3.4 GB ONNX / 0.9 GB INT8; `Volume("sam3db-ckpts")` + `keep_warm=1` → ~1.8s/clip |
| **Supabase (PostgreSQL + Storage + Auth)** | Source of truth for `patients`, `profiles`, `home_programs`, `program_steps`, `submissions`, `step_submissions`, `generated_activities`, `activity_templates`, `soap_notes`, `goals`, `goal_reviews`, `highlights`, `biomech_jobs`, `agent_runs`; 3 private buckets `program-videos`/`chat-attachments`/`activity-assets` (`public=false`, `TO authenticated`) | HIPAA RLS, `therapist_owns_patient` ownership checks, signed URLs (15m video, 60m chat), `nanoid(12)` paths, EXIF strip `sharp.rotate()` |
| **Next.js 16 (App Router)** + **Vercel** | Thin orchestrator: `POST /api/agent/*/run` planners, ownership guards, SSE proxy, webhook `POST /api/mhr/webhook`, trace persistence | Keeps `MODEL_API_KEY` server-only (`server-only` modules), `maxDuration=60` for long reasoning |
| **OpenAI SDK** (Meta-compatible) | `createMetaOpenAiClient()` `baseURL="https://api.meta.ai/v1"` Bearer `MODEL_API_KEY` | Lets Aruga use `chat.completions` + `responses.create` + `images.generate` + `files.create` through one client |
| **@meta-sam/parser** | SSE streaming parser: `parseVideoStream` → `recordsOfKind(box|mask)` → `transformMaskPathToNormalized` → `SamOverlay` SVG | Canonical SAM 3.1 temporal output handling |
| **Recharts** | Longitudinal charts: ROM max vs time, adherence % dual axis, highlights sparkline, goal progress vs deadline | Visual trace for therapist/client |
| **Replicate / Poly Haven (optional import)** | Asset search/import for worksheet reference images (not agent loop) | Therapist-provided visual anchors |

**Why this split:** Meta = language + vision understanding + visual generation; Modal = GPU 3D body mesh (no browser WASM — 65 MB already janks); Supabase = HIPAA data + auth; Next = privacy boundary + audit.

---

## 3. System Architecture — How Agents Compose

```
                    ┌─────────────────────────────────────────────────┐
                    │   Therapist prescribes  Home Program (steps)    │
                    │   therapist/clients/[id]/programs/new          │
                    └────────────────┬────────────────────────────────┘
                                     │ per step
                    ┌────────────────▼────────────────┐
                    │  AGENT 1 — Activity Agent        │  Muse Spark 1.3 (6000 tok) + Muse Image
                    │  fetch_patient → list_templates  │  reasoning:medium · json_schema · prompt_cache
                    │  → generate_activity (Spark+Img) │  → generated_activities draft → Approve/Edit/Regen/Reject
                    └────────────────┬────────────────┘
                                     │ program_steps.generated_activity_id
                    ┌────────────────▼────────────────┐
                    │   Client practices, draws/photos  │  Canvas draw+save · print/download · photo fallback
                    │   activity_completions + videos   │  5MB cap · uq_activity_completion_step_sub
                    └────────────────┬────────────────┘
                                     │ per step video
                    ┌────────────────▼──────────────────────────────────────────────┐
                    │  AGENT 2 — Biomech Engine (Biomechanic Agent)                │
                    │  Spark planner 2-8/16 (no 700 word bank) → SAM 3.1 → Modal MHR │  reasoning:medium · previous_response_id
                    │  → evaluate_history_trend → draft_clinical_insights            │  biomech_jobs · agent_runs
                    │  Playground /tools/biomech + Clinical therapist/submissions/[id] │  Dropdown/presets re-filter cached mhr_results (no re-bill)
                    │  Overlay: moving boxes viewBox 0 0 1 1 + skeleton + HUD + sparkline │  BiomechOverlay parity with /sam-test:999
                    └────────────────┬──────────────────────────────────────────────┘
                                     │ mhr_results + completions
                    ┌────────────────▼────────────────┐
                    │  AGENT 3 — Goal Tracking          │  Muse Spark 1.3 reasoning:high (7 signals)
                    │  fetch_goals + fetch_evidence     │  Verdict on_track/at_risk/behind/achieved/gap
                    │  → draft_goal_review (LLM-only)   │  goal_reviews → Insert into Plan · Publish
                    └────────────────┬────────────────┘
                                     │ goal_reviews + prior agents
                    ┌────────────────▼────────────────┐
                    │  AGENT 4 — Highlights            │  Muse Spark 1.3 reasoning:high adaptive
                    │  fetch_month (SOAP+feedback+goals│  Think + pick best 7 by |Δ|×consistency×confidence
                    │  +adherence+performance) → 7     │  highlights → Publish strip to client/dashboard
                    └─────────────────────────────────┘

   Data flow: Supabase (patients/profiles/home_programs/generated_activities/step_submissions/soap_notes/goals)
   → Next api/agent/* (therapist_owns_patient check, x-requester-id)
   → Meta (Spark/SAM/Muse Image) + Modal (MHR)
   → Supabase (draft tables: generated_activities / ai_analyses.mhr_results / goal_reviews / highlights / agent_runs)
   → Therapist Approve/Publish → Client sees (program-videos signed URL, HighlightsStrip, completion canvas)
```

**Key invariant:** Each agent **reuses** prior agents' outputs — Highlights consumes Biomech + Goal Tracking; Goal Tracking consumes Biomech. No agent re-infers GPU work already done.

---

## 4. Agent 1 — Activity Agent (Generate Activity per Step)

> **Source:** `plan/ACTIVITY_AGENT_PLAN.md` · Live at `src/components/activities/StepActivityControl.tsx` + `src/lib/meta/agent.ts` + `POST /api/agent/activity/run`

### What it does

Turns a free-text step (`title` + `instructions`) into a **patient-tailored printable worksheet draft** — pedagogy + visual brief + line art — in one click, without leaving Home Program creation.

### Input / Process / Output / Journey

| Dimension | Detail |
|---|---|
| **Input** | Step `{ title, instructions, position }` + `patientId` + therapist `creatorId` + `patientContextHint` (derived 80ch) + patient DB context: `patients` (age, `client_category→ageBand` pedia/adolescent/adult/geriatric, condition, therapy_goals), `profiles.display_name`, prior `generated_activities` themes (avoid repetition), `generateImage` checklist |
| **Process** | **3 tools, Responses API** — `fetch_patient` + `list_templates` (parallel, `parallel_tool_calls:true`) → planner picks (a) best System template + theme override OR (b) custom prompt synthesized from `patient.ageBand + condition + step` → `generate_activity` → `runSparkActivitySpec({ ageBand, category, templatePrompt/imagePrompt, titleOverride, theme, difficulty, lineStyle })` (`reasoning:{effort:"medium"}`, `text.format=json_schema` ActivitySpecSchema `src/lib/meta/schemas.ts:70`, `max_tokens:6000` retry `7000` concise on `finish_reason=length`) → optional `runMuseImage(refinedImagePrompt)` (`muse-image-1.0` 1024×1024, ≤600ch) → persist `generated_activities` `status=ready` + `agent_runs` trace |
| **Output** | Single `draftId` (generated_activities.id) **pending approval**: `{ title, instructions≤350ch, visualBrief 70-90w, refinedImagePrompt≤600ch, layoutSpec{ orientation, lineGuides, zones≤4 }, difficulty, estimatedMinutes, warnings, base_image_url|null, reasoning, sources[], modelIds{spark,image}, latencyMs }` — truncated JSON repaired via `tryRepairTruncatedJson` + `patchPartial` defaults if `finish_reason=length` |
| **Journey** | 1) Therapist in `therapist/clients/[id]/programs/new` types step → **auto-draft debounced 900ms** (if instructions ≥10ch) **or** clicks `Draft with Agent` → 1-2s Spark trace → **pending card** under step (title, instructions, reasoning chip, image thumb, latency) → `Approve & Attach` (sets `program_steps.generated_activity_id=draftId`) / `Edit` (opens unified `GenerateActivityAgentModal` System/My/Custom tabs, 420/320ch counters, ReferenceInputs, Save as My Prompt) / `Regenerate` with feedback / `Reject`. Also playground at `/activity-agent-playground` (mock patients, 1.4s trace) |

> **Invariant:** Patient-aware — ageBand + condition + prior themes shape every draft; therapist always picks from draft, never silent attach.

#### 4.1 Agentic Journey (4-step loop)

| Step | Spark does | System does | Output |
|---|---|---|---|
| **1 Gather** | — | `fetch_patient({patientId})` → ageBand (pedia/adolescent/adult/geriatric), condition, therapy_goals, caregiver; `list_templates({ageBand})` → 12 system seeds 420/320ch; history `generated_activities` prior themes | `{patient, templates, priorThemes}` |
| **2 Decide** | Spark `muse-spark-1.3` `reasoning:medium` `text.format=json_schema` strict `ActivitySpec` — picks (a) best System template + theme override OR (b) custom prompt synthesized from `ageBand+condition+step.title+instructions`; `prompt_cache_key:"aruga-activity-agent"`; `reasoning:medium summary:auto` | Validate `ActivitySpecSchema` `schemas.ts:70`; enforce `BUDGET ≤1800ch` `prompts.ts:155` `instructions≤350ch, visualBrief 70-90w, refinedImagePrompt≤600ch, zones≤4` | `{choice:"template"|"custom", reasoning, sources}` |
| **3 Generate** | `runSparkActivitySpec(6000 tok → 7000 concise retry on finish_reason=length)` → `ActivitySpec JSON`; optional `runMuseImage(refinedImagePrompt)` `muse-image-1.0 1024×1024` → url/b64; repair `tryRepairTruncatedJson+patchPartial` | `parallel_tool_calls:true` + `previous_response_id` loop; `x-requester-id` + `therapist_owns_patient` guard | `{sparkSpec, base_image_url, modelIds, latencyMs}` |
| **4 Present** | — | Persist `generated_activities status=ready` + `agent_runs{reasoning,trace}`; render pending card under step with reasoning chip + image thumb + latency | `Approve & Attach` → `program_steps.generated_activity_id=draftId` / `Edit` (System/My/Custom 420/320ch) / `Regenerate`+feedback / `Reject` + playground `/activity-agent-playground` mock 4 patients 1.4s |

**Cost:** Spark ~$0.002–0.004 + Image $0.01 → **`~$0.012–0.015/draft`**; text-only saves $0.01; `generateImage:false` toggle. PromptCache `cached_tokens` $0.15/1M vs $1.25.

**BUDGET guard:** `prompts.ts:155` slices 420/320ch + BUDGET 1800ch + `max_tokens 6000→7000 concise` + `tryRepairTruncatedJson` — fixes `finish_reason=length` breathing/meds scheduler verified `build 0`.

### Evidence-gating & Storage

Zod `ActivitySpecSchema` depth≤10 5k props 120k chars strict; `strict:false` fallback retry; `warnings[]` flags ambiguities; image placeholder SVG on failure (no synthetic worksheet). Persist `generated_activities` + `agent_runs{patient_id, step_position, draft_id, reasoning,trace,status:pending|approved|rejected}`; grain = step `position`; `previous_response_id` kept for `Regenerate with feedback`.

### Process Flow

```mermaid
sequenceDiagram
    participant T as Therapist (StepActivityControl)
    participant N as Next POST /api/agent/activity/run
    participant S as Supabase
    participant M as Muse Spark 1.3 + Muse Image
    T->>N: {patientId, creatorId, step:{title,instructions,position}, generateImage:true}<br/>x-requester-id + therapist_owns_patient check
    N->>S: fetch_patient(patientId) → ageBand, condition, priorThemes
    N->>S: list_templates(ageBand) → 12 system seeds
    N->>M: responses.create(reasoning:medium, json_schema, tools:[fetch_patient,list_templates,generate_activity], prompt_cache_key)
    M-->>N: planner picks template+theme (a) or custom prompt (b) + reasoning
    N->>M: generate_activity → runSparkActivitySpec(6000 tok, BUDGET 1800ch) → runMuseImage?
    M-->>N: ActivitySpec JSON + image url/b64 (or length-retry 7000 tok concise)
    N->>S: insert generated_activities + agent_runs trace
    N-->>T: {draftId, title, instructions, sparkSpec, base_image_url, reasoning, modelIds, pending_approval}
    T->>T: Pending card → Approve/Edit/Regenerate/Reject
```

### Use Cases (template → ageBand)

| # | Activity family | AgeBand hint | Sample step → draft | Key spec |
|---|---|---|---|---|
| A1 | Visual-motor | pedia | Peg Pick & Sort → large targets, low clutter | `lineGuides 2, zones 3` |
| A2 | Fine-motor pincer | pedia/adult | Pincer grasp 5 pegs → contrast circles | `refinedImagePrompt ≤600ch` |
| A3 | Gait/ADL | adult/old_people | Sit→stand kitchen → safe base | `estimatedMinutes 8` |
| A4 | UE reach | adult | Shoulder flex overhead → upright cue | `warnings["monitor compensatory trunk"]` |

### Activation — 1 button

**`Draft with Agent`** (teal) + `Browse templates` (neutral) per step. Auto-draft fires on edit debounce 900ms (≥10ch) — both resolve to same draft card. No video required. Button disabled only while `agentLoading`. Playground `/activity-agent-playground` alias `/activiy-agent-playground` isolated demo.

---

## 5. Agent 2 — Biomech Engine (SAM 3.1 → Modal MHR) — *Biomechanic Agent*

> **Source:** `plan/BIOMECHANIC_AGENT.md` (unified 4-step loop) + `plan/BIOMECH_ENGINE_PLAN.md` · **Playground live** `src/app/tools/biomech/page.tsx` → `/tools/biomech` + `src/app/api/tools/biomech/run/route.ts` · Clinical `therapist/submissions/[id]/page.tsx` · `modal/app.py` + `src/lib/meta/biomech-prompt.ts`  
> **Nav:** `Tools → Biomechanic Agent` in both `src/components/layout/therapist-nav.tsx:78` and `client-nav.tsx:85` (`Activity` icon) — isolated playground, no DB writes required  
> **Model note:** Follows [dev.meta.ai/docs/overview](https://dev.meta.ai/docs/overview) + [start-building](https://dev.meta.ai/lp/start-building) — planner is `muse-spark-1.3` `reasoning:{effort:"medium"}` only *interpreting/filtering*; `modal/app.py:111` `compute_frame_biomech_and_scene` stays deterministic ground truth (Spark never invents angles; `evidenceRef` validated against `mhr` JSON)

### What it does

Turns a client-recorded **per-step video clip** into **segmented overlays + 3D joint angles + ROM + compensation flags** — the quantitative backbone for every downstream agent.  
**Playground invariant:** No 700 word-bank UI — Spark *thinks* what 2-8 of the 16 `BIOMECH_KEYWORDS` to track from `prescribedTitle + prescribedInstructions + ageBand + therapistNeed` alone (`src/lib/meta/biomech-planner.ts:5` `BIOMECH_KEYWORDS` guard `biomech-prompt.ts:5`).

#### 5.1 Biomechanic Agent Playground — Agentic Journey (4-step loop)

> **Files:** `src/lib/meta/biomech-planner.ts` (heuristic fallback `HEURISTIC_MAP` + Spark planner `prompt_cache_key:"aruga-biomech-planner"`) · `src/lib/meta/biomech-agent.ts` (Responses API `reasoning:medium` + 4 tools `get_prescribed_activity_context / select_biomech_concepts / evaluate_history_trend / draft_clinical_insights` `tool_choice:auto` `previous_response_id` chaining) · `src/app/tools/biomech/page.tsx` (SAM-Test viz parity `src/app/sam-test/page.tsx:999` + `BiomechOverlay.tsx:328`)

| Step | Spark does | System does | Output |
|---|---|---|---|
| **1 Determine** | Spark `muse-spark-1.3` `reasoning:medium` `text.format=json_schema` strict `biomech_planner {concepts: 2-8 enum BIOMECH_KEYWORDS, rationale≤220ch}` — therapist free-text `therapistNeed` can trigger multi-turn disambiguation via `previous_response_id`; heuristic `planBiomechConcepts` fallback if `AI_MODE=off` | `get_prescribed_activity_context` + history fetch last 5 `biomech_jobs` per `(patient_id, generated_activity_id)` (playground: `previousMhr` prop) | `{concepts, rationale, source:"spark"|"heuristic", latencyMs}` — always includes `person` first, `assertSamTextConcept` ≤8 words, `BIOMECH_KEYWORDS` 16 lock `src/lib/meta/biomech-prompt.ts:5` |
| **2 Segment → Forward** | — (tool execution) | `sam3Engine.segmentConcepts({videoUrl:signedUrl|dataUrl, concepts, mediaSize})` `sam-engine.ts:304` concurrency 2, cache 5m, IoU 0.9 → `boxes/masks/tracks, billedRequests, latencyMs` → forward `samPerson{concepts,sampleFps:3,mediaSize,boxes,svgPaths,failures}` → `POST {MODAL_MHR_URL}/infer` `modal/app.py:391` `_run_real_sam3db:415` bypasses ViTDet (1060→100ms/frame L4), One-Euro `app.py:59`, `compute_frame_biomech_and_scene:111` | `mhr {frames[].angles/motionAnnotations/biomechTelemetry/confidence, summary{peakAngles,rom,gait,posturalAndDeformity,risk}, modelId, processingMs, flags}` — deterministic ground truth |
| **3 Compare** | Spark synthesis 2nd call `draft_clinical_insights` `json_schema` strict `BIOMECHANIC_AGENT.md:5.3` → `insights[] {id,label,value,unit,threshold,rating:Good|Watch|Needs support,score,evidenceRef,evidenceFrames,explanation,formula}` + `adherence {pct, label, kinematicPct, checklistPct, explanation}` + `trend {direction, delta, summary}` + `goalProgress + objectiveDraft/assessmentDraft + planSuggestion` — **evidence-gated**: `value` must exist in `mhr` JSON before render | Deterministic `deriveExpectation(title,instructions)` + `thresholdBand(value,target)` `biomech-planner.ts:118` → `Good/Watch/Needs support`; `adherence = 0.5*checklist + 0.5*kinematic` `src/types/database.ts:243`; `trend` Δ shoulder/BoS vs `previousMhr`, `vsGoalProgress`; persist `biomech_jobs{patient_id,generated_activity_id,intent,concepts,sam_result,mhr_result,adherence,spark_insights}` + `agent_runs{trace,reasoning,previous_response_id}` | `insights` per metric with `thresholdStr` + `explanation` + `formula` (e.g., `180-angle(pelvis,shoulder,elbow)`), `adherence` + `trend` + `goalProgress` — therapist can **Add to notes** → `POST /api/ai/soap-summary` |
| **4 Show** | — | `page.tsx` moving overlays: `viewBox 0 0 1 1` SAM boxes (0.75s window) + SVG masks per concept color `PALETTE[8]` + `BiomechSkeletonOverlay` + `BiomechInVideoHud` + `BiomechLiveHud` sparklines + `BiomechMaskControls` `BiomechOverlay.tsx:328` + per-concept isolate chips + `BiomechPanel 2.0` badges + adherence sparkline + trace drawer `agent_runs` + reasoning badge `Effort: medium` | Video-scrub `currentTime` to frame `findActiveFrame`; stepper `activeStep 1-4`; presets (cup/Trunk/Pincer/Neck) + drag&drop 100 MB; **Same scrub mental model as SAM Test** `page.tsx:999` — `isolatedLabel` fullscreen mask parity |

**Cost:** Planner ~$0.0006 + SAM $0.009/45f + Modal ~$0.002 naive → **`~$0.011/clip`**; agentic 2nd Spark synth adds ~$0.001 and +1.5-2s (trade: better `therapistNeed` disambiguation + fewer false `Needs support`).

**Orchestrated vs agentic:** Standard U1-U11 keep orchestrated single-turn (faster/cheaper); agentic `tool_choice:auto` + `previous_response_id` activates on ambiguous `therapistNeed` or history flag `trunk_compensation_mild x2` — `BIOMECHANIC_AGENT.md:11` #4 decision rule retained.

---

#### 5.2 Clinical Biomech Engine (production submissions)

### Input / Process / Output / Journey

| Dimension | Detail |
|---|---|
| **Input** | `submissionId` + `stepSubmissionId` (grain = step, not program) + Use Case intent dropdown `U1-U11` + `ageBand` + video `video_path` → signed Supabase `program-videos` URL (10m TTL) + `BIOMECH_KEYWORDS` 16 locked (`src/lib/meta/biomech-prompt.ts`: `person, shoulder, elbow, forearm, wrist, hand, finger, thumb, hip, knee joint, ankle joint, foot, trunk, cervical spine, thoracic spine, neck`) |
| **Process** | **Planner LLM** picks **2-8 concepts from 16 only** for intent (e.g., U1→`person,shoulder,elbow,forearm,wrist`; U11→`person,neck,cervical spine,thoracic spine,trunk`) validated by `assertSamTextConcept` (≤8 words) → **`segment_concepts`** 1 SAM 3.1 pass (`POST /v1/responses` + `input_file:{file_id}`) regardless of 2 or 8 concepts (`$0.009/45 frames`) → SSE `@meta-sam/parser` → `boxes`+RLE `masks`+`mediaSize` → **`estimate_biomech`** `POST /api/mhr/infer` → Modal pulls frames via signed URL, crops by `person` box, `estimator.process_one_image(crop*mask)` @3 FPS (45 frames/15s), One-Euro filter, MHR→SMPL LBS → `angles/rom/neckAngles/flags/confidence` → `draft_soap` (optional) |
| **Output** | `mhr_results` JSONB in `ai_analyses` + `biomech_jobs` row: `{ submissionId, modelId:"sam-3d-body-vith+MHR", processingMs, frames:[{frameIndex, pred_keypoints_3d/2d, pred_vertices 18k, angles{shoulderFlex_L, elbowFlex_R, trunkLean, neckAngles{flexExt,lateralFlex,rotation,chinTuck}}, rom{max/min, deficit}, confidence{pose,angleErrorDeg}, flags[trunk_compensation_mild, neck_forward_head]}], summary{peakAngles, rom_range, gait{symmetry,tugSec}, risk, confidenceOverall} }` + `SamOverlay` SVG skeleton + Recharts angle vs time (only picked joints) + ROM cards + compensation chips + neck chin-tuck gauge (cross-age) |
| **Journey** | 1) Open `therapist/submissions/[id]` → per-step card (video + assigned worksheet + client comment) 2) Pick **Use Case dropdown U1-U11** (hint defaults from step title) 3) Click **`Analyze biomechanics (Agent)`** (Beside `Analyze with Meta`, disabled if no video) → `POST /api/agent/biomech/run {submissionId,stepSubmissionId,intent,ageBand}` → live trace poll `GET /api/agent/biomech/status` 2s: `Planner picked 5 concepts → SAM 12/45 → MHR Frame 12/45` → overlay on video + `BiomechPanel` docked under video → `Insert into Objective` per card → free-type feedback + `confirmedObs` checkboxes → Mark Reviewed → `Publish` (all steps → client). Changing dropdown re-filters same JSON — **no re-bill**. **1 Modal inference serves all workflows** (U1+U5+U11 = 1 call, 3 views) |

### The 16 Keywords (sole source — playground + clinical)

```
person · shoulder · elbow · forearm · wrist · hand · finger · thumb
hip · knee joint · ankle joint · foot · trunk · cervical spine · thoracic spine · neck
```
`Neck` is **cross-age** (pedia tummy-time → geriatric TUG head turn) — always available, returns `neckAngles` + `forward_head>25°` flag. **Guard:** `isBiomechKeyword` + `assertSamTextConcept` `src/lib/meta/biomech-prompt.ts:26` — Spark hallucination outside 16 is rejected; `normalizeConcepts` dedup `sam-engine.ts:107`.

### Evidence-gating

Every `insights[].value` is validated against `mhr` JSON path (`summary.peakAngles.*`, `frames[].angles.*`) before render; missing path → `Watch`/`—` not hallucinated. `mhr` signed URL handoff only `MODAL_MHR_URL/infer` `modal/app.py:391` (`x-modal-secret`).

### Storage

Playground `/tools/biomech` is **stateless** (no DB; `Save as previous` keeps `previousMhr` in memory for trend). Clinical persists `biomech_jobs` + `agent_runs` per `(patient_id, generated_activity_id)` + `step_submission_id` grain; `previous_response_id` stored in `meta.previous_response_id` for next `therapistNeed` turn.

### Use Cases U1-U11 (dropdown → planner hint)

| # | Use case | Agent picks | Metric | Output |
|---|---|---|---|---|
| U1 | UE ROM | person,shoulder,elbow,forearm,wrist | Shoulder/elbow flex, pron/sup curves | Objective "Shoulder 142→158° deficit 22°" + chart |
| U2 | Hand/fine-motor | person,hand,finger,thumb | Pinch aperture 5.5 mm | Timeline + plan cue |
| U3 | Gait symmetry | person,hip,knee,ankle,foot | Knee flex, dorsiflex, symmetry | Gait report |
| U4 | TUG / fall-risk | person,trunk,hip,knee,neck | Sit→stand, TUG sec, Berg proxy | Assessment "TUG 11.2s" |
| U5 | Trunk compensation | person,trunk,cervical,thoracic | Trunk lean, shoulder hike | Chip "Mild — cue upright" |
| U6 | Sit-to-stand | person,hip,knee,trunk | Hip/knee synchrony, rise time | Score 0-4 |
| U7 | Bimanual | person,hand,shoulder | Inter-hand dist | Coordination % |
| U8 | Adherence scorer | person,shoulder,elbow,wrist | Completion vs ROM/reps | Badge green/yellow/red |
| U9 | Longitudinal | aggregated | Trends over submitted_at | Chart + PDF |
| U10 | Auto SOAP | all picked | Sentences from mhr_results | Fill Objective |
| U11 | Neck control ★ | person,neck,cervical,thoracic,trunk | Neck flex/lateral/rotation, chin-tuck | Neck card (all ages) |

---

## 6. Agent 3 — Goal Tracking Agent (STG/LTG vs SOAP + Performance)

> **Source:** `plan/GOAL_TRACKING_AGENT_PLAN.md` · Placed in `therapist/clients/[id]` (above tabs, below Therapy Goals card) · `POST /api/agent/goal-tracking/run` + `GoalTrackingPanel.tsx`

### What it does

Checks whether **STG/LTG goals are being hit** by cross-referencing goals + SOAP S/O/A/P + biomech ROM/flags + Home Program completions — then drafts per-goal verdicts + actionable suggestions. Zero GPU/SAM — LLM-only consumer of prior agents.

> **Invariant:** 7 signals per goal — quanti+quali prevents numeric-only discharge; every verdict cites `evidenceIds` (`mhr:`, `submission:`, `goal:`, `soap:`).

#### 6.1 Agentic Journey (4-step loop)

| Step | Spark does | System does | Output |
|---|---|---|---|
| **1 Gather** | — | `fetch_goals({patientId})` → `goals[]` (`patients.long_term_goals max5 + short_term_goals max10` → future `goals` table `{id,text,domain:UE/gait/neck/ADL/hand,target:"shoulder 160° 6w",baseline,deadline,status}`) + last 5 `soap_notes` S/O/A/P + `assessment_links` | `{goals, soap[]}` |
| **2 Fetch evidence** | Spark `muse-spark-1.3` `reasoning:{effort:"high", summary:"concise"}` `prompt_cache_key:"aruga-goal-tracking"` `text.format=json_schema` | `fetch_evidence({patientId, goalIds})` parallel `parallel_tool_calls:true` → last 30d `ai_analyses.mhr_results` (reused, no Modal) + 14d `submissions`/`step_submissions` completions + therapist per-step feedback; preflight `input_tokens` 1M | `{biomech[], activity{rate,streak}, soapLines}` |
| **3 Evaluate** | Planner evaluates **7 signals per goal** `draft_goal_review` → `{verdicts[], summary, suggestions[]}` with `reason` citing evidenceIds; `confidence 0-1` from `signals` agreement + `confidenceOverall` | Zod verdict enum `on_track|at_risk|behind|achieved|gap` validated; `warnings["LTG chin-tuck has no recent neck MHR — run U11"]` | `verdicts[{goalId, verdict, confidence, signals{rom_vs_target,time_to_deadline,adherence}, reason, evidenceIds}]` |
| **4 Present** | — | Persist `goal_reviews{patient_id, verdicts, summary, suggestions,trace,status:draft}`; render `GoalTrackingPanel` verdict chips + progress bar vs deadline + dual-axis Recharts ROM+adherence% + warnings; poll `GET /api/agent/goal-tracking/status` 2s | `Insert into Plan` per suggestion → `soap_notes.plan` `page.tsx:609` / `Publish` opt-in; auto on new submission/MHR + weekly cron reuses same draft until new evidence |

**Cost:** LLM `<$0.002/run` (4 goals ×7 signals) → $1 ≈500 checks; **$0 SAM/Modal** — reuses `mhr_results`.

### Input / Process / Output / Journey

| Dimension | Detail |
|---|---|
| **Input** | `patientId` + `trigger: manual|on_submission|weekly` + `goals[]` + last 5 `soap_notes` + last 30d `ai_analyses.mhr_results` + 14d completions + feedback |
| **Process** | **LLM-only, zero GPU** — 3 tools `fetch_goals + fetch_evidence (parallel) → draft_goal_review` `muse-spark-1.3 reasoning:high` + `previous_response_id` if re-run with feedback |
| **Output** | `goal_reviews` draft: `verdicts` + `summary{onTrack,atRisk,behind,achieved,gap,narrative:"1/4 on track; shoulder at risk"}` + `suggestions[{action:continue|escalate|maintain|discharge}]` + `modelId`+`trace` |
| **Journey** | Open `therapist/clients/[id]` → chips + chart → **`Check goals`** → trace `Fetched 4 goals → 3 biomech clips → 2 SOAP → verdict` → Insert/Publish |

### 7 Goal Signals

| # | Signal | From | Check | Example |
|---|---|---|---|---|
| 1 | **ROM vs target** | `mhr_results.rom` | STG 160° vs current 158° → 89% | `on_track`/`behind` |
| 2 | **Neck/compensation** | `flags` + `neckAngles` | `forward_head>25°` persists 3/3 | `at_risk` |
| 3 | **Adherence** | `step_submissions` | 9/14=64% <80% | `behind` |
| 4 | **Trend** | longitudinal | 92%→64% drop 4w | `at_risk` |
| 5 | **SOAP alignment** | `soap_notes.objective` | objective never mentions knee | `gap` |
| 6 | **Client qualitative** | client note | "fatigue ↑ evenings" + dip | `flag` |
| 7 | **Time to deadline** | `deadline` | 6/8w elapsed, 4°/wk → miss | `at_risk` |

Quanti (1-2) + activity (3-4) + quali (5-7) together ground judgment.

### Evidence-gating & Storage

Every `reason` must cite `evidenceIds` (`mhr:abc`, `submission:def`, `soap:123`); missing evidence → `gap` not hallucinated; `confidence<0.6` → `low_confidence` badge + "Need 1 more clip". Persist `goal_reviews` + `agent_runs` trace; grain = `patientId`; `previous_response_id` kept for re-check.

### Use Cases G1-G7

| # | Goal domain | Biomech reused | Signal | Output |
|---|---|---|---|---|
| G1 | STG UE ROM | U1 UE ROM | 1+2+7 | `at_risk` deficit 2°/wk |
| G2 | STG hand/pincer | U2 Hand | 1+3 | `behind` escalate 2×/day |
| G3 | LTG gait/TUG | U3/U4 | 1+4 | `at_risk` fall risk |
| G4 | Neck/chin-tuck | U11 Neck | 1+2 | `at_risk` + cue |
| G5 | Compensation | U5 Trunk | 2+5 | `gap` warning |
| G6 | ADL adherence | U8 | 3+4 | `behind` reschedule |
| G7 | SOAP coherence | — | 5 | `gap` badge |

---

## 7. Agent 4 — Highlights Agent (Monthly 7 Adaptive Highlights)

> **Source:** `plan/HIGHLIGHTS_AGENT_PLAN.md` · Button in `client/dashboard` (strip) + `therapist/clients/[id]` (panel) · `POST /api/agent/highlights/run` · `HighlightsPanel.tsx` + `HighlightsStrip.tsx`

### What it does

Once a month (or on demand) the agent **thinks and picks the best 7 data points** for this patient for this period — not a fixed report — by weighing everything that moved (SOAP + feedback + goals + adherence + performance).

> **Invariant:** Adaptive curation — `weight = |Δ|×consistency×confidence`; fixed slot titles for comparability, adaptive data inside; never invent numbers, cite `evidenceIds`.

#### 7.1 Agentic Journey (4-step loop)

| Step | Spark does | System does | Output |
|---|---|---|---|
| **1 Gather** | — | `fetch_month({patientId, window:30d})` → last 6 `soap_notes` S/O/A/P, `homeProgramFeedback{therapist notes+client comments+confirmedObs}`, `goal_reviews.latest`, `adherence{rate,streak,trend}`, `activity{completions + mhr}`, `prior` last highlights for arrow | `{pool}` |
| **2 Score** | — (deterministic) | Compute deltas MoM (ROM max, adherence %, goal ratio) + quali anchors keyword match objective/notes/feedback; score every candidate `weight=|Δ|×consistency×confidence` (`|Δ|` abs Δ, consistency 3/3=1.0 1/3=0.3, confidence `mhr/goal confidence`) | `{candidates[], deltas}` |
| **3 Curate** | Planner `muse-spark-1.3` `reasoning:{effort:"high"}` `prompt_cache_key:"aruga-highlights"` `json_schema 7-locked` system: *"Consider recent SOAP, Home Program feedback, goals, adherence, performance. Think and pick best 7 per slot §2.1 each title story ≤25w delta arrow weight evidenceIds. Do not invent numbers. Weight by |Δ|×consistency×confidence."* | Validate `highlights[7]` shape; weight<0.15 → `→ stable`; pure quali → `→` | `{highlights[7], summary, priorCompare}` |
| **4 Present** | — | Persist `highlights{patient_id,month,highlights,summary,trace,status:draft}`; render **7 cards grid** icon+title+arrow+story+delta pill + `mixed` badge + sparkline MoM; poll `GET /api/agent/highlights/status` 2s | `Insert month summary into SOAP` + `Publish` → client read-only 7-dot strip `HighlightsStrip` disclaimer *"AI adaptive highlights — therapist reviewed. Best 7 from this period."* Same JSON dashboard/PDF/push |

**Cost:** LLM `<$0.003/run` → $1≈300 months; **$0 SAM/Modal** — reuses all prior agents; same 7 reused until new month/evidence.

### Input / Process / Output / Journey

| Dimension | Detail |
|---|---|
| **Input** | `patientId` + `month:"YYYY-MM"` (default last 30d) + full pool SOAP/feedback/goals/adherence/activity/prior |
| **Process** | Adaptive `fetch_month → deltas → weight → planner picks 7` `reasoning:high` |
| **Output** | Exactly 7 highlights fixed slots (Goal Progress, Top ROM gain, Compensation shift, Adherence, Neck, Program fit, Next focus) each `{slot,title,story≤25w,delta{quanti,quali},arrow,weight,evidenceIds}` + summary+priorCompare |
| **Journey** | Month auto 1st OR `Generate highlights` → `Computed 4 deltas → weighted 7 → 1 re-roll` → 7 cards + sparkline → Publish |

### Evidence-gating & Storage

Every story must cite `quali` keyword from SOAP/client note + `evidenceIds` (`mhr:`, `goal:`, `soap:`); missing signal → placeholder "Insufficient data — run 1 clip" not fake; weight<0.15 suppresses `↑`. Persist `highlights(patient_id,month)` unique + `agent_runs`; grain = `patientId+month`; reuse until next month.

### 7 Slots (target categories) + Use Cases H1-H7



### 7 Slots (target categories)

| # | Slot | Data point considered (adaptive) | Quali anchor cited | When suppressed |
|---|---|---|---|---|
| 1 | Goal Progress | Goals `achieved+on_track/total` MoM + `goal_reviews` deltas | SOAP plan/assessment mention | If 0 goals → next best point |
| 2 | Top ROM gain | Largest ROM Δ° (U1/U2/U11) confidence>0.6 | "effort less" note | If <2 clips |
| 3 | Compensation shift | Flag `on→off` or `off→on` (U5) | Therapist flag note | If no flags |
| 4 | Adherence | Completion % 30d vs prior 30d + streak/trend | "fatigue/busy" comment | Always shown |
| 5 | Neck / cross-age | `neckAngles` Δ + `forward_head` | Tummy-time/dysphagia note | If no U11 runs |
| 6 | Program fit | Activity category completion vs others | Favorite program name | Always shown |
| 7 | Next focus | Goal risk × time to deadline | Therapist suggestions[] from Goal agent | Always shown |

### Use Cases H1-H7

| # | Monthly view | Slot | Metric | Output |
|---|---|---|---|---|
| H1 | Goal momentum | Goal Progress | G1-G7 MoM | "+1 goal on track" |
| H2 | ROM headline | Top ROM gain | U1/U2 ROM | "Shoulder +14°" |
| H3 | Compensation story | Compensation | U5 flags | "Forward-head resolved 2/3" |
| H4 | Adherence alert | Adherence | U8 | "↓28% — fatigue" |
| H5 | Neck monthly | Neck | U11 | "Chin tuck 2→3/5" |
| H6 | Program ROI | Program fit | category % | "Kitchen ADL drove gain" |
| H7 | Next focus | Next focus | Goal risk×deadline | "Escalate shoulder 2w" |

---

## 8. Agent 5 — Aruga Guide (Always-On Client Companion)

> **Source:** `src/app/aruga-guide/page.tsx` · `src/lib/meta/spark.ts:runSparkOtChatAgentic` · `src/lib/meta-ai.ts:otChatAssistant` · `src/app/api/ot-chat/route.ts` · `docs/AGENTS_GUIDE.md:§2.1a` 6/7 compliant

### What it does

Always-on rehab companion — explains home program in everyday words, answers questions with **web_search-grounded citations**, handles images/video frames conversationally, escalates to therapist via *Send to clinician* gate. The only agent that talks directly to client without a draft.

> **Invariant:** Conversational, not draft — but **never silently writes to chart**; `Send to clinician :690` is the human gate; 6/7 Meta compliant `spark.ts:runSparkOtChatAgentic`.

#### 8.1 Agentic Journey (4-step loop)

| Step | Spark does | System does | Output |
|---|---|---|---|
| **1 Understand** | — | Collect `history` last 10 turns + `images≤4` + `videoUrls≤2` → frames; `clientContext` first input item (2200ch cacheable); trim 3000ch/turn; `conversationId` grain | `{input:[developer+context+history+user+images]}` |
| **2 Ground** | Spark `muse-spark-1.3` `reasoning:medium summary:auto` `tools:[{type:"web_search"}] tool_choice:auto parallel_tool_calls:true` → server-side `web_search` → annotations | Build Responses `input[]` typed `input_text`/`input_image` + `instructions:buildOtChatSystemPrompt()` + `store:false` `include: reasoning.encrypted_content` (skip on contributor) + `max_output_tokens:4000` `timeout 55000 maxRetries1`; fallback without tools if host rejects | `{web_refs[], annotations}` |
| **3 Synthesize** | Generate everyday-words answer + inline citations `ClinicalReference[]` `grounding.ts:217` → `page.tsx:902` References(n) | `refs` dedup `spark.ts:agenticRefs` → `meta-ai.ts:references.map(web→ClinicalReference)`; `references` strict shape validated | `{text, references[{title,url,source}]}` |
| **4 Verify** | — | Render markdown + References collapsible + `Send to clinician` button `page.tsx:690`; therapist verifies before chart; `prompt_cache_key:"aruga-guide-${conversationId}"` planned (now partial) | `Send to clinician` → `POST /api/ot-chat` → therapist inbox; `maxDuration:60` |

**Cost:** ~$0.003–0.006/msg (`medium`+web_search) → ~300 msgs/$1 vs Activity $0.012–0.015; `cached_tokens` $0.15/1M planned next.

### Input / Process / Output / Journey

| Dimension | Detail |
|---|---|
| **Input** | `history[≤10]` + `userText` + `images ≤4 dataUrl` + `videoUrls ≤2` + `conversationId` + `clientContext` (patient ageBand, program) + `model` |
| **Process** | Responses `runSparkOtChatAgentic` → `web_search` grounded + `reasoning:medium` → fallback Chat Completions if unsupported; `grounding.ts` PubMed/OpenAlex retained fallback |
| **Output** | `{text markdown, references[ClinicalReference], modelId, latencyMs}` — everyday words + citations; disclaimer therapist-verified |
| **Journey** | Open `/aruga-guide` (client+therapist) → type question + attach image/video → `Send message` → 1-2s answer + References(n) → `Send to clinician` gate → therapist validates → chart; error 504/rate `catch → fallback runSparkOtChat` |

### Evidence-gating & Storage

Inline web annotations → `ClinicalReference[]` validated before render; no diagnosis/prescribe; `store:false` no server persistence after disconnect; `chat-attachments` bucket `public=false` + signed URL 60m + EXIF strip; `therapist_owns_patient` on `clientContext`.

### 7 Signals → Use Cases

| # | Question type | Grounding | Example output | Gate |
|---|---|---|---|---|
| A5-1 | Home program explain | web_search + program | "Do pincer 1×/day — large targets help" | Send to clinician |
| A5-2 | Safety check | web articles | "Stop if pain >5/10 — ask therapist" | Escalate |
| A5-3 | Progress why | prior agents | "ROM up but adherence dip explains risk" | — |
| A5-4 | Image/video Q | `input_image` frames | "Thumb posture looks … show side view?" | Media gate |

---

## 9. Activation — 1 Button Per Agent

> Nothing runs autonomously until you click (except 2 optional autos that still need approval before anything is published).

| Agent | Where you click | Debounce / Auto | What happens in 1–12s | What you approve |
|---|---|---|---|---|
| **Activity** | `therapist/clients/[id]/programs/new` → per step `Draft with Agent` (or auto-debounce ~900ms when you type title+instructions) | Auto on edit (≥10ch instructions) + manual | Spark 6000 tok + optional Muse Image → pending card with reasoning chips + image thumb | `Approve & Attach` / `Edit` (System/My/Custom modal) / `Regenerate` / `Reject` |
| **Biomech** | **Playground** `Tools → Biomechanic Agent` `/tools/biomech` (prescribe activity → `Analyze Movement` 4-step trace + overlay) · **Clinical** `therapist/submissions/[id]` per-step card → **Use Case dropdown U1-U11** → **`Analyze biomechanics (Agent)`** | Playground: always manual; Clinical: none (video required) | Playground: Spark plans → 1 SAM pass + 1 Modal → `deriveExpectation/thresholdBand` + Spark `draft_clinical_insights` → overlay + ROM + adherence + trend + trace drawer · Clinical: Planner picks 2-8/16 → 1 SAM + 1 Modal → overlay + ROM + draft SOAP (same contract `samPerson` → `MODAL_MHR_URL/infer`) | `Insert into Objective/Plan` / confirm `confirmedObs` / `Publish` review; Playground `Save as previous` for MoM comparison |
| **Goal** | `therapist/clients/[id]` header → **`Check goals`** | + auto on new submission/MHR + weekly cron (all reuse same draft until new evidence) | LLM-only 7-signal check → verdict chips + chart + suggestions | `Insert into Plan` per suggestion / `Publish` to client |
| **Highlights** | `therapist/clients/[id]` or `client/dashboard` → **`Generate highlights`** (or monthly auto 1st) | Manual + monthly cron; button enabled only when ≥1 `goal_reviews` or 7d activity | Weights `|Δ|×consistency×confidence` → 7 highlights | `Publish` 7 to client strip; client sees read-only |
| **Aruga Guide** | `Aruga Guide` `/aruga-guide` (client+therapist) → `Send message` + 📎 image/video | Always-on conversational; `history ≤10` + `images ≤4` + `video ≤2` | Spark `reasoning:medium` + `web_search` → answer + `References(n)` | `Send to clinician` gate → therapist validates before chart |

Demo: `activity-agent-playground` (`/activity-agent-playground` + alias `/activiy-agent-playground`) — 4 mock patients, auto-debounce draft, trace, approval cards — works exactly like real flow.  
Biomech demo: **`/tools/biomech` (Biomechanic Agent playground)** — presets + drag-drop video + 4-step trace + SAM-Test-parity overlay; **no mock fallback** on Modal — surfaces `MODAL_NOT_CONFIGURED`/`SAM_NO_DETECTIONS` with `plan` intact.

---

## 10. Shared Agentic Infrastructure (Meta Vision)

All five agents follow Meta's agentic blueprint ([dev.meta.ai/docs/overview](https://dev.meta.ai/docs/overview)): **Planner LLM + Tools + Responses API loop + Human approval**.

| Pattern | How Aruga implements | Why |
|---|---|---|
| **Responses API** `openai.responses.create` + `previous_response_id` | Preserves `reasoning_content` private across tool turns; Chat Completions cannot replay reasoning externally (`:2782` spec) | Required for agentic loops with reasoning models |
| **Reasoning** `reasoning:{effort:"medium"/"high"/"max", summary:"auto"}` | Activity/Biomech `medium` (Biomechanic planner + synthesis `biomech-agent.ts:reasoning:medium summary:auto`); Goal/Highlights `high`; Wonder `max` (not on contributor) — reasoning tokens share `max_output_tokens` & bill as output; `logprobs` disallowed (400) · `include:["reasoning.encrypted_content"]` skipped on `contributor` | Transparent depth dial; more reasoning = more output budget |
| **Structured output** `text.format={type:"json_schema", strict:true, schema}` | All agent JSON validated Zod-side; depth ≤10, 5k props, 120k chars, recursive `$ref` rejected; `strict:false` fallback → retry if needed | Guarantees valid JSON; no loose `json_object` drift |
| **Parallel tool calls** `parallel_tool_calls:true` `tool_choice:"auto"` only | Activity: `fetch_patient+list_templates` parallel; Biomechanic: 4 tools `get_prescribed_activity_context/select_biomech_concepts/evaluate_history_trend/draft_clinical_insights` with `tool_choice:auto`; Goal: `fetch_goals+fetch_evidence` parallel; `call_id` 1-64 chars, one `function_call_output` per `call_id` | One turn instead of N sequential |
| **Tool search** `{type:"tool_search"}` namespaces | Reserved for when U1-U11 + goals + highlights tools exceed 20 — Responses+Messages only, not combinable with `json_schema` same turn (sequence turns) | Keeps tool count <10 per turn |
| **Prompt caching** `prompt_cache_key:"aruga-*" ` `prompt_cache_retention:"24h"` | Stable prefix first (system prompt, BIOMECH_KEYWORDS 16, age-band guidance) → variable last (video/intent, step text) → `cached_tokens` subset billed reduced (`$0.15/1M` vs $1.25) | Bursty clinic traffic; check `usage.*.cached_tokens` |
| **Token counting** `POST /v1/responses/input_tokens` preflight | Checks 1M context before long agentic loops | Avoids mid-loop truncation |
| **Token budget & repair** `BUDGET ≤1800ch` + slice `420/320ch` + `max_tokens 6000→7000 concise` + `tryRepairTruncatedJson` + `patchPartial` | `src/lib/meta/prompts.ts:155` BUDGET (instructions≤350ch, visualBrief 70-90w, refinedImagePrompt≤600ch, zones≤4) + `src/app/api/activities/generate/route.ts:34` slice 800/600ch + `activity-generator.ts:68` length-retry with concise suffix | Production `Invalid JSON from Spark activity` (breathing/meds scheduler) was `finish_reason=length` mid-JSON — fixed, verified `npm run build 0` |
| **Model choice** `muse-spark-1.3` standard vs `contributor` cheap vs `muse-wonder-1.0` max | Standard for clinical (no training use); contributor for prototyping; Wonder for max reasoning triage (not contributor-mode) | Pricing vs privacy vs depth |
| **Ownership guard** `therapist_owns_patient` + `x-requester-id` | Every `POST /api/agent/*/run` validates `patients.therapist_id` or `client_user_id` via `createAdminClient` (bypasses RLS, guard is app-layer) `src/lib/supabase/owner.ts` | PHI never leaks client-side beyond agent preview |
| **Draft reuse** | Biomech `mhr_results` reused by Goal + Highlights (1 Modal inference → 3 views); Highlights same 7 JSON serves dashboard/PDF/push; Goal same `goal_reviews` until new evidence | Avoids $0 double-billing; see `docs/COST_GUIDE.md` |
| **No local fallback** | On `No content from Spark activity spec` — surface error, no synthetic worksheet; image failures show placeholder SVG | Prevents clinically unsafe fake worksheets |

---

## 11. File Map — Where Each Agent Lives

```
plan/
  ACTIVITY_AGENT_PLAN.md        # Auto-generate pending approval (per-step)
  BIOMECH_ENGINE_PLAN.md         # SAM 3.1 → Modal MHR 16 keywords, U1-U11
  BIOMECHANIC_AGENT.md           # Unified 4-step agentic loop (Determine→Segment→Forward→Compare→Show) — source of truth for playground+clinical
  GOAL_TRACKING_AGENT_PLAN.md    # 7 signals, STG/LTG vs SOAP/biomech/adherence
  HIGHLIGHTS_AGENT_PLAN.md       # 7 adaptive highlights, |Δ|×consistency×confidence

src/lib/meta/
  client.ts                      # Meta Model API host validation + OpenAI SDK client
  models.ts                      # Muse Spark / Muse Image / SAM 3.1 model IDs
  prompts.ts:155                 # buildActivitySparkPrompt slicing 420/320ch + BUDGET
  schemas.ts:70                  # ActivitySpecSchema Zod
  activity-generator.ts:68       # runSparkActivitySpec (6000→7000 retry, repair) + runMuseImage
  agent.ts                       # Activity Agent planner (fetch_patient+list_templates+generate_activity)
  biomech-prompt.ts              # BIOMECH_KEYWORDS 16 locked (sole source) + U1-U11 presets + assertSamTextConcept/isBiomechKeyword
  biomech-planner.ts:5           # Spark planner + heuristic HEURISTIC_MAP + deriveExpectation/thresholdBand Good/Watch/Needs support (playground + clinical shared)
  biomech-agent.ts               # Agentic orchestrator: Responses reasoning:medium + 4 tools + previous_response_id + draft_clinical_insights synthesis + evidence-gating + agent_runs trace
  goal-agent.ts                  # (Phase 0: mock) fetch_goals+fetch_evidence→draft_goal_review rule-based 7 signals
  highlights-agent.ts            # (Phase 0: mock) fetch_month adaptive weight 7
  sam.ts / sam-engine.ts         # SAM 3.1 streaming + @meta-sam/parser (sam-engine.ts:304 segmentConcepts concurrency 2, cache 5m, IoU 0.9)
  spark.ts                       # Muse Spark chat/Responses helpers (runSparkOtChatAgentic pattern reused for biomech agentic)
  grounding.ts                   # PubMed/OpenAlex evidence (fallback) + web_search primary for Guide
  meta-ai.ts:otChatAssistant     # Aruga Guide orchestrator: web_search fallback + ClinicalReference[] mapping

src/app/aruga-guide/
  page.tsx:690                   # Guide UI: chat + image/video attach + markdown + References(n) + Send to clinician gate
  page.tsx:902                   # References collapsible (web_search annotations → ClinicalReference)
src/app/api/ot-chat/route.ts     # POST /api/ot-chat → runSparkOtChatAgentic (store:false, reasoning:medium, web_search) maxDuration 60

src/lib/supabase/
  admin.ts                       # createAdminClient (service_role, bypasses RLS)
  server.ts / client.ts          # Auth helpers
  owner.ts                       # therapist_owns_patient guard + getRequesterId

src/components/activities/
  StepActivityControl.tsx:19     # Per-step entry: Draft with Agent (auto-debounce) + Browse templates → pending card
  GenerateActivityAgentModal.tsx  # Unified agent UI: System / My Prompts / Custom + 420/320ch counters + image checklist

src/components/therapist/
  GoalTrackingPanel.tsx           # Verdict chips + progress vs deadline + Recharts ROMap + suggestions + Insert into Plan
  HighlightsPanel.tsx             # 7 cards grid + sparkline + publish + View evidence
  BiomechPanel.tsx                # Recharts angle vs time + ROM cards + compensation chips + neck gauge + confidence badge

src/components/client/
  HighlightsStrip.tsx             # Read-only 7-dot strip (1-line each) on client/dashboard when is_published

src/components/ui/
  sam-overlay.tsx:31              # SamOverlay + mhrJoints2d skeleton + confidence color

src/app/api/agent/
  activity/run/route.ts          # Orchestrator: Responses planner + Spark+Image + persist generated_activities + agent_runs
  activity/approve/route.ts      # Link program_steps.generated_activity_id
  biomech/run/route.ts           # Clinical: Planner picks 2-8/16 → segment_concepts → estimate_biomech (Modal) → agentic synthesis (optional)
  biomech/status/route.ts        # Poll 2s: trace "Planner picked 5 → SAM 12/45 → MHR 12/45"
  goal-tracking/run|status|publish/route.ts  # LLM-only 7 signals, goal_reviews status draft→published
  highlights/run|status|publish/route.ts     # fetch_month adaptive 7, highlights status draft→published
  mhr/infer/route.ts             # Proxy to Modal (Next → Modal §3.1)
  mhr/webhook/route.ts           # Modal → Next: upsert ai_analyses.mhr_results + biomech_jobs completed + agent_runs trace

src/app/api/tools/biomech/run/route.ts      # Playground agentic loop: planBiomechConcepts → sam3Engine.segmentConcepts → POST {MODAL_MHR_URL}/infer {samPerson} → deriveExpectation/thresholdBand + spark synthesis → {plan,concepts,sam,mhr,insights,adherence,trend,meta}
src/components/layout/
  therapist-nav.tsx:78           # Tools → Biomechanic Agent {href:"/tools/biomech", label:"Biomechanic Agent", icon: Activity}
  client-nav.tsx:85              # Same — visible to both roles
src/components/therapist/
  BiomechOverlay.tsx:328          # Skeleton + HUD + live sparklines (reused by playground + clinical)
  BiomechPanel.tsx:2.0            # Ratings + adherence bar + trend sparkline + Insert into Objective/Plan
src/app/tools/biomech/page.tsx   # Playground UI: presets, video drag-drop, 4-step trace stepper, overlay toggles (Boxes/Skeleton/HUD/Style), isolate chips, Save as previous, reasoning badge, adherence trend

src/app/
  therapist/clients/[id]/page.tsx        # Client detail: Therapy Goals card + GoalTrackingPanel + HighlightsPanel + SOAP + programs
  therapist/clients/[id]/programs/new/page.tsx  # StepActivityControl per step (agent)
  therapist/submissions/[id]/page.tsx    # Per-step video + Use Case dropdown U1-U11 + Analyze biomechanics (Agent) + BiomechPanel (production, uses same contract as playground)
  tools/biomech/page.tsx                 # **Playground** `/tools/biomech` (isolated, no DB, reuses sam-engine + Modal + BiomechOverlay parity)
  client/dashboard/page.tsx               # HighlightsStrip (published 7) + streak + program card
  activity-agent-playground/page.tsx      # Demo isolated 4 mock patients + trace
  sam-test/page.tsx:999                  # Reference overlay: moving boxes viewBox 0 0 1 1 + mask SVG + skeleton — parity target for biomech playground
  activities/                     # Studio browsing same agent modal

modal/
  app.py                         # Modal App("aruga-mhr") Volume("sam3db-ckpts") L4 gpu="L4" timeout=120 keep_warm=1
                                 # @app.web_endpoint POST /infer {submissionId,stepSubmissionId,videoUrl,samPerson,options} → mock or real estimator
                                 # Phase 0: deterministic mock MHR (ROM/flags/neckAngles) for UI without GPU
                                 # Phase 1: estimator.process_one_image(crop*mask) + One-Euro box filter + SMPL LBS

supabase/
  all_in_one_setup.sql           # Canonical deploy: tables + RLS + 3 private buckets + 20-template seeds (efficient 420/320ch)
  migrations/                    # Incremental mirrors 01→14
  migrations/20261031000014_efficient_activity_templates.sql  # Shortened spark/image prompts
```

---

## 12. Safety, Human-in-the-Loop & HIPAA

| Control | How it is enforced in agents |
|---|---|
| **Human-in-the-loop** | All agents return `status:"draft"` / `pending_approval` — therapist must `Approve` (Activity) / `Insert` + `Publish` (Goal/Highlights) / `confirmedObs` checkboxes + `Publish` (Biomech review) before patient sees anything. No silent writes. |
| **Clinical governance** | Worksheet: `warnings[]` array flags ambiguities; Biomech: `confidenceOverall` + `angleErrorDeg` + disclaimer *"AI draft — therapist confirms"* + MPJPE 54-61 mm limits; Goal: `gap`/`low_confidence` when <2 clips; Highlights: disclaimer *"AI adaptive highlights — therapist reviewed. Best 7 from this period."* |
| **Therapist-only writes** | Every `POST /api/agent/*/run` + `publish` checks `therapist_owns_patient` (`patients.therapist_id` or `client_user_id` match) via `x-requester-id` / `auth.getUser()` fallback; demo compat preserved. Client can only read published highlights / published reviews. |
| **PHI boundaries** | Only 10m TTL signed URLs go to Meta (SAM) and Modal (MHR) — never raw DB dumps; Modal has no persistence (`x-modal-secret` webhook); `program-videos` / `chat-attachments` / `activity-assets` `public=false` + `TO authenticated` (`20261031000013` final truth, verified `scripts/verify-rls.sql`). |
| **Audit** | `agent_runs` `{patient_id, step_position, draft_id, reasoning, trace:[{thought,tool,observation}], status, created_at}` + `biomech_jobs` + `audit_events` immutable trigger (`prevent_audit_tampering`). Dual MD+HTML audits timestamped `MMDDYYHHMM` (`audit/` latest + `audit/old/` archive). |
| **No diagnosis** | Spark system prompts forbid `diagnose / prescribe / score`; agents cite evidenceIds (`mhr:`, `submission:`, `goal:`, `soap:`) and never invent numbers — if signal missing, placeholder not hallucination. |

---

## 13. Cost Per Agent

> **Source:** `docs/COST_GUIDE.md` verified 2026-11-02 + `docs/BASETEN_CREDITS.md`

| Agent | Model(s) | Cost per run | $1 buys | Optimization |
|---|---|---|---|---|
| **Activity** (Spark + Image) | `muse-spark-1.3-contributor` 6000 tok + `muse-image-1.0` | Spark ~$0.002–0.004 + Image $0.01 = **~$0.012–0.015** | ~70–80 worksheets | BUDGET ≤1800ch + slice 420/320ch + `max_tokens` tuned; `generateImage=false` text-only saves $0.01 |
| **Biomech** (SAM + Modal) | `sam-3.1` + `Modal L4` MHR + `muse-spark-1.3` planner+synthesis | SAM $0.009/45 frames + Modal `$0.002/clip @3 FPS` naive / `$0.0006 INT8` + Spark planner ~$0.0006 + synthesis ~$0.001 = **~$0.011-0.012 per clip** (agentic +1.5-2s) | ~115 min naive / 7 hrs INT8 | **1 SAM pass regardless of 2-8 concepts** (agentic saves 92% vs 100-keyword engines); reuse 1 Modal inference across U1/U5/U11 — no double charge; playground same cost as clinical (no DB, same `samPerson → MODAL_MHR_URL/infer` `modal/app.py:391`) |
| **Goal Tracking** | `muse-spark-1.3` `reasoning:high` LLM-only | **<$0.002** (4 goals × 7 signals) | ~500 checks | Reuses `mhr_results` + completions + SOAP — `$0` extra GPU/SAM; 3 triggers share same `goal_reviews` JSON |
| **Highlights** | `muse-spark-1.3` `reasoning:high` | **<$0.003** (7 stories + deltas) | ~300 months | Reuses all prior agents + prior month compare — same 7 JSON serves dashboard/PDF/push |
| **Aruga Guide** | `muse-spark-1.3` `reasoning:medium` + `web_search` | **~$0.003–0.006/msg** | ~300 msgs/$1 | `cached_tokens` $0.15/1M vs $1.25; `store:false` + 55s timeout |

**Per patient / month (15 min video, Standard mode, optimized SAM):** ~$0.50 direct AI → **Starter free trial**, Standard $29, Intensive $49 (`docs/COST_GUIDE.md` §8-9). Margins ~94-96%.

---

## 14. Phased Build Status

| Phase | Activity Agent | Biomech Engine | Goal Tracking | Highlights | Aruga Guide |
|---|---|---|---|---|
| **Phase 0 (this week)** | ✅ **Live**: `src/lib/meta/agent.ts` planner + `POST /api/agent/activity/run` + auto-debounce `StepActivityControl` (pending approval) + `GenerateActivityAgentModal` (System/My/Custom, image checklist) + `/activity-agent-playground` demo — `npm run build 0` | ✅ **Playground live** `src/lib/meta/biomech-planner.ts` + `biomech-agent.ts` + `src/app/tools/biomech/page.tsx` `/tools/biomech` + `POST /api/tools/biomech/run` → Spark picks 2-8/16 (no 700 bank) → SAM 3.1 `sam-engine.ts:304` → Modal `modal/app.py:391` → `deriveExpectation/thresholdBand` + `draft_clinical_insights` → `BiomechOverlay.tsx:328` parity with `/sam-test:999` · Clinical per-video button `therapist/submissions/[id]` still scaffolded | 🔨 **Scaffolded**: `therapist/clients/[id]` `GoalTrackingPanel` + `POST /api/agent/goal-tracking/run|status|publish` + `goals`/`goal_reviews` migration; Phase 0 uses mock rule-based 7 signals before LLM | 🔨 `HighlightsPanel` + `HighlightsStrip` mock 7 | ✅ **Live 6/7**: `src/app/aruga-guide/page.tsx` + `spark.ts:runSparkOtChatAgentic` `reasoning:medium` + `web_search` + `store:false` + `References(n)` + `Send to clinician:690` — `prompt_cache_key` partial |
| **Phase 1 (1 wk)** | `approve` route + trace UI + Save as My Prompt from draft + history avoidance | **Clinical promotion:** wire `POST /api/agent/biomech/run` to same `biomech-agent.ts` agentic loop (+ `biomech_jobs`/`agent_runs` persistence, last 5 trend, `mhr_results` evidence-gating) + poller `GET /api/agent/biomech/status` + demo `/demo/cup_grasp_transfer.mp4` U1+U11 → verify `previous_response_id` chaining on `therapistNeed` | `goals` table + LLM `draft_goal_review` + weekly cron + `publish` + longitudinal chart (ROM+adherence dual axis) | Cron monthly 1st + LLM adaptive `|Δ|×consistency×confidence` + `publish` + `HighlightsStrip` on `client/dashboard` | `prompt_cache_key:"aruga-guide-${conversationId}"` + `cached_tokens` count |
| **Phase 2 (1 wk)** | Prior activity history avoidance + longitudinal personalization | Switch to `embedl/sam-3d-body` INT8 TRT + hand decoder (5.5 mm) + reference-item focal + auto SOAP fill | Goal parse regex + adherence projection + feed Highlights (`verdicts` → fetch_month) | Year trend + `priorCompare` + PDF export | Multi-turn `previous_response_id` + proactive Highlights feed |
| **Phase 3** | Feedback loop on adherence → auto-suggest | PDF export + HIPAA BAA note + `sam-3d-objects` alignment | PDF export + audit | Push/email digest |

**Today's status (2026-11-02):**

- ✅ Activity Agent: builds, auto-drafts, pending approval card, ownership guard
- ✅ Biomech **playground** `src/app/tools/biomech/page.tsx` `/tools/biomech` live — no Modal redeploy needed (same `POST {MODAL_MHR_URL}/infer {samPerson}` `modal/app.py:391`); `BIOMECH_KEYWORDS` 16 guard `biomech-prompt.ts:5` enforced; 4-step loop + moving boxes+skeleton+HUD parity with `/sam-test`; `npm run build` 74 routes. Clinical `therapist/submissions/[id]` uses same `biomech-agent.ts` when wired in Phase 1 (`biomech_jobs`/`agent_runs` persistence + `checklistPct` adherence)
- 🔨 Goal Tracking: `therapist/clients/[id]` `GoalTrackingPanel` + APIs next: `src/app/api/agent/goal-tracking/*` + `goals`/`goal_reviews` migration
- 🔨 Highlights: `client/dashboard` `HighlightsStrip` + `therapist/clients/[id]` `HighlightsPanel` + APIs next: `src/app/api/agent/highlights/*` + `highlights` table; output contract clarified to *"think and pick best 7 data points"* from SOAP + Home Program feedback + goals + adherence + performance

> Edit checkbox plans in `plan/*.md`, then `approve <PLAN>` to promote Phase 0 → Phase 1.

---

*Maintainer: Aruga team · Last verified: 2026-11-02 · Stack docs: [META_INTEGRATION.md](META_INTEGRATION.md) · [DATABASE_DESIGN.md](DATABASE_DESIGN.md) · [COST_GUIDE.md](COST_GUIDE.md) · [SAM_ENGINE_KEYWORDS.md](SAM_ENGINE_KEYWORDS.md) · [BIOMECHANICAL_DATAPOINTS.md](BIOMECHANICAL_DATAPOINTS.md) · Plan: [BIOMECHANIC_AGENT.md](../plan/BIOMECHANIC_AGENT.md)*
