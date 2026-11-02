# GOAL_TRACKING_AGENT_PLAN.md — Goal Tracking Agent (STG/LTG vs SOAP + Activity)
**Source:** `plan/BIOMECH_ENGINE_PLAN.md` agent pattern + 110126 goal tracking request
**Meta Stack:** Meta Model API `https://api.meta.ai/v1` · `muse-spark-1.3` `reasoning:{effort:"high", summary:"concise"}` (high for 7-signal check; `max` not on contributor) · Responses `previous_response_id` · `text.format=json_schema` locked verdict schema · `prompt_cache_key:"aruga-goal-tracking"` · 1M context
**Status:** Draft for revision — edit checkboxes and approve

> **One-liner:** Agent ingests STG/LTG + SOAP S/O/A/P + Biomech `mhr_results` + HomeProgram activity completions → **checks if goals are being hit**, flags at-risk, suggests keep/escalate/discharge, writes Goal Review draft per patient.

---

## 0) How to revise this doc
- [ ] Confirm goal sources (§1) — where STG/LTG live vs SOAP-embedded
- [ ] Confirm 7 goal check signals (§2.1) — what counts as “hitting”
- [ ] Confirm agentic loop vs nightly batch (§2.2)
- [ ] Confirm Biomech reuse — no extra Modal call (§3.4)
- [ ] Approve output schema + UI (§4)
- [ ] Sign off migration (§7)

> This file is source of truth. No code changes until `approve GOAL_TRACKING_AGENT_PLAN`.

---

## 1) Why agentic + what it tracks

| Source | Where today | What agent reads |
|---|---|---|
| **STG/LTG** | `profiles.goals` / `patients.goals` or `supabase/all_in_one_setup.sql` pending `goals` JSONB; often embedded in SOAP `assessment`/`plan` | `goals { id, text, domain: UE/gait/neck/ADL/hand, target: “shoulder flex 160° in 6w”, baseline, deadline, status }` |
| **SOAP notes** | `soap_notes` + `supabase/migrations/20261031000006` `subjective/objective/assessment/plan` + `assessment_links` | `page.tsx:609` drafted objective, therapist-edited S/O/A/P, `is_published` / `created_at` |
| **Biomech** | `ai_analyses.mhr_results` + `biomech_jobs` from `BIOMECH_ENGINE_PLAN §3` | `angles`, `rom min/max`, `neckAngles`, `flags`, `confidenceOverall`, `frames` — **reused, no new Modal inference** |
| **Activity** | `home_programs` → `program_steps` → `generated_activities` → `step_submissions` + `submissions.status` | Completion %, on-time, client notes, which `GeneratedActivity` category matched which goal |
| **Therapist notes** | `submissions` therapist feedback per step, `confirmedObs` | Qualitative “pain ↓, effort moderated” — grounds judgment |

**Decision:** Goal Tracking is **planner + reader** only — zero GPU/SAM calls. It consumes prior agents’ outputs plus SOAP/activity DB rows. One LLM call per patient per trigger. Goals are explicit entities; SOAP without structured goals is a blocker to migrate.

---

## 2) Agentic loop — check 7 signals, draft verdict

### 2.1 Goal signals (sole source — 7 checks)
> Each goal is evaluated against up to 7 signals. Agent scores each signal, then verdicts.

| # | Signal | From | Example check | Hitting? |
|---|---|---|---|---|
| 1 | **ROM vs target** | `mhr_results.rom` + goal target | `STG: shoulder flex 160° by 6w` — current `max 158°` → 89% to target | `on_track` / `behind` |
| 2 | **Neck/compensation flag** | `mhr_results.flags` + `neckAngles` | `goal: chin tuck 3/5 without forward-head` — flag `forward_head >25°` persists 3 clips | `at_risk` |
| 3 | **Activity adherence** | `step_submissions` + `home_programs` completions | `goal: pincer 1×/day` — last 14d 9/14 = 64% → below 80% threshold | `behind` |
| 4 | **Adherence trend** | longitudinal `submissions.submitted_at` | 4-wk adherence 92% → 64% drop | `at_risk` |
| 5 | **SOAP objective alignment** | `soap_notes.objective` sentences | Objective never mentions `knee flex` despite LTG knee 120° | `gap` |
| 6 | **Client qualitative** | client note + subjective | “Fatigue ↑ evenings” correlates with afternoon adherence dip | `flag` |
| 7 | **Time to deadline** | goal `deadline` | LTG 8w, 6w elapsed, ROM gain 4°/wk → projected miss | `at_risk` |

> Signals 1-2 are quantitative (Biomech), 3-4 activity, 5-7 qualitative — together prevent numeric-only discharge.

### 2.2 Agentic workflow — planner + 3 tools (no GPU)

**Tools (flat Responses `type:"function"`, `parallel_tool_calls:true`, `tool_choice:"auto"` only, `call_id` 1-64, Responses-only `tool_search` if deferred; see [tool-calling](/docs/tool-calling)) (max 3 calls/run):**
1. `tool.fetch_goals({ patientId })` → `goals[]` + `soap_notes` (last 5) + `home_programs` active — single Supabase join.
2. `tool.fetch_evidence({ patientId, goalIds })` → `{ biomech: [{mhr_results.summary, date}], activity: [{completionRate, streak}], soap: [{objectiveLines}] }` — reuses `ai_analyses.mhr_results` (1 prior Modal call per clip, not new).
3. `tool.draft_goal_review({ goals, evidence })` → LLM → `{ verdicts[], summary, suggestions[] }` — no diagnosis, therapist confirms `page.tsx:478` pattern.

**Orchestrator `POST /api/agent/goal-tracking/run` (Responses — multi-turn reasoning replay; SDK `openai.responses.create({model:"muse-spark-1.3", reasoning:{effort:"high", summary:"concise"}, text:{format:{type:"json_schema",...}}, tools, prompt_cache_key:"aruga-goal-tracking", prompt_cache_retention:"24h", parallel_tool_calls:true}) → `function_call` batch fetch_goals+fetch_evidence in parallel → `previous_response_id` loop):**
```
Input: { patientId, trigger: "on_submission|weekly|manual" }
 1. Call fetch_goals → 4 goals (2 STG, 2 LTG)
 2. Call fetch_evidence for those goalIds → last 30d biomech + activity
 3. Planner LLM system: "You are goal tracker. For each goal evaluate 7 signals §2.1. Return verdict on_track|at_risk|behind|achieved|gap with reason citing evidence ids. Do not diagnose."
    → { verdicts: [{goalId, verdict: "at_risk", signalHits: [2,7], reason: "forward-head persists + deadline 2w left"}] }
 4. Call draft_goal_review → { summary: "2/4 on track", suggestions: ["Continue chin tuck cue", "Escalate shoulder"]} 
 5. Persist to goal_reviews (or agent_runs with intent=goal_tracking) + return. No Modal/LLM replanning beyond 1 retry if signals empty.
```

**Trigger = intent router:** Manual “Check goals” button on `therapist/clients/[id]` + weekly cron + auto on new `submissions` / new `mhr_results`. 3 triggers **reuse same `goal_reviews` latest** — 1 agent run serves all views until new evidence.

### 2.3 Revision checklist — agentic
- [ ] Goals storage: new `goals` table vs JSONB on `patients`?
- [ ] 7 signals locked or allow custom per clinic?
- [ ] Planner model: `muse-spark-1.3` `high` vs `muse-wonder-1.0` `max` delegate for complex cases (Contributor cannot do `max`)? 1.3 via `src/lib/meta/client.ts:13`?
- [ ] Manual only V1 or weekly cron from start?

---

## 3) Contracts (consumes Biomech, no new Modal)

**App:** Next `POST /api/agent/goal-tracking/*`, LLM tokens only. Modal reuse only if fetching `mhr_results`.

### 3.1 Request (Next → agent)
```json
{
  "patientId": "uuid",
  "trigger": "manual",
  "goalIds": ["uuid?"]
}
```

### 3.2 Response (agent → client) — draft
```json
{
  "patientId": "uuid",
  "generatedAt": "2026-11-01T10:00:00Z",
  "modelId": "muse-spark-1.3 reasoning:high + mhr_results reuse",
  "verdicts": [
    {
      "goalId": "uuid",
      "goalText": "STG: shoulder flex 160° in 6w",
      "verdict": "at_risk",
      "confidence": 0.72,
      "signals": { "rom_vs_target": 0.89, "time_to_deadline": 0.42, "adherence": 0.64 },
      "reason": "ROM 142→158° (89% to target) but forward-head flag persists 3/3 clips; deadline 2w out — projected miss at current 2°/wk",
      "evidenceIds": ["mhr:abc", "submission:def"]
    }
  ],
  "summary": {
    "onTrack": 1, "atRisk": 2, "behind": 1, "achieved": 0, "gap": 0,
    "narrative": "1/4 on track; shoulder + neck at risk due to compensation + adherence dip 92→64%"
  },
  "suggestions": [
    { "goalId": "uuid", "action": "continue", "text": "Keep chin-tuck cue, re-check in 1w" },
    { "goalId": "uuid", "action": "escalate", "text": "Increase pincer to 2×/day or add OT visit" }
  ],
  "warnings": ["LTG dysphagia chin-tuck has no recent neck MHR — run U11"]
}
```

Agent internals: joins `goals` + last 5 `soap_notes` + 30d `mhr_results` + 14d activity rate; LLM citations are evidenceIds only.

### 3.3 Routes
- `POST /api/agent/goal-tracking/run` — main, therapist-only, validates `therapist_owns_patient`, calls 3 tools, upserts `goal_reviews status=draft`, returns draft + trace
- `POST /api/agent/goal-tracking/publish` — `is_published true`, visible to client summary if desired
- `GET /api/agent/goal-tracking/status?patientId=` — poller 2s, returns latest draft + trace
- Webhook: none — no Modal callback; agent is LLM-only, writes directly to DB

### 3.4 Cost/Reasoning/Cache — zero extra GPU
- **Modal:** `$0` — reuses `mhr_results` (`§1`); never calls `estimate_biomech`.
- **Meta SAM 3.1:** `$0` — no `segment_concepts`.
- **LLM + reasoning:** reasoning tokens share `max_output_tokens` & billed as output; disable `logprobs` (400 on Spark); `reasoning.summary` optional; cache prefix stable (goals+SOAP template first) → `cached_tokens` reduced billing — see [prompt-caching](/docs/prompt-caching); token preflight via [token-counting](/docs/token-counting)
- **LLM (legacy):** `<$0.002/run` (4 goals × 7 signals) → $1 = ~500 checks.
- **Rule:** Multiple views (dashboard + client page + PDF) **reuse same `goal_reviews` JSON** — no re-bill until new `submissions`/`mhr_results`/`soap_notes`.

### 3.5 Revision checklist — contracts
- [ ] Verdict enum: 4 or 5? (`achieved` separate?)
- [ ] `confidence` shown to therapist or internal?
- [ ] Draft visible to client or therapist-only until publish (`submissions` pattern)?

---

## 4) Agent output (what therapist sees)

**From `§3.2` single JSON → 3 layers:**
1. **Per-goal verdict (engine):** `verdict on_track/at_risk/behind/achieved/gap` + `signals 7` scores + `reason` citing `mhr_results` + `confidence`; flags `low_confidence` if `<2` biomech clips.
2. **Summary (GoalTrackingPanel `components/therapist/GoalTrackingPanel.tsx`):**
   - Cards: `Goal 1 STG shoulder 160° — at_risk 🟡 (89% to target, flag persists)` + progress bar vs deadline
   - Chips: `On track 1` `At risk 2` `Behind 1`; overall `1/4 on track`
   - Chart: Recharts goal progress vs time (ROM max + adherence % dual axis) — reuses longitudinal data `§1`
   - Warnings: `Gap — LTG never in objective`
3. **Draft suggestions → SOAP/Plan:**
   - `summary.narrative` + `suggestions[]` action pills `continue/escalate/maintain/discharge`
   - “Insert into Plan” → appends to `soap_notes.plan` (`page.tsx:609` pattern) — e.g., `Goal Review 11/1: shoulder at risk — continue pincer 1×/day, revisit 1w; forward-head cue chin tuck`.
   - `confirmedObs` checkboxes before publish (`page.tsx:478`).

**Visibility:** therapist-only draft until `publish`; shows `modelId` + disclaimer “AI draft — therapist confirms.” Client sees only if `goal_reviews.is_published` (opt-in).

### 4.1 Estimation
- **How:** goals → target parse (angle, reps, adherence %) → compare to `mhr_results.rom` max/min + `submission` rate + `soap_notes.objective` keyword match + time projection (`(target-current)/ratePerWeek`).
- **Stored:** `goal_reviews` + `biomech_summary` → monthly Highlights Agent (`HIGHLIGHTS_AGENT_PLAN.md`) consumes `verdicts` as input.
- **Accuracy:** quantitative signals ±3-5° (like `§4.1` MPJPE), qualitative signals low confidence → `flag` not `behind`; therapist confirms before `achieved`.

### 4.2 Confidence
- **Per-goal:** `biomech rom_confidence` + `activity sample n` + LLM signal agreement → `confidence 0.72` + `evidenceIds`. <0.6 → `low_confidence`, show “Need 1 more clip” (mirrors `§4.2` confidence).

---

## 5) Use cases — goal-aware intents (reuse Biomech §5)

| # | Goal domain | Where in app | Agent checks from 7 signals | Biomech metric reused | Output → UI | Priority |
|---|---|---|---|---|---|---|
| **G1** | **STG UE ROM** | `therapist/submissions/[id]` per step | Signals 1+2+7 — `shoulder 142→158° vs 160° 6w` | U1 UE ROM (`person, shoulder, elbow, forearm, wrist`) | `at_risk` card + deficit `2°/wk` | [ ] P0 |
| **G2** | **STG hand/pincer** | Pedia peg + adult pinch | Signals 1+3 — hand 5.5 mm + adherence 64% | U2 Hand | `behind` + escalate 2×/day | [ ] P0 |
| **G3** | **LTG gait/TUG** | Adult/gero | Signals 1+4 — symmetry/TUG vs 8w deadline | U3/U4 gait/TUG | `at_risk` fall risk | [ ] P1 |
| **G4** | **Neck/chin-tuck LTG** | All ages (§2.1.1) | Signals 1+2 — `neckAngles` + `forward_head >25°` | U11 Neck | `at_risk` + cue | [ ] P0 |
| **G5** | **Compensation** | Adult hemiparesis trunk | Signals 2+5 — flag + objective gap | U5 Trunk | `gap` warning | [ ] P1 |
| **G6** | **ADL adherence** | Kitchen/home objects | Signals 3+4 — `GeneratedActivity` completion | U8 Adherence | `behind` + reschedule | [ ] P1 |
| **G7** | **SOAP coherence** | Any SOAP | Signals 5 — objective never mentions goal | — (no Biomech) | `gap` badge | [ ] P0 |

### 5.1 Revision prompts
- [ ] P0 top 3 G1/G2/G4 or include G7 coherence from start?
- [ ] LTG domains per clinic — who defines target parse regex?
- [ ] Separate card or merge into BiomechPanel `GoalTrackingPanel`?

---

## 6) Frontend integration (therapist side only)

- **Trigger:** “Check goals” button `therapist/clients/[id]` + auto on `submissions` publish + weekly cron — `POST /api/agent/goal-tracking/run` — disabled until ≥1 `goals` row exists
- **Status:** `goalReviews[patientId]` poll `GET /api/agent/goal-tracking/status` 2s; trace “Fetched 4 goals → 3 biomech clips → 2 SOAP → verdict”
- **Panel:** `components/therapist/GoalTrackingPanel.tsx` — verdict chips, progress vs deadline bar, dual-axis Recharts (ROM + adherence%), suggestion pills, “Insert into Plan” → `setSoapPlan`
- **Trace drawer:** collapsible `agent_runs` thought/action/observation
- **Visibility:** only after `publish`; draft private like `goal_reviews`

### 6.1 Therapist journey — per patient, not per step
> Unlike Biomech (§6.1) per-step loop, Goal Tracking is **per patient** across all steps/goals. One agent run = one patient’s goal set.

**1 Open patient:** `therapist/clients/[id]` — header shows `goals` count, `GoalTrackingPanel` docked above longitudinal chart.

**2 Run:** Click “Check goals” (enabled if ≥1 goal exists) → `POST /api/agent/goal-tracking/run {patientId}` — card polls trace.

**3 See results:** Verdict chips per goal + progress bars + warnings; chart overlays goal deadlines; suggestions ready to insert. No per-step cards — aggregated.

**4 Act:** “Insert into Plan” per suggestion → `soap_notes.plan`; confirm `achieved` only via checkbox before marking goal done. Publish → client summary if enabled.

**Key invariant:** `patientId` is grain; multiple triggers reuse same `goal_reviews` until new evidence.

---

## 7) Data & cost

**Migration:**
```sql
-- goals entity (if not exists)
create table if not exists goals (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references patients(id) on delete cascade,
  therapist_id uuid not null references profiles(id),
  text text not null, domain text not null check (domain in ('ue_rom','hand','gait','tug','trunk','adl','neck','soap_coherence')),
  goal_type text not null check (goal_type in ('stg','ltg')),
  target_value text, baseline text, deadline date, status text not null default 'active' check (status in ('active','achieved','discontinued')),
  created_at timestamptz default now()
);
create table if not exists goal_reviews (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references patients(id) on delete cascade,
  therapist_id uuid references profiles(id),
  verdicts jsonb not null, summary jsonb not null, suggestions jsonb not null,
  trace jsonb not null, status text not null check (status in ('draft','published')), created_at timestamptz default now()
);
-- consumes ai_analyses.mhr_results, no mhr_results write needed
```

**Cost per patient run (4 goals, 3 clips, 14d activity, 5 SOAP):**
- LLM `$0.002`, SAM `$0`, Modal `$0` → $1 = ~500 patient checks. Reuse until new evidence.

---

## 8) Phased build (LLM-only, consumes Biomech)

- **Phase 0 (this week, no DB):** Mock `goals` array + `POST /api/agent/goal-tracking/run` planner mock (no LLM, rule-based 7 signals) + `GoalTrackingPanel` verdict chips
- **Phase 1 (1 wk):** `goals` table + LLM `draft_goal_review` + weekly cron + publish + longitudinal chart
- **Phase 2 (1 wk):** Goal parse regex + adherence projection + Highlights Agent feed (`HIGHLIGHTS_AGENT_PLAN.md`)
- **Phase 3:** PDF export, audit `agent_runs`

---

## 9) Risks & mitigations
- **Goals unstructured in SOAP only:** `fetch_goals` fallback parses `assessment`/`plan` sentences → `gap` if no structured row, prompt therapist to create
- **Biomech low confidence:** verdict `at_risk` not `behind` when `confidenceOverall <0.6`; require 2 clips for `achieved`
- **PHI:** same Supabase RLS, `therapist_owns_patient` check, no Modal PHI
- **Hallucinated target:** LLM validated via enum `domain` + `goal_type` + evidenceIds only

---

## 10) Open questions
1. [ ] Goals table now or derive from SOAP `plan` V1?
2. [ ] Weekly cron enabled V1 or manual only?
3. [ ] Publish to client summary or therapist-only?

---

**Next step:** Edit checkboxes, commit, and say `approve GOAL_TRACKING_AGENT_PLAN` to scaffold `goals` + `api/agent/goal-tracking` LLM-only agent.
