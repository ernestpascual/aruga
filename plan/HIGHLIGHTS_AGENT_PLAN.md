# HIGHLIGHTS_AGENT_PLAN.md — Highlights Agent (Monthly 7 Highlights, Adaptive Analytics)
**Source:** `plan/BIOMECH_ENGINE_PLAN.md` + `GOAL_TRACKING_AGENT_PLAN.md` agents + monthly tracking request
**Meta Stack:** Meta Model API `https://api.meta.ai/v1` · `muse-spark-1.3` `reasoning:{effort:"high"}` (adaptive 7) / `muse-wonder-1.0` `max` optional long-horizon · Responses `previous_response_id` · `text.format=json_schema` 7-locked · `prompt_cache_key:"aruga-highlights"` · 1M context
**Status:** Draft for revision — edit checkboxes and approve

> **One-liner:** Monthly agent ingests **quali + quanti** — recent SOAP notes (S/O/A/P), Home Program feedback (therapist+client), goals (STG/LTG verdicts), adherence, and activity performance (completions + biomech) → **thinks and picks the best 7 data points** for the period → produces **7 customized highlights** per patient per month.

---

## 0) How to revise this doc
- [ ] Confirm 7 highlight slots (§2.1) — locked vs customizable
- [ ] Confirm quali+quanti weighting — adaptive threshold (§2.2)
- [ ] Confirm monthly cadence — 30d window, manual re-roll (§3.3)
- [ ] Confirm Biomech + Goal reuse — zero extra GPU (§3.4)
- [ ] Approve output schema + UI (§4)
- [ ] Sign off migration (§7)

> This file is source of truth. No code changes until `approve HIGHLIGHTS_AGENT_PLAN`.

---

## 1) Why agentic + why 7 highlights

| Monthly input | Where today | Agent reads |
|---|---|---|
| **Quanti** | `ai_analyses.mhr_results` (Biomech `§3`) `rom/confidence`, `goal_reviews.verdicts`, `step_submissions` completion %, `submissions.submitted_at` counts | Numeric deltas MoM: ROM +Δ°, adherence % ±, goals `on_track` ratio |
| **Quali** | SOAP S/O/A/P, therapist step feedback, client comments, `confirmedObs` | Sentiment/keywords: “pain ↓”, “fatigue ↑”, new compensation flag |
| **Activity** | `home_programs` → `program_steps` → `generated_activities` category, `scheduled_dates` | Which program categories drove change; streaks; drops |
| **Prior month** | last `highlights` JSONB | Trend arrow ↑/→/↓ vs last month — adaptive, not static |

**Decision:** Highlights is **aggregator + synthesizer**, not measurer — consumes prior agents’ outputs. 7 slots force prioritization (not 20-line dump). Adaptive = weighting by Δmagnitude + consistency (e.g., 3-clip ROM gain > single outlier; adherence dip + quali “fatigue” compounds).

---

## 2) Agentic loop — 7 slots, adaptive weight

### 2.1 Highlights (sole source — 7 locked, adaptive content)

> **Output contract:** On each run the agent **thinks and picks the best 7 data points** for this patient for this period — not a fixed report. It reads **all recent SOAP notes (S/O/A/P), Home Program feedback (therapist per-step notes + client comments), goals (STG/LTG verdicts), adherence (% + streak + trend), and activity performance (completion, ROM/flags via `mhr_results`)** for the window, weighs what moved, and curates 7. Slots below are the target categories (so output is comparable month-to-month); if a category has no signal the agent writes “Insufficient data — run 1 clip” and substitutes the next-highest-weight data point rather than faking a number.

| # | Slot (target category) | Primary data point it considers (adaptive) | Quali anchor it must cite | When suppressed / substituted |
|---|---|---|---|---|
| 1 | **Goal Progress** | Goals `achieved+on_track / total` MoM + `goal_reviews` deltas | SOAP `plan`/`assessment` mention of goal | If 0 goals → next best point (e.g. adherence) |
| 2 | **Top ROM gain** | Largest ROM Δ° (U1/U2/U11) with `confidence>0.6` + performance consistency | SOAP objective “effort less / smoother” + client note | If <2 clips → Insufficient data placeholder |
| 3 | **Compensation shift** | Flag `on→off` or `off→on` (U5 trunk/neck) change | Therapist flag note + objective gap | If no flags |
| 4 | **Adherence** | Completion % 30d vs prior 30d + streak/trend | Client “fatigue / busy / pain” comment, therapist feedback tone | Always shown |
| 5 | **Neck / cross-age** | `neckAngles` Δ + `forward_head` + chin-tuck reps | Tummy-time / dysphagia / tech-neck note | If no U11 runs |
| 6 | **Program fit** | Activity category completion vs others (which Home Program drove gain/drop) | Favorite program name, therapist per-step praise/correction | Always shown |
| 7 | **Next focus** | Goal risk × time to deadline + adherence risk | Therapist `suggestions[]` from Goal agent | Always shown |

> Planner selects best 7 by weight `|Δ|×consistency×confidence` across all candidates in the period; slot titles stay fixed for comparability, but underlying data point is the highest-weight evidence in that category. Tie-break quanti > quali. Candidate pool = last 30d SOAP + Home Program feedback + goal verdicts + adherence + performance.

### 2.2 Adaptive weight (how 7 are chosen)

**Per signal weight = |Δ| × consistency × confidence.**
- `|Δ|` — absolute change MoM (ROM +14° beats +2°)
- `consistency` — 3/3 clips same direction = 1.0, 1/3 = 0.3
- `confidence` — `mhr_results.confidenceOverall` or `goal_reviews.confidence` avg

Top-weighted signal fills its slot; tie-breaker quanti > quali (prevents hallucinated story). Threshold: weight <0.15 → slot shows `→ stable` not `↑`.

**Orchestrator `POST /api/agent/highlights/run` (Responses — parallel_tool_calls + reasoning replay; if Highlights grows + tool_search for adaptive sources, use `{type:"tool_search"}` namespaces Responses-only, not with json_schema same turn — sequence; see [tool-search](/docs/tool-search)):**
```
Input: { patientId, month: "2026-10" (default last 30d) }
 1. Call fetch_month({patientId, window:30d}) → { soap: last 6 SOAP notes (S/O/A/P), homeProgramFeedback: {therapist per-step notes + client comments}, goals: goal_reviews.latest (STG/LTG), adherence: {completionRate, streak, trend}, activity: {completions by category + performance mhr_results[]}, prior: last highlights }
 2. Curate best 7: compute deltas MoM (ROM max, adherence %, goal ratio) + quali anchors (keyword match objective/notes/feedback); score candidates by |Δ|×consistency×confidence
 3. Planner LLM system: "You are monthly highlights curator. Consider recent SOAP notes, Home Program feedback (therapist+client), goals (STG/LTG) and adherence and activity performance for the period. Think and pick the best 7 data points (one per slot §2.1). Each: title, story ≤25w, delta {quanti, quali}, arrow ↑→↓, weight + evidenceIds. Do not invent numbers — cite mhr:/submission:/goal:/soap: ids. Weight by |Δ|×consistency×confidence; prefer high-signal changes."
    → { highlights: [7×] }
 4. Persist to highlights + return. No Modal/SAM calls. 1 LLM call/month.
```

**Cadence = intent router:** Monthly auto (1st) + manual “Re-roll highlights” — multiple views **reuse same `highlights` JSON** until next month/new evidence.

### 2.3 Revision checklist — agentic
- [ ] 7 slots fixed or allow clinic-custom?
- [ ] Weight formula: keep |Δ|×consistency×confidence or add deadline urgency?
- [ ] Manual re-roll allowed before month end?

---

## 3) Contracts (reuses prior agents)

**App:** Next `POST /api/agent/highlights/*`, LLM tokens only.

### 3.1 Request
```json
{ "patientId": "uuid", "month": "2026-10" }
```

### 3.2 Response — 7 highlights
```json
{
  "patientId": "uuid",
  "month": "2026-10",
  "generatedAt": "2026-11-01T02:00:00Z",
  "modelId": "highlights-curator + mhr/goal reuse",
  "highlights": [
    {
      "slot": 1, "slotLabel": "Goal Progress",
      "title": "2 of 4 goals on track — shoulder ahead",
      "story": "Shoulder STG 89% to target, neck at risk — deadline 2w.",
      "delta": { "quanti": "on_track 1→2 MoM (+1)", "quali": "SOAP plan now mentions shoulder cue" },
      "arrow": "↑", "weight": 0.82, "evidenceIds": ["goal:abc","mhr:def"]
    },
    {
      "slot": 4, "slotLabel": "Adherence",
      "title": "Adherence dipped 92%→64% — fatigue noted",
      "story": "Afternoon sessions dropped; client note: “fatigue evenings.”",
      "delta": { "quanti": "-28% MoM", "quali": "client: fatigue" },
      "arrow": "↓", "weight": 0.71, "evidenceIds": ["submission:xyz"]
    }
    // ... 5 more
  ],
  "summary": { "trend": "mixed", "topDriver": "shoulder ROM + adherence dip" },
  "priorCompare": { "lastMonthTrend": "stable", "deltaVsPrior": "+1 highlight improved" }
}
```

### 3.3 Routes
- `POST /api/agent/highlights/run` — main, therapist-only, validates `therapist_owns_patient`, calls fetch_month + LLM, upserts `highlights status=draft`, returns 7 + trace
- `POST /api/agent/highlights/publish` — `is_published true`, client sees read-only
- `GET /api/agent/highlights/status?patientId=&month=` — returns latest 7 + trace
- Cron: monthly 1st + webhook on `goal_reviews` publish → invalidate

### 3.4 Cost/Reasoning/Cache
- **Modal/SAM:** `$0` — reuses `mhr_results` + `goal_reviews`.
- **LLM + reasoning:** `reasoning.summary:"auto"` optional; `cached_tokens` prefix reuse (prior month template first); `max_output_tokens` covers reasoning+7 JSON; `logprobs` 400; structured constraints depth≤10 etc — [structured-output](/docs/structured-output)
- **LLM:** `<$0.003/run` (7 stories + deltas) → $1 = ~300 months.
- **Reuse:** same 7 JSON serves dashboard, client view, PDF, push — no re-bill.

### 3.5 Revision checklist — contracts
- [ ] Story length: 25w or 15w?
- [ ] Arrows: ↑→↓ only or 5-step?

---

## 4) Agent output (what therapist/client sees)

**From `§3.2` 7 JSON → 3 layers:**
1. **Per-highlight (engine):** `slotLabel` + `title` + `story ≤25w` + `delta quanti/quali` + `arrow` + `weight` + `evidenceIds`; `low_confidence` if <2 clips for that slot.
2. **Summary (HighlightsPanel `components/therapist/HighlightsPanel.tsx` + `components/client/HighlightsStrip.tsx`):**
   - 7 cards grid: `Slot icon + title + arrow + story + delta pill` — e.g., `Goal Progress ↑ 2/4 on track`
   - Overall `summary.trend mixed` + `topDriver` badge; sparkline MoM adherence + ROM
   - “View evidence” → drill to `mhr_results` / `goal_reviews` source
3. **Actions:**
   - “Insert month summary into SOAP” → `plan` line (`page.tsx:609`)
   - Publish → client `client/dashboard` highlights strip (7 dots, 1-line each)

**Activation:** Therapist clicks **Generate highlights** on `therapist/clients/[id]` or dashboard (or waits for monthly auto on 1st) — button enabled only when ≥1 `goal_reviews` or 7d activity exists — `POST /api/agent/highlights/run` returns draft 7 for review. **Visibility:** therapist draft until `publish`; client sees only `is_published` 7, read-only. Disclaimer “AI adaptive highlights — therapist reviewed. Best 7 from this period.”

### 4.1 Adaptive analytics — how 7 adapt
- **How:** 30d window across SOAP + Home Program feedback + goals + adherence + activity performance; agent scores every candidate delta by weight = |Δ|×consistency×confidence; top per slot wins → curated best 7. Slot hidden only if data absent (shows “No data” placeholder, not skip).
- **Stored:** `highlights` + `priorCompare` → year trend.
- **Quali grounding:** every story must cite `quali` anchor (SOAP/client note keyword) + `evidenceIds`; pure quali without quanti → arrow `→`.

### 4.2 Confidence
- **Per-highlight:** `confidence` avg of underlying signals’ `confidence`; <0.6 → `→` not `↑` even if Δ large. Prior month compare adds `confidenceOverall` trajectory.

---

## 5) Use cases — monthly views (consume prior §5s)

| # | Monthly view | Where | Agent slot | Metric reused | Output | Priority |
|---|---|---|---|---|---|---|
| **H1** | **Goal momentum** | `therapist/clients/[id]` top | Slot 1 Goal Progress | G1-G7 verdicts MoM | “+1 goal on track” card | [ ] P0 |
| **H2** | **ROM headline** | Dashboard | Slot 2 Top ROM gain | U1/U2 ROM | “Shoulder +14° this month” | [ ] P0 |
| **H3** | **Compensation story** | Submission review | Slot 3 Compensation | U5 flags | “Forward-head resolved 2/3” | [ ] P1 |
| **H4** | **Adherence alert** | All | Slot 4 Adherence | U8 adherence % | “↓ 28% — check fatigue” | [ ] P0 |
| **H5** | **Neck monthly** | Cross-age | Slot 5 Neck | U11 | “Chin tuck 2→3/5 reps” | [ ] P0 |
| **H6** | **Program ROI** | Home Program list | Slot 6 Program fit | Activity category % | “Kitchen ADL drove gain” | [ ] P1 |
| **H7** | **Next focus** | SOAP Plan | Slot 7 Next focus | Goal risk × deadline | “Escalate shoulder — 2w left” | [ ] P0 |

### 5.1 Revision prompts
- [ ] Client sees all 7 or therapist picks 3?
- [ ] MoM window 30d or calendar month?

---

## 6) Frontend integration

- **Trigger:** Monthly auto 1st + “Generate highlights” button `therapist/clients/[id]` + `dashboard` — `POST /api/agent/highlights/run` — disabled until ≥1 `goal_reviews` or 7d activity exists
- **Status:** poll `GET /api/agent/highlights/status` 2s; trace “Computed 4 deltas → weighted 7 → 1 re-roll”
- **Panels:** `HighlightsPanel.tsx` (therapist 7 cards + sparkline + publish) + `HighlightsStrip.tsx` (client 1-line 7) — share same `highlights` JSON
- **Trace drawer:** collapsible `agent_runs` thought/action/observation
- **Visibility:** only after `publish`; draft private

### 6.1 Journey — monthly, not per step/patient check
> Highlights is **per patient per 30d**, aggregated across Biomech per-step + Goal per-patient.

**1 Month end:** auto 1st → `POST /api/agent/highlights/run` or manual top 7.

**2 See 7:** therapist `clients/[id]` strip + dashboard; client strip if published.

**3 Act:** “Insert into SOAP” / share PDF; reuse until next month.

**Key invariant:** `patientId+month` grain; same 7 reused across all UIs.

---

## 7) Data & cost

**Migration:**
```sql
create table if not exists highlights (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references patients(id) on delete cascade,
  month text not null, -- YYYY-MM
  highlights jsonb not null, -- 7 items §3.2
  summary jsonb not null, trace jsonb not null,
  status text not null check (status in ('draft','published')), created_at timestamptz default now(),
  unique(patient_id, month)
);
-- consumes goal_reviews + ai_analyses.mhr_results + submissions, no new Modal cols
```

**Cost per patient/month (7 highlights, 3 prior agents):**
- LLM `$0.003`, Modal `$0`, SAM `$0` → $1 = ~300 patient-months. Reuse = $0.

---

## 8) Phased build (LLM-only, consumes Biomech+Goal)

- **Phase 0:** Mock `POST /api/agent/highlights/run` rule-based 7 + `HighlightsPanel` 7 cards + sparkline
- **Phase 1:** Cron monthly + LLM adaptive weight + publish + client strip
- **Phase 2:** Year trend + PDF + priorCompare
- **Phase 3:** Push/email digest

---

## 9) Risks & mitigations
- **Thin month (<7d data):** slot shows “Insufficient data” placeholder with `→`, not fake highlight
- **Quali hallucination:** each story must cite `quali` keyword from SOAP/client note + evidenceIds enum
- **PHI:** `therapist_owns_patient`, no Modal, RLS
- **7 forced when 3 noisy:** `weight` threshold 0.15 suppresses ↑ with disclaimer

---

## 10) Open questions
1. [ ] Monthly cron 1st or 30d rolling?
2. [ ] 7 slots fixed or allow therapist to pin 2?
3. [ ] Client sees 7 or top 3?

---

**Next step:** Edit checkboxes, commit, and say `approve HIGHLIGHTS_AGENT_PLAN` to scaffold `highlights` + 7-slot adaptive agent.
