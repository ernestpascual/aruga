# Aruga — Hackathon Winning Conditions (Track 1 Self-Audit Edition)

**Timestamp:** `1104260104` (November 4, 2026, 01:04 PST)
**Document ID:** `HACKATHON_WINNING_CONDITIONS_LATEST`
**Head Commit:** `4a9a1b4a2db7c1548bcb5b87bd913705443b13ed` — `agent changes and audits`
**Working tree at audit time:** dirty — `README.md` hero swap (+ untracked `public/readme-hero.svg`), 2 modified `src/` files, untracked audit/docs pairs. Scores below use the working tree where noted (hero visual, §5-D6) and committed code everywhere else; `npm test` re-run this session (93/93, ~1 s).
**Edition trigger (participant, 2026-11-04):** *Create my own self-audit score based on Hackathon Winning Conditions — a new version adapted to **Track 1**, rubric redesigned as we wish.*
**Previous edition:** [HACKATHON_WINNING_CONDITIONS_1103261848.md](../audit/old/HACKATHON_WINNING_CONDITIONS_1103261848.md) (official-weight holistic, judge-local, **7.90/10**) — archived to `old/` this cycle.
**Companions:** [WATTMIND_METRICS_AUDIT_1104260059.md](WATTMIND_METRICS_AUDIT_1104260059.md) (participant-supplied Track-2-shaped binary rubric, **6.0/10**) · [audit_report_1103261642.md](audit_report_1103261642.md) · [LLM_AUDIT_1103260036.md](LLM_AUDIT_1103260036.md)
**Interactive Companion:** [HACKATHON_WINNING_CONDITIONS_LATEST.html](HACKATHON_WINNING_CONDITIONS_LATEST.html)

**Status: ✅ STAGE ONE: PASS (Track 1) · Self-audit score 8.15 / 10 under the Track 1 rubric designed in §2 · Shadow scores held constant: 6.0 (WattMind binary) · 7.90 (official holistic) · Projected 9.7 with the §7 sprint · DEADLINE today Wed Nov 4, 9:00 PM EST (6:00 PM PST)**

---

## 0. What This Edition Is — and the Bias Guard

This is a **self-audit**: the rubric in §2 was designed by the participant's side, for Track 1, in this document. That creates an obvious hazard — a self-designed rubric can quietly pay for whatever the project already has. Three guards are built in so this number stays honest:

1. **Every rubric change is disclosed and justified in §3**, item by item, against the two prior rubrics (WattMind binary + official holistic). No item was removed without naming what it cost and why Track 1 justifies removing it.
2. **Shadow scores are reported next to the new score and never dropped.** Aruga is still 6.0/10 on the unmodified WattMind metric and 7.90/10 on the official-weight holistic audit (`old/HACKATHON_WINNING_CONDITIONS_1103261848.md`). If a reader trusts neither adaptation, those numbers stand untouched.
3. **The new rubric still zeroes Aruga's biggest weakness.** The 3-minute video is worth 1.0 pt under this rubric and Aruga still does not have it. A rubric designed to flatter would have dissolved that item into "demo quality"; this one keeps it as the single largest line in the audit (§5).

Design principle for Track 1 (indie / Build-for-Your-World): Track 1 rewards an **identifiable person with a real problem, a working thing they can touch, and AI used imaginatively by a small team** — not research-track artefacts (fine-tunes, published weights) or team-process ceremony (PR review on a solo repo). The rubric therefore moves weight from *frontier production* to *problem authenticity, human-in-the-loop trust, and judge-runnability*, while keeping the Demo video as the heaviest single item because Track 1 judging is demo-led.

---

## 1. Headline Scores — All Three Lenses

| Lens | Rubric owner | Score | What it measures |
|---|---|---|---|
| **Track 1 Self-Audit (this edition, §2)** | Participant-designed | **8.15 / 10** | Track 1 fitness: real-world problem, Meta creativity, solo-build craft, judge experience |
| WattMind Metrics (previous turn) | Participant-supplied, Track-2-shaped | 6.0 / 10 (6.6 conditional) | Binary artefact checklist (Dockerfile, `eval/`, fine-tune, HF, PRs) |
| Official-Weight Holistic (1103261848) | Reconstructed official weights | 7.90 / 10 | Human-judge partial credit (Impact 8 · Meta 9 · Tech 7.5 · Demo 7) |

```
Track 1 Self-Audit   ████████████████████░░░░  8.15
Official Holistic    ███████████████████░░░░░  7.90
WattMind Binary      ███████████████░░░░░░░░░  6.00
```

The three numbers are consistent, not contradictory: each step from 6.0 → 7.90 → 8.15 is a step from *artefact binaries* toward *Track-1-relevant judgement*. §3 itemises exactly which adaptations produce the 6.0 → 8.15 bridge (+2.15) so the delta is auditable rather than asserted.

---

## 2. The Track 1 Rubric (Designed for This Edition — 10.0 pts)

### A · Real-World Impact — "Build for Your World" (3.0)

| # | Item | Pts | Rationale (Track 1) |
|---|---|---|---|
| A1 | Base active hackathon repository | 0.6 | Table stakes |
| A2 | Named beneficiary & lived problem (specific people, specific pain, existing workflow) | 0.5 | Track 1's core question: *whose* world? |
| A3 | Canonical domain specificity (Healthcare/Security/Infra/Robotics/Agents top tier) | 0.4 | Kept from WattMind |
| A4 | Quantified benefit (time/cost/latency numbers with a source a judge can open) | 0.4 | Claims must be checkable, not adjectival |
| A5 | Trust design appropriate to the domain (human-in-the-loop, drafts-never-auto-published, fail-loud) | 0.4 | Track 1 deploys into real lives; in healthcare this is the product |
| A6 | Evaluation evidence (measured latencies/accuracy + automated tests; `eval/` dir *or* a maintained evaluation doc) | 0.4 | WattMind required a directory name; Track 1 requires the *evidence* |
| A7 | End-to-end loop shipped (the full user journey works, not one demo screen) | 0.3 | Indie track favours complete small products over deep fragments |

### B · Meta AI Tooling — Creativity Over Frontier (2.5)

| # | Item | Pts | Rationale (Track 1) |
|---|---|---|---|
| B1 | Base repository | 0.4 | |
| B2 | Verified Meta Model API / SDK integration (dev.meta.ai) | 0.5 | Kept — the hackathon's centre of gravity |
| B3 | Muse Spark reasoning integration | 0.3 | Kept |
| B4 | Multimodal Meta models (≥2 families beyond text: SAM 3.1, Muse Image, Muse Voice, Muse Wonder) | 0.4 | Upweighted vs WattMind (+0.3): multimodal *use* is Track 1 creativity |
| B5 | Multi-model pipeline (3+ distinct Meta families chained in one workflow) | 0.4 | Upweighted (+0.2 → 0.4): chained models are the Track 1 "wow" |
| B6 | Beyond-basic integration (agents, orchestration, tool-calling, grounding, structured outputs, model choice) | 0.3 | New: pays for imagination with the API, not just calls to it |
| B7 | Open-weights / partner bonus — *any* verified form (open-weight model served, e.g. SAM 3D Body on Modal; Spark Open harness via Baseten; partner runtime) | 0.2 | Compressed from WattMind's 1.0 of frontier items (+0.5 fine-tune, +0.3 HF, +0.2 partner): Track 1 neither requires training nor should pretend it happened |

### C · Build Craft — Solo-Scaled Execution (2.0)

| # | Item | Pts | Rationale (Track 1) |
|---|---|---|---|
| C1 | Base repository | 0.3 | |
| C2 | Commit cadence in-window, solo scale (15+ commits) | 0.3 | WattMind's 50-commit tier assumes a team; a solo builder's cadence is scored at solo scale |
| C3 | Automated test suite | 0.4 | Upweighted (+0.3 → 0.4): for a solo builder, tests *are* the review process |
| C4 | Modular source architecture | 0.3 | Kept |
| C5 | Agent orchestration / evaluation harness | 0.3 | Upweighted (+0.2 → 0.3) |
| C6 | Automated CI workflows | 0.2 | Kept — the one ceremony item retained, because it protects the demo |
| C7 | Documentation depth (maintained guides a judge can navigate: agents, integration, evaluation, demo) | 0.2 | Replaces PR discipline (+0.2): on a solo repo, docs are the audit trail PRs would have been |
| — | ~~PR review discipline~~ | removed | A solo Track 1 repo has no reviewers; paying for self-merged PRs pays for theatre (disclosed removal, −0.2 of headroom) |

### D · Demo & Judge Experience (2.5)

| # | Item | Pts | Rationale (Track 1) |
|---|---|---|---|
| D1 | Base repository | 0.3 | |
| D2 | **3-minute video walkthrough** | **1.0** | Still the largest single item in the rubric. Track 1 is demo-led; no adaptation dissolves this |
| D3 | Judge-runnable without accounts (unauthenticated local path, sample inputs bundled, typed config errors) | 0.4 | New, from the 1848 judge-local finding: for Track 1, *runnable-by-the-judge* beats *hosted-but-locked* |
| D4 | Live hosted deployment URL | 0.3 | Kept, slightly downweighted — a locked hosted demo earns less than an open local one (D3) |
| D5 | Reproducible quickstart (README run block + `.env.example` accuracy) | 0.2 | Accuracy graded, not just presence |
| D6 | Visual storytelling (README hero/screenshots/diagram + walkthrough narrative) | 0.3 | Upweighted (+0.2 → 0.3): Track 1 entries are scanned before they are run |

Scoring rule for this edition: items may earn **partial credit in 0.05 steps where the item definition says "graded"** (A6, D5, D6); all other items are binary. This is itself a disclosed adaptation — WattMind was strictly binary.

---

## 3. Bridge: WattMind 6.0 → Track 1 Self-Audit 8.15 (+2.15, Fully Itemised)

| Δ | Pts | What changed and why it is defensible |
|---|---|---|
| Meta frontier compression (B7) | +0.7 | WattMind paid 1.0 across fine-tune/HF/partner-runtime and Aruga earned 0.0 of it. Track 1 pays 0.2 for *any verified* open-weights/partner form; Aruga's SAM 3D Body served on Modal + Spark Open via Baseten harness (`docs/BASETEN_CREDITS.md`) earn it. The other 0.8 was not re-awarded — it was redistributed to B4/B5/B6, which Aruga earns on runtime evidence |
| Impact rebuilt around the beneficiary (A2/A4/A5/A7) | +1.0 | WattMind Impact paid 0.7 for a Dockerfile + an `eval/` *directory name* (Aruga: 0). Track 1 pays that weight for named beneficiaries, quantified benefit, trust design, and a complete loop — all verified in §4. The underlying evidence (`docs/EVALUATION.md`) existed under both rubrics; only its *shape* was wrong, and A6 still docks 0.1 for its staleness |
| Solo-scaled craft (C2/C3/C5/C7) | +0.3 | PR discipline (−0.2, removed as theatre) and the 50-commit team tier replaced by solo cadence + upweighted tests/orchestration + docs depth. CI (C6) deliberately retained at 0 — Aruga still loses it |
| Judge-runnability credited (D3/D6) | +0.15 | WattMind gave the unauthenticated Tier A judge path and sample clips no credit and the README hero no existence (it was added to the working tree this morning). Track 1 pays both. D2 (video) and D4 (live URL) remain 0 — the rubric did not rescue them |
| **Total bridge** | **+2.15** | **6.0 + 2.15 = 8.15** ✓ |

**What the bridge is not:** it is not new capability. Aruga did not get better between the two audits (one README hero aside); the Track 1 rubric *values different things*. That is precisely why §1 keeps all three scores visible.

---

## 4. Scoring — Category A: Real-World Impact (2.9 / 3.0)

| # | Item | Pts | Earned | Evidence |
|---|---|---|---|---|
| A1 | Base active repository | 0.6 | **0.6** | 20 commits Oct 28–Nov 3; build green |
| A2 | Named beneficiary & lived problem | 0.5 | **0.5** | Therapists (PT/OT/SLP) prescribing home programs + clients/caregivers performing them (`README.md:22-26`); named personas with conditions and caseload (`docs/DEMO.md:11-21`); pain = 14–20 min manual review per submission (`docs/EVALUATION.md` §3) |
| A3 | Canonical domain — Healthcare | 0.4 | **0.4** | Top tier; HIPAA-audited production posture (`HIPAA_COMPLIANCE_AUDIT_1103261642.md`) |
| A4 | Quantified benefit | 0.4 | **0.4** | ~73% review-time reduction (14–20 → 3.7–5.5 min), program structuring −75%, SOAP −72%, family summary −88% (`docs/EVALUATION.md` §3); biomech cost ~$0.001–0.002/clip, SAM pass ~$0.009 (`README.md:94,112`) |
| A5 | Trust design | 0.4 | **0.4** | "Every AI output is a **draft pending approval** — never auto-published" (`README.md:20`); per-agent Approve/Publish gates (`README.md:38`); fail-loud typed 503s, no fabricated results (1848 audit §3.3); `Send to clinician` verification gate for the Guide (`README.md:35`) |
| A6 | Evaluation evidence (graded) | 0.4 | **0.3** | Latency table + 75% clinician-confirmation + failure modes (`docs/EVALUATION.md` §§1,2,5) + 93/93 hermetic tests re-run this session. **Docked 0.1:** doc header still pins commit `e5a7bd6` / "80 tests" — one refresh from full marks |
| A7 | End-to-end loop shipped | 0.3 | **0.3** | Prescribe → worksheet → client records → SAM/biomech measure → goal check → review/SOAP → publish → client highlights/guide (`README.md:16-18,40-42`); full route surface in build output |
| | **Subtotal** | **3.0** | **2.9** | |

## 5. Scoring — Categories B, C, D

### B · Meta AI Tooling — Creativity Over Frontier (2.5 / 2.5)

| # | Item | Pts | Earned | Evidence |
|---|---|---|---|---|
| B1 | Base | 0.4 | **0.4** | — |
| B2 | Verified Meta Model API | 0.5 | **0.5** | Host-locked client, non-Meta hosts rejected (`src/lib/meta/client.ts:15-16,35`); IDs vs dev.meta.ai (`src/lib/meta/models.ts:3`); live probes 200 OK (`LLM_AUDIT_1103260036`) |
| B3 | Muse Spark reasoning | 0.3 | **0.3** | `reasoning: {effort:"medium"}` Responses API (`src/lib/meta/spark.ts:333`); reasoning:high goal verdicts (`src/lib/meta/goal-agent.ts:5,153`) |
| B4 | Multimodal (≥2 beyond text) | 0.4 | **0.4** | SAM 3.1 segmentation (`src/lib/meta/sam.ts`, `@meta-sam/parser`) + Muse Image worksheets (`src/lib/meta/activity-generator.ts:334-353`) + Wonder escalation option (`src/lib/meta/models.ts:9`). Voice absent — item needs two, Aruga shows three |
| B5 | Multi-model pipeline (3+ chained) | 0.4 | **0.4** | Spark planner → SAM 3.1 → Modal SAM 3D Body → deterministic adherence (`src/app/api/tools/biomech/run/route.ts:17`); Spark + Image in worksheet generation |
| B6 | Beyond-basic integration | 0.3 | **0.3** | 5 agents with persisted `agent_runs` traces (`src/lib/meta/agent.ts:241`); web-search grounding + model picker incl. Wonder (`src/app/aruga-guide`, `models.ts:6-10`); Zod-structured outputs (`src/lib/meta/schemas.ts`); 7 SAM keyword engines / 700 concepts (`src/lib/meta/sam-engines/`) |
| B7 | Open-weights / partner bonus (any form) | 0.2 | **0.2** | Open-weight SAM 3D Body served on Modal (`modal/app.py`, `ckpts/`); Spark Open 1026 via Baseten harness, 57 sessions documented (`docs/BASETEN_CREDITS.md`). Claimed at the *compressed* Track 1 weight — not as a fine-tune |
| | **Subtotal** | **2.5** | **2.5** | Maxed — this is the category Track 1 exists to reward, and Aruga's strongest suit under any lens (Meta 9/10 holistic) |

### C · Build Craft — Solo-Scaled (1.8 / 2.0)

| # | Item | Pts | Earned | Evidence |
|---|---|---|---|---|
| C1 | Base | 0.3 | **0.3** | — |
| C2 | Commit cadence, solo scale (15+) | 0.3 | **0.3** | 20 commits, all in-window (first 2026-10-28). Batched commit *shape* noted — cadence item pays count at solo scale; message quality is a holistic-judge matter |
| C3 | Automated tests | 0.4 | **0.4** | **93/93, 7 suites, ~1 s, hermetic — re-run this session**; Playwright e2e spec |
| C4 | Modular architecture | 0.3 | **0.3** | `src/` (144 files): `lib/meta/` 15 modules, `lib/supabase/`, `lib/hipaa/`, components/types/config; `modal/` Python service as second module |
| C5 | Agent orchestration / harness | 0.3 | **0.3** | Planner→segment→measure→adjudicate chain; `agent_runs` trace persistence across agents |
| C6 | CI workflows | 0.2 | **0** | `.github/` still absent. Retained in the rubric on purpose: the sprint's cheapest craft point (§7) |
| C7 | Documentation depth | 0.2 | **0.2** | `docs/`: Agents Guide (89 KB), Meta Integration, Evaluation, Demo, Cost Guide, Database Design + audit family. The audit trail a solo repo substitutes for PR history |
| | **Subtotal** | **2.0** | **1.8** | |

### D · Demo & Judge Experience (0.95 / 2.5) — Still the Constraint

| # | Item | Pts | Earned | Evidence |
|---|---|---|---|---|
| D1 | Base | 0.3 | **0.3** | — |
| D2 | **3-minute video** | 1.0 | **0** | Still does not exist. Script drafted (`docs/DEMO_VIDEO_FLOW.md`); sample clips in `public/demo/` are judge *inputs*, never claimed as the walkthrough |
| D3 | Judge-runnable without accounts | 0.4 | **0.4** | Tier A surfaces run on a Meta key alone, no Supabase/login (1848 audit §2, line-verified): `/tools/biomech`, `/sam-test`, `/activity-agent-playground`, Meta helpers; 4 bundled sample clips; typed 503s name the missing env var; localhost ~100 MB payload bypass (`src/app/api/tools/biomech/run/route.ts:58-62`) |
| D4 | Live hosted URL | 0.3 | **0** | `vercel.json` configured (10 routes, `maxDuration: 60`); no URL published anywhere |
| D5 | Quickstart accuracy (graded) | 0.2 | **0.1** | README run block correct (`README.md:80-88`); docked half: `.env.example:4` still labels Supabase "(required)", contradicting the judge-local path (1848 §8.1) |
| D6 | Visual storytelling (graded) | 0.3 | **0.15** | Hero banner added this morning (`README.md:2` → `public/readme-hero.svg`, working tree) + full text walkthrough (`docs/DEMO.md`). No product screenshots or architecture diagram yet — half marks |
| | **Subtotal** | **2.5** | **0.95** | |

### Total

```
A Impact (Your World)   2.90 / 3.0
B Meta Tooling          2.50 / 2.5   ← maxed
C Build Craft           1.80 / 2.0
D Demo & Judges         0.95 / 2.5   ← 1.55 of the 1.85 total loss lives here
TOTAL                   8.15 / 10
```

**Reading:** Under Track 1's own values, Aruga is a near-maxed product (A+B+C = 7.2/7.5) carrying an unfinished demo story (D = 0.95/2.5). The rubric redesign did not move the conclusion of either prior audit — it sharpened it: **everything left is presentation of a finished thing.**

---

## 6. Stage One & Winning Conditions (Track 1)

| Gate | Verdict | Track 1 evidence |
|---|---|---|
| Fits Build for Your World | ✅ | A named world (rehab clinics, home programs), named people, quantified freed time |
| Reasonably uses Meta Model API | ✅ strong | Judges personally run Spark, SAM 3.1, and Muse Image within minutes; 4 model families, chained |
| Viable (indie) product | ✅ | Complete loop A7; therapist-in-the-loop trust model A5 is the viability story for real clinics |

**What wins Track 1, applied to Aruga:** Track 1 fields are won by entries a judge can (1) understand in 30 seconds, (2) run without help, and (3) remember one moment from. Aruga already owns (2) — the judge-local Tier A path (D3) is genuinely rare in a field of login-walled demos — and has the moment for (3): *prescription sentence → Spark picks the joints → SAM tracks them → angles come back as Good/Watch/Needs-support*. What it lacks is (1): the 30-second understanding currently lives in a hero banner and a 156-line README, not in the 3-minute film of that moment. **The winning condition for Aruga in Track 1 is therefore singular: ship the video of the biomech moment, with the production-trust sentence spoken over it.**

Bonus-prize fit (unchanged from 1848, Track 1 lens): Best Agentic — the locally re-runnable Spark→SAM→Modal loop; Best Creative — Muse Image worksheets generated live for a program the judge invents. Best Open Weight remains out of scope and is not chased.

---

## 7. Sprint to 9.7 — Re-Ranked Under This Rubric (Deadline: Today)

| # | Action | Effort | Δ | Running total |
|---|---|---|---|---|
| 1 | Record the 3-minute video from the judge-local path (`docs/DEMO_VIDEO_FLOW.md` script): biomech moment → SAM workspace → worksheet generation; unlisted link at README top | ~half day | D2 **+1.0** | 9.15 |
| 2 | Deploy + publish the live URL (`vercel.json` ready) | ~1 h | D4 **+0.3** | 9.45 |
| 3 | `.env.example:4` "(required)" → "(optional — blank for judge demo)" | 2 min | D5 **+0.1** | 9.55 |
| 4 | Refresh `docs/EVALUATION.md` (93/93, current commit, current latencies) | ~20 min | A6 **+0.1** | 9.65 |
| 5 | 3–4 product screenshots into README (biomech result, SAM overlay, worksheet) | ~30 min | D6 **+0.15** *(→0.3 with #1's stills)* | 9.80* |
| 6 | `.github/workflows/ci.yml` (`tsc + test + build`) | ~30 min | C6 **+0.2** | **~9.7–10.0 band** |

\* Arithmetic ceiling is 10.0; this audit reports the projection as **9.7** because D6 full marks assume screenshots that read well at README scale, which is a judgement call, not a file existence check. Even the self-audit does not award itself a perfect score on a promise.

**Deliberately excluded from the sprint** (would raise other lenses, not this one — do only with leftover time): fine-tune/HF publish (WattMind lens only), Dockerfile/`eval/` directory shapes (WattMind lens; Track 1 A6 already credits the evidence), PR back-filling (theatre under any lens), Muse Voice (B4 already maxed; holistic Creative upside only).

---

## 8. Final Checklist

| # | Condition | Status |
|---|---|---|
| 1 | Track 1 rubric disclosed with itemised bridge from both prior scores | ✅ §2–§3 |
| 2 | Self-audit scored at HEAD `4a9a1b4`; `npm test` 93/93 re-run | ✅ 8.15/10 |
| 3 | Stage One (Track 1) gates pass | ✅ §6 |
| 4 | Judge-local Tier A path + sample clips verified (D3) | ✅ (1848 §2, re-cited) |
| 5 | 3-minute video recorded + linked | ❌ §7.1 (+1.0) |
| 6 | Live URL published | ❌ §7.2 (+0.3) |
| 7 | `.env.example` contradiction fixed | ❌ §7.3 (+0.1) |
| 8 | `docs/EVALUATION.md` refreshed | ❌ §7.4 (+0.1) |
| 9 | README screenshots | ❌ §7.5 (+0.15) |
| 10 | CI workflow green | ❌ §7.6 (+0.2) |
| 11 | Repo public + LICENSE; track selection (Track 1) + representative + contributors on the form | ❌ verify today |
| 12 | Submitted before **Nov 4, 6:00 PM PST** — target this morning | ❌ |

**Bottom line:** On a rubric honestly redesigned for Track 1 — with every adaptation disclosed, both shadow scores (6.0 binary, 7.90 holistic) left standing, and the video still weighted as the largest single item — Aruga scores **8.15/10**, maxing Meta Tooling and near-maxing Impact and Craft. The entire remaining gap is a film, a URL, and three small files. **Projected 9.7/10 by tonight, with no new product capability required.**

*Generated for `aruga@4a9a1b4a2db7c1548bcb5b87bd913705443b13ed` (+ working-tree changes noted in the header) — Family: `HACKATHON_WINNING_CONDITIONS` · Previous: `old/HACKATHON_WINNING_CONDITIONS_1103261848.*` (official holistic 7.90/10) · Stable copy: `docs/HACKATHON_WINNING_CONDITIONS_LATEST.*` · Rubric: participant-designed Track 1 self-audit rubric (§2), bridge-audited against `WATTMIND_METRICS_AUDIT_1104260059.md` (6.0/10) · Self-audit bias guards: §0.*
