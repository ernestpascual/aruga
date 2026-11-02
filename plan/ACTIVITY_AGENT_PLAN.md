# ACTIVITY_AGENT_PLAN.md — Generate Activity Agent (auto-generate pending approval)
**Meta Stack:** Meta Model API `https://api.meta.ai/v1` · `muse-spark-1.3` (standard) / `muse-spark-1.3-contributor` (cheap) · Responses API `openai.responses.create` + `previous_response_id` · `reasoning:{effort:"medium", summary:"auto"}` · `text.format=json_schema` strict · `parallel_tool_calls:true` · `tool_search` namespaces · `prompt_cache_key`+`24h` · pricing [/docs/pricing-rate-limits](/docs/pricing-rate-limits)
**Status:** Draft for revision — edit checkboxes and approve
**Source:** conversation 110126 — make `Generate Activity` a true agent, token-efficient, patient-aware
**One-liner:** Therapist edits step → **Agent auto-generates** patient-tailored worksheet draft (Spark 1.3 + optional Muse Image) pending approval → Therapist approves/edits/regenerates → attaches to `program_steps.generated_activity_id`.

> This file is source of truth. No code changes until `approve ACTIVITY_AGENT_PLAN`.

---

## 0) How to revise this doc
- [ ] Confirm agent vs picker — auto-generate pending approval (this plan) vs manual-only
- [ ] Confirm patient data scope (§1, §2.1) — what agent may read
- [ ] Confirm 3-source unification (§2.2) — System / My Prompts / Custom in one agent
- [ ] Confirm approval UX (§4) — Approve / Edit / Regenerate / Reject
- [ ] Set token budget + retry (§3.2) — keep efficient prompts
- [ ] Approve data migration (§7)

---

## 1) Why an agent (and patient data)

| Today | Agent (Meta vision) |
|---|---|
| `StepActivityControl` fetches only `client_category→ageBand` (`src/components/activities/StepActivityControl.tsx:19`), modal `GenerateActivityAgentModal.tsx:1` is unified UI picker, therapist manually picks System/My/Custom | Auto-generates draft on step edit using patient context + tool calls |

**Patient data agent reads (read-only, scoped to `therapist_owns_patient`):**
- `patients` — id, age, `client_category` (pedia/adolescent/adult/geriatric|old_people), condition/primary_condition, therapy_goals, caregiver_name
- `profiles` — display_name, discipline, ageBand derive
- `home_programs` + `program_steps` — prior programs for patient (avoid repetition)
- `generated_activities` — history (what themes/difficulties already used)
- Step context — `title`, `instructions`, `position`, theme hint `deriveTheme(step)` (80ch)

**SDK/Protocol:** OpenAI SDK `base_url="https://api.meta.ai/v1"` `MODEL_API_KEY` bearer; Responses API recommended for agentic loops (preserves reasoning chain via `previous_response_id` or stateless `include:["reasoning.encrypted_content"]` replay — Chat Completions cannot replay `reasoning_content` externally). See [/docs/protocols/responses](/docs/protocols/responses). `token_counting` pre-check 1M window. Same RLS as `api/activities/generate` (`therapist_owns_patient` check `src/app/api/activities/generate/route.ts:55`), no PHI to client beyond agent preview. Token-efficient prompts already slice to 420/320ch.

---

## 2) Agent loop — 3 sources in one

### 2.1 Tools (flat Responses shape — `type:"function"` top-level, `strict:false` default; custom `type:"custom"` Responses-only — see [tool-calling](/docs/tool-calling)) — max 3 calls/run, `parallel_tool_calls:true` — execute every `function_call`, return one `function_call_output` per `call_id` (1-64 chars) via `previous_response_id` threading — `tool_choice:"auto"` only
1. `tool.fetch_patient({ patientId })` → `{ ageBand, condition, goals, priorThemes, age }`
2. `tool.list_templates({ ageBand, category, scope })` → `activity_templates` (system + therapist), already efficient seeds `supabase/all_in_one_setup.sql:1220`
3. `tool.generate_activity({ ageBand, category, titleOverride, theme, difficulty, lineStyle, customSparkPrompt, customImagePrompt, referenceLinks, referenceImages, generateImage })` → `runSparkActivitySpec` (`src/lib/meta/activity-generator.ts:68`) + optional `runMuseImage` (`:329`). Budget enforced `src/lib/meta/prompts.ts:155` + `api/activities/generate` slice 800/600ch.

### 2.2 Orchestrator `POST /api/agent/activity/run`
```
// Responses API agentic loop (preferred) — OpenAI client base_url https://api.meta.ai/v1, Bearer MODEL_API_KEY
// Step 0: optional token preflight (1M window) via /docs/token-counting
// Step 1: responses.create({ model:"muse-spark-1.3", reasoning:{effort:"medium", summary:"auto"}, input: system+user, tools:[{type:"function",name:"fetch_patient",...},{type:"function",name:"list_templates",...},{type:"function",name:"generate_activity",...}], parallel_tool_calls:true, text:{format:{type:"json_schema", name:"activity_spec", strict:true, schema: ActivitySpecSchema}}, prompt_cache_key:"aruga-activity-agent", prompt_cache_retention:"24h" })
// → output: function_call items (call_id, streamed via response.function_call_arguments.delta/done). Exec locally; return via responses.create({ previous_response_id: resp.id, input:[{type:"function_call_output", call_id, output: JSON.stringify(result)}] })
// Retry: maxRetries 2, timeout 55000ms; strict:false first then strict:true; recursive schema rejected → flatten depth ≤10; tool_search not combinable with json_schema same turn — sequence turns (see tool-search)
Input: { patientId, creatorId, step: {title, instructions, position}, action: "auto_draft"|"regenerate", feedback?: string }
 1. Planner picks (a) best System template id + theme override OR (b) custom prompt synthesized from patient+step
 2. First responses.create → reasoning (private) + parallel function_call batch: fetch_patient + list_templates (one turn)
 3. Second responses.create with previous_response_id + function_call_output → continues reasoning (preserved) → calls generate_activity (muse-spark-1.3-contributor, max_output_tokens 6000, concise retry 7000 on length — activity-generator.ts:70). Constrained decoding guarantees valid JSON (depth ≤10/5k props/120k chars or 400)
 4. Validate ActivitySpecSchema (src/lib/meta/schemas.ts:70) locally, patch truncated defaults
 5. Persist generated_activities status=ready + return + agent_runs trace (reasoning summary if requested)
Stop: 1 draft per step. No autonomous attach — pending approval.
```

**Cost/Reasoning/Cache:** `reasoning` tokens share `max_output_tokens` budget — set high for reasoning+JSON; Muse Spark is reasoning model → `logprobs` unsupported; `reasoning.summary:"auto"` optional trace; prefix cache automatic — stable system prompt first, var step last, optional `prompt_cache_key:"aruga-activity-agent"` + `prompt_cache_retention:"24h"` for bursty; monitor `usage.input_tokens_details.cached_tokens` (subset billed reduced) — see [prompt-caching](/docs/prompt-caching). Reasoning billed as output. Spark $ token budget only, Muse Image only if `generateImage=true` (checkbox). 1 draft = 1 Spark call + 0/1 image call.

**Meta notes:** `temperature:0.35` honored but `reasoning.effort` is primary depth dial; `none` disallowed on Spark/Wonder (400); `max` only on `muse-spark-1.3` & `muse-wonder-1.0` not contributor — see [reasoning](/docs/reasoning). `tool_choice` `none|required|named` → 400, only `auto`. `call_id` 1-64 chars. Historical tool_calls validated only on most-recent turn. Combine tool calling+structured output via tool schemas or text.format on follow-up turn. Max reasoning uses more output budget.

### 2.3 Revision checklist
- [ ] Planner LLM: same `muse-spark-1.3-contributor` or GPT-4o mini?
- [ ] Auto-trigger on step blur vs explicit "Agent draft" button?
- [ ] Max 1 draft per step or allow therapist Request 3?

---

## 3) Contracts

### 3.1 Transport (Meta) — `openai.responses.create({model:"muse-spark-1.3", reasoning:{effort:"medium"}, text:{format:{type:"json_schema",...}}, tools, parallel_tool_calls:true, prompt_cache_key, stream:true})`; fallback `chat.completions.create({model, reasoning_effort:"medium", messages, response_format:{type:"json_schema",...}, tools})` for Chat harnesses — flat vs nested tool shape differs (see tool-calling). `tool_search` unavailable on Chat.

### 3.1 Request (client → agent) // HTTP shape
```json
{
  "patientId": "uuid",
  "creatorId": "uuid",
  "step": { "title": "Peg Pick & Sort", "instructions": "pincer grasp 5 pegs...", "position": 2 },
  "patientContextHint": "derived 80ch",
  "action": "auto_draft",
  "generateImage": true
}
```

### 3.2 Response (agent → client, pending approval)
```json
{
  "draftId": "uuid (generated_activities.id)",
  "status": "pending_approval",
  "title": "Peg Pick & Color Sort — Pedia",
  "instructions": "Connect ... (≤350ch)",
  "ageBand": "pedia",
  "category": "visual_motor",
  "sparkSpec": { "title", "instructions", "visualBrief", "refinedImagePrompt (≤600ch)", "layoutSpec": { "orientation", "lineGuides", "zones": [] }, "difficulty", "estimatedMinutes", "warnings" },
  "base_image_url": "https://.../activity-assets/... or null if text-only",
  "reasoning": "Picked Shape Sort & Trace — large targets for pincer grasp; tailored for 6y bilateral delay, low clutter",
  "sources": ["system:Shape Sort & Trace", "patient:leo chen 6y pedia"],
  "modelIds": { "spark": "muse-spark-1.3-contributor", "image": "muse-image-1.0" },
  "latencyMs": 4200
}
```

### 3.3 Routes + Meta Image
- Muse Image: `POST /v1/images/generations` `{model:"muse-image-1.0", prompt, n:1, size:"1024x1024"}` → url/b64_json; `POST /v1/images/edits` for edits; multi-turn refine via Responses — see [image-generation](/docs/image-generation). Uses `activity-generator.ts:329`
- SAM 3.1 (if needed): `POST /v1/files` + `POST /v1/responses` `{model:"sam-3.1", input:[text_prompt,image]}` → boxes+RLE — [media-segmentation](/docs/media-segmentation)

### 3.3 Routes (Next wiring Meta+DB)
- `POST /api/agent/activity/run` — therapist-only, validates `therapist_owns_patient`, orchestrates Responses fetch+generate, creates `agent_runs` trace (input_tokens_details.cached_tokens + output_tokens_details.reasoning_tokens)
- `POST /api/agent/activity/approve` — `{ draftId, programStepId }` → link `program_steps.generated_activity_id = draftId`
- `GET /api/agent/activity/status?patientId=` — polls pending drafts per program

---

## 4) Approval UX (therapist only)

**From single `draftId` → 4 actions in-step:**
1. **Approve** → attach to step, show `Attached to Step 2 — client will draw/print` (`StepActivityControl.tsx:132`)
2. **Edit** → opens full `GenerateActivityAgentModal` pre-filled (System/My/Custom tabs, 420/320ch counters, ReferenceInputs, image toggle, Save as My Prompt)
3. **Regenerate** → `action=regenerate, feedback="make larger targets"` → new draft
4. **Reject** → discard draft, keep manual picker

**Trigger:** `StepActivityControl` auto-calls `POST /api/agent/activity/run` on `step.title/instructions` debounce 1s (or "Draft with Agent" button if auto too noisy). Shows `Analyzing patient + drafting...` (1-2s Spark), then approval card with preview + reasoning chips.

**Also:** `therapist/activities` studio keeps standalone agent modal for browsing.

---

## 5) Migration & build

**DB (no new tables required, optional trace):**
```sql
-- reuse generated_activities for drafts (pending_approval via status or client state)
-- optional trace:
create table if not exists agent_runs (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid references patients(id) on delete cascade,
  step_position int not null,
  draft_id uuid references generated_activities(id),
  reasoning text not null,
  trace jsonb not null, -- [{thought, tool, observation}]
  status text not null check (status in ('pending','approved','rejected')),
  created_at timestamptz default now()
);
```
**Existing efficient seeds:** already `supabase/migrations/20261031000014_efficient_activity_templates.sql`

**Phased build:**
- **Phase 0 (this PR):** `src/lib/meta/agent.ts` planner + `api/agent/activity/run` + auto-draft wiring in `StepActivityControl` (approval-gated)
- **Phase 1:** `approve` route + trace UI + Save as My Prompt from draft
- **Phase 2:** Prior activity history avoidance + longitudinal personalization

---

## 6) Open questions
- [ ] Auto on edit or button?
- [ ] Show reasoning chips to therapist or hide?
- [ ] Allow client-visible draft before therapist approve? (No — therapist-only until `Approve`)

**Next:** Edit checkboxes, say `approve ACTIVITY_AGENT_PLAN` to scaffold `agent` + approval wiring.
