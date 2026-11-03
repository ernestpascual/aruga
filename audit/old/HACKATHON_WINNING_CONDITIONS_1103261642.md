# Aruga — Hackathon Winning Conditions (Re-Audit at Biomech Commit)

**Timestamp:** `1103261642` (November 3, 2026, 16:42 PST)
**Document ID:** `HACKATHON_WINNING_CONDITIONS_1103261642`
**Head Commit:** `e1d8d8987f14e5355bdc8a3fae7cf2802000dfb2` — `integrated biomech engine, ux improvements`
**Previous Hackathon Audit:** [HACKATHON_WINNING_CONDITIONS_1102260208.md](old/HACKATHON_WINNING_CONDITIONS_1102260208.md) — commit `28bd077` + Meta-only hotfix, **43/50, Stage One PASS**
**Superseded files archived to:** `old/` (1102260208 pair)
**Interactive Companion:** [HACKATHON_WINNING_CONDITIONS_1103261642.html](HACKATHON_WINNING_CONDITIONS_1103261642.html)
**Companions:** [audit_report_1103261642.md](audit_report_1103261642.md) · [HIPAA_COMPLIANCE_AUDIT_1103261642.md](HIPAA_COMPLIANCE_AUDIT_1103261642.md) · [BUSINESS_MODEL_CANVAS_V5_1103261642.md](BUSINESS_MODEL_CANVAS_V5_1103261642.md)

**Status:** ⚠️ **STAGE ONE: CONDITIONAL PASS — capability up (biomech real), execution evidence down (39/93) — 41/50 (was 43/50). Fix P0-1/P0-2 (≈2 days) → projected 45/50. TRACK: BUILD FOR YOUR WORLD (PRIMARY) · PUSH THE FRONTIER (SECONDARY NARRATIVE)**

> No `.env*` was read. All scores below are re-derived from executed checks at HEAD (`tsc`, `vitest`, `next build`, `npm audit`, source grep), not carried over from 1102260208.

---

## 1. Verdict in 60 Seconds

| Question | Answer at `e1d8d89` |
|---|---|
| Does it pass Stage One (viable + reasonably uses Meta Model API)? | **⚠️ CONDITIONAL PASS** — Meta usage deepened (below), build green, but the demo must not claim "93/93 tests" anymore: the suite is **39/93** since `d60fc11` removed the mock seam without updating tests (audit P0-2). Live paths independently verified in `LLM_AUDIT_1103260036` (Spark/SAM probes 200 OK). |
| What got better since 28bd077? | The #1 prior gap — "Biomech MHR not live (mock)" — is **closed**: real SAM 3.1 → Modal SAM 3D Body joint angles with a therapist review UI (`BiomechAnalysisModal`, 492 lines) and 3D dot replay (`Motion3DDots`). Plus two new Spark agents (Goal Tracking `reasoning:high`, Highlights). |
| What got worse? | Test evidence collapsed (93→39) and the new agent routes ship **without ownership checks** (audit P0-1) — a judge or security-savvy reviewer who probes `/api/agent/biomech/save` unauthenticated will find ePHI behavior the last audit bragged about closing. |
| Single highest-leverage move before submission? | Spend the ~2 days on P0-1 + P0-2 instead of any new feature. It converts this doc's headline from "conditional" back to a clean pass and adds ~4 points (41 → 45 projected). |

## 2. Stage Two Rubric — Re-Scored (5 × 10 = 50)

| # | Criterion | Wt | What changed at e1d8d89 | Score (was) |
|---|---|---|---|---|
| **R1 Use of Meta Models** | 25% | Biomech planner adds Spark `reasoning:medium` + 16-keyword SAM concept planning (`src/lib/meta/biomech-planner.ts`); Goal agent uses Spark 1.3 `reasoning:high` + `prompt_cache_key` 24h (`goal-agent.ts:136`); Highlights agent (Spark 1.3); SAM 3.1 now feeds a downstream 3D body model instead of ending at overlays. Still: no tool-calling loop, no native video understanding (frames-as-images), no voice. Meta-only image invariant held (`models.ts` Muse Image only — re-grep in LLM audit). | **9/10** (9) |
| **R2 Innovation & Creativity** | 25% | Prior deduction removed: MHR is **live**, not mock — home-video → SAM-box crop (1060→100ms/frame) → SAM 3D Body → One-Euro-smoothed joint angles/ROM/flags, switchable U1/U5/U11 views without re-billing (`modal/DEPLOYMENT_GUIDE.md`). "Therapist-reviewed, save-once, reload-free" biomech + monthly Highlights + 7-signal goal verdicts is a combination no generic SAM demo has. Still no ground-truth accuracy study — claim trends, not diagnosis. | **9/10** (8) 🔼 |
| **R3 Technical Execution** | 20% | Build green (`next build` 74 pages, 38 API + 31 pages), `tsc 0`, prod deps 0 vulns (`npm audit --omit=dev`), RLS-on-new-tables done right (`20261102000003_agent_tables.sql:98`). **But:** tests **39/93** (54 failures, root-caused to mock-seam removal), **8+ agent routes unauthenticated**, biomech 90–130s Modal CPU vs **60s Vercel cap** = flagship flow can time out live on stage, ESLint 487 problems. Judges *will* run the demo clip; a 60s timeout is a visible failure, not a footnote. | **6/10** (9) 🔽 |
| **R4 Impact & Viability** | 20% | BMC V5: biomech becomes a **+$15/patient/mo measurement add-on at ~93–97% adder margin** on ~$0.40–$1.10 est. COGS — the RTM-evidence story (CPT 98975–98981) is now concrete instead of aspirational. Retained: 73% review-time saved, $29/$49/$499 tiers at 81–88% margin. Founder-clinician validation gap unchanged; no pilot LOI yet. | **9/10** (9) |
| **R5 Polish & Completeness** | 10% | New: `BiomechAnalysisModal` + `Motion3DDots` 3D replay + `overall-feedback-card` make the measurement *visible* in one screen — strong demo theater. Docs family refreshed (this set + LLM audit today). Deductions held: 7-min demo still needs a 90-second cut; `activiy-agent-playground` typo route still ships (both spellings exist); now add: don't put "93/93" on any slide until re-earned. | **8/10** (8) |

**Total: 41/50 (was 43/50).** The −3 on R3 outweighs the +1 on R2 — the project is *more capable and less proven* than at 28bd077. Frontier-track note unchanged: judged on Frontier alone, R2 ≈ 5/10 (live MHR helps; still no fine-tune/benchmark) → ~37/50. Stay on Build For Your World.

**Projected after fix sprint (P0-1 auth + P0-2 tests + async/GPU biomech): R3 6 → 9 (async) or 8 (auth+tests only) ⇒ 44–45/50** — the highest score this project has posted, because R2's mock deduction is now permanently gone.

## 3. Winning Conditions — Checklist Delta

| Condition (from 1102260208) | Status at e1d8d89 |
|---|---|
| Meta-only models, host-validated client, `AI_MODE` degradation | ✅ held (LLM_AUDIT_1103260036 live probes) |
| Structured output (json_schema strict + Zod) on Spark surfaces | ✅ extended to goal agent |
| SAM streaming + dedup billing + frame cache | ✅ extended: SAM output now consumed by Modal 3D stage |
| HIPAA C1–H4 hardening story | ⚠️ intact on old routes, **not yet extended to agent routes (P0-1)** — fix before using "13/13" anywhere |
| 93/93 tests | 🔴 **39/93** — retire the claim today, restore this week (P0-2) |
| Mobile 375px, dark clinical polish | ✅ held; new modals need the same pass — verify `BiomechAnalysisModal` at 375px before recording |
| 90-second demo cut | ❌ still owed; new script below |
| Pilot LOI / clinician quote | ❌ still the biggest R4 upside available |

## 4. Demo Script v2 (90 seconds, biomech-led)

0:00–0:15 Problem: "Therapists eyeball home-exercise video. No measurement, no RTM evidence."
0:15–0:45 Live: patient clip → SAM overlay → biomech modal: joint angles, ROM trend, flags, U-view switch (no re-run). *"Measured, not eyeballed."*
0:45–1:10 Goal verdict + Highlights + plain-English family summary (cached, instant).
1:10–1:30 Close: pricing + privacy one-liner — **only after H-1 ships:** "Every AI run is ownership-checked and audit-logged." Until then, close on measurement + margins and keep the demo on consented footage.

## 5. Pre-Submission Fix Sprint (ordered, ≈2–3 days)

1. **P0-1** (1d): `ownsPatient` gate + `logAuditEvent` + rate limit on `/api/agent/*`, `/api/tools/biomech/*`; sweep `/api/ai/soap-summary`.
2. **P0-2** (1–2d): restore green suite; add auth tests for agent routes; update every "93/93" surface (slides, README) only after it passes.
3. **P1-3** (0.5–2d): async biomech (submit → poll `biomech_jobs`) or Modal GPU; rehearse the exact demo clip end-to-end 3×.
4. Record the 90s cut; add one clinician quote if obtainable (R4 → 10 path).

*Generated for `aruga@e1d8d89` — Family: `HACKATHON_WINNING_CONDITIONS` · Previous: `old/HACKATHON_WINNING_CONDITIONS_1102260208.*` (28bd077, 43/50) · Stable copy: `docs/HACKATHON_WINNING_CONDITIONS_LATEST.*` · Track: Build For Your World (primary), Push The Frontier (secondary narrative only).*
