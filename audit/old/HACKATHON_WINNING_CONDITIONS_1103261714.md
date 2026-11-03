# Aruga — Hackathon Winning Conditions (Official Participant Guide Edition)

**Timestamp:** `1103261714` (November 3, 2026, 17:14 PST)
**Document ID:** `HACKATHON_WINNING_CONDITIONS_1103261714`
**Head Commit:** `e1d8d8987f14e5355bdc8a3fae7cf2802000dfb2` — `integrated biomech engine, ux improvements`
**Basis:** Meta Global AI Developer Hackathon **Participant Guide** (Cerebral Valley) — problem statements §1, schedule §3, rules §4, resources §5–6, submission §7, judging §8, prizes §9. All section references below (§G1–§G9) are to that guide, as pasted by the participant 2026-11-03.
**Previous Hackathon Audits:** [HACKATHON_WINNING_CONDITIONS_1103261642.md](old/HACKATHON_WINNING_CONDITIONS_1103261642.md) (internal-rubric 41/50) · [HACKATHON_WINNING_CONDITIONS_1102260208.md](old/HACKATHON_WINNING_CONDITIONS_1102260208.md) (commit `28bd077`, 43/50)
**Superseded files archived to:** `old/` (1103261642 pair, then 1102260208 pair)
**Interactive Companion:** [HACKATHON_WINNING_CONDITIONS_1103261714.html](HACKATHON_WINNING_CONDITIONS_1103261714.html)
**Companions:** [audit_report_1103261642.md](audit_report_1103261642.md) · [HIPAA_COMPLIANCE_AUDIT_1103261642.md](HIPAA_COMPLIANCE_AUDIT_1103261642.md) · [BUSINESS_MODEL_CANVAS_V5_1103261642.md](BUSINESS_MODEL_CANVAS_V5_1103261642.md)

**Status:** ⚠️ **STAGE ONE: CONDITIONAL PASS · Official Stage-Two estimate 7.35/10 weighted (projected 8.70/10 post-fix) · DEADLINE: Wed Nov 4, 9:00 PM EST (= 6:00 PM PST) — ≈25 hours from this audit**
**Problem statement (§G1): BUILD FOR YOUR WORLD (primary) · PUSH THE FRONTIER (secondary narrative)**
**Prize track (§G9, declare at submission): STARTUPS recommended (see §2.1) — Indie Developer is the fallback if entered as an individual**

> No `.env*` was read. Product scores are re-derived from executed checks at HEAD (`tsc 0`, `next build` pass, `vitest` 39/93, `npm audit --omit=dev` 0) plus source inspection. Guide facts are taken from the Participant Guide text supplied 2026-11-03; where the guide and prior audits conflict, the guide wins (notably: demo video is **3 minutes**, §G7 — the 7-minute walkthrough in `docs/DEMO.md` and the 90-second cut in prior audits are both superseded by §11 of this document).

---

## 1. The Event, Distilled (Participant Guide §G1–§G9)

| Item | Guide fact | Source |
|---|---|---|
| Problem statements | **Build for Your World** (bring Meta models into your domain; free time/mental space; make possible what wasn't) **or Push the Frontier** (software/robotics/manufacturing/energy/materials; give a machine a new capability; understand/control a physical system) | §G1 |
| Meta tech to incorporate | Muse Spark series, Muse Wonder, Muse Image, Muse Voice Transcribe, **SAM 3.1** via Meta Model API; open weights **Muse Glimmer + Muse Spark Open**; Muse Code agent | §G1 |
| Building period | **Oct 27 – Nov 4, 2026**; kickoff Oct 26 12:00 PM ET | §G3 |
| **Submission deadline** | **Wed Nov 4, 9:00 PM EST** via CV platform; late submissions not considered; Nov 3 is the last full day for submission questions/troubleshooting | §G3, §G7 |
| Judging | Nov 5–8; **closing Mon Nov 9, 12:00 PM ET** — Top 10 (5 per track) live final round; community vote winner **Mon Nov 16** | §G3, §G8 |
| Prize pool | **$1,000,000**: Indie Developer $400k (150/100/75/50/25k) · Startups $550k (250/150/75/50/25k) · Bonus $50k | §G9 |
| Bonus prizes | Most Viral $20k (X engagement to Nov 8 EOD) · Best Open-Weight Build $10k · Community Vote $10k (announced Nov 16) · Best Agentic $5k · Best Creative (Image/Wonder) $5k | §G9 |
| Credits | Meta Model API **$150**/participant — claim by **Nov 4, 9:00 PM ET**, own claim only, card on file + set Spend Limit; Baseten $100 + 2M TPM (≤2,000, use `meta-models/muse-spark-open-1026`); Modal $100 (first 1,000); Fireworks $100 (shortlist) | §G5–§G6 |
| Rules | Public repo; team ≤ 4 (solo allowed); demo must highlight **only** what was built during the hackathon; **new work only** (startups may build on existing code but must identify what's new — failure to identify original contributions = disqualification); no rights-violating or policy-violating projects | §G4 |
| Anti-projects (banned patterns) | **AI giving medical advice** (e.g. AI mental-health advisor, skin-blemish detector), basic RAG, simple image analyzers, AI-for-education chatbots, job screeners, nutrition coaches, personality analyzers, **sports analyzers/coaches**, political/war content | §G4 |
| Submission package | One submission per team/startup via an appointed Representative; **3-minute demo video** (a primary judging artifact, with code + live product); repo + video publicly accessible; everyone who worked on it listed | §G7 |

## 2. Track Decisions (read this first — two different "tracks" exist)

### 2.1 Problem statement (§G1) ≠ prize track (§G9)

The guide uses "track" for both, but they are separate choices:

- **Problem statement** is what Stage One judges fit against (§G8: "reasonably fits the theme"). Aruga is **Build for Your World** — a clinician's own domain problem (home-program review burden) solved with Meta models. Push the Frontier is a *secondary narrative only*: SAM 3.1 → SAM 3D Body does "give a machine a new capability to understand a physical system" (human movement), which is legitimate frontier vocabulary for the video, but Aruga has no robotics/manufacturing/energy claim and no benchmark study — leading with Frontier invites the wrong comparison set.
- **Prize track** is the money bracket: **Indie Developer ($400k)** vs **Startups ($550k)**. Aruga is presented everywhere (`README.md`, BMC V5 pricing, HIPAA/procurement materials) as a *product/startup* with pricing, COGS, and a BAA tier — entering Indie while submitting a startup canvas is an inconsistency judges can see. **Recommendation: submit as Startups**, appoint the founder as Representative (§G7), list every contributor (≤4, §G4). Fall back to Indie only if the submission form requires an individual entrant with no startup entity — and if so, say "solo founder, pre-entity" explicitly on the form.

### 2.2 Eligibility & disqualification risk register (§G4) — the section that can end the run

| Guide rule | Aruga position at `e1d8d89` | Risk / required action |
|---|---|---|
| Public repo | Remote is `github.com/ernestpascual/aruga` (`git remote -v`) — **visibility not verifiable from local git; confirm Public in GitHub settings before submitting.** No `LICENSE` file exists in repo root (verified `ls LICENSE*` → none) | 🟠 Add an OSI license file (MIT/Apache-2.0) — "open source: repositories must be public" is a hard rule; a license makes the grant explicit |
| Team ≤ 4 | Solo founder per repo history; guide allows solo | ✅ List all contributors on the submission page anyway (§G7) |
| **New work only / identify what's new** | **Strong evidence, currently unstated:** repo history starts Oct 28 (`cbb2707` Initial commit) — *inside* the Oct 27–Nov 4 building window — and every feature commit lands Oct 28–Nov 3 | 🟢→ must be **written down**: add a "Built during the hackathon (Oct 27–Nov 4)" section to `README.md`/submission listing the systems in §4 below with commit ranges. The guide's penalty for *failing to identify* original contributions is disqualification at judges' discretion — silence is the risk, not the facts |
| Demo highlights only hackathon-built features | `docs/DEMO.md` is a 7-minute walkthrough stale at commit `e5a7bd6` | 🟠 Replace with the 3-minute script in §11; do not demo pre-window work (there is none of consequence — see above — but claim only what §4 lists) |
| **Anti-project: AI giving medical advice** | Aruga is a health product — this is the closest banned-pattern adjacency. Mitigating facts, all real: **clinician-directed** (licensed therapist prescribes, reviews, publishes; nothing AI-generated reaches the patient without therapist review — `README.md:8`), no diagnosis, biomech sold as trend evidence, `Send to clinician` verification gate in Aruga Guide | 🔴 **Highest framing risk in the submission.** The video/submission text must never say "AI advises/diagnoses." Say, verbatim-pattern: *"Aruga drafts and measures; the licensed therapist decides and publishes."* One careless "AI tells patients…" caption can read as the banned pattern |
| Anti-project: sports analyzer/coach | Biomech measures movement from video — superficially adjacent. Distinguishing fact: clinician-prescribed rehabilitation programs under therapist review, not athletic coaching | 🟠 Never use "sports," "coach," or "form check for athletes" in any submission text; the vocabulary is "home-program rehabilitation, therapist-reviewed measurement" |
| Basic RAG / simple image analyzer | Aruga Guide uses grounded chat, but the product core is multi-agent measurement + workflow, not RAG; SAM use is a multi-concept engine feeding a 3D body model | ✅ Lead with biomech/agents; present Guide as a supporting surface, not the headline |

## 3. Stage One — Pass/Fail (§G8)

Stage One asks two things: (a) the idea is viable and fits a problem statement, (b) it **reasonably used the Meta Model API and/or Meta open-weight models** during the hackathon.

| Gate | Verdict | Evidence |
|---|---|---|
| Fits Build for Your World | ✅ | Domain problem known firsthand (home-program review), time/mental space freed (73% review-time reduction claim, `docs/EVALUATION.md` lineage), enables what wasn't possible (objective home measurement) |
| Reasonably uses Meta Model API | ✅ | 13 Meta surfaces inventoried in `audit/LLM_AUDIT_1103260036.md` — Spark chat/responses, SAM 3.1 streaming, Muse Image — all via host-validated `api.meta.ai` client (`src/lib/meta/client.ts`), live probes 200 OK 2026-11-03 00:36 |
| Viable product | ⚠️ **Conditional** | `next build` passes (74 pages; 38 API + 31 page routes), `tsc 0`, prod deps 0 vulns — **but** `vitest` is 39/93 and 8+ agent routes lack ownership checks (audit_report_1103261642 P0-1/P0-2). Stage One judges "baseline viability" from video + repo + live product, so a broken biomech run on a >15s clip (60s Vercel cap vs 90–130s Modal CPU, P1-3) is the most likely live failure |

**Stage One verdict: CONDITIONAL PASS** — passes on theme and Meta usage today; the condition is that the demo path exercised live (biomech on the rehearsed clip) actually completes, and no slide claims 93/93.

## 4. Meta Tooling Inventory vs the Guide's Model List (§G1)

| Guide technology | Used? | Where (file:line / evidence) | Notes for judges |
|---|---|---|---|
| Muse Spark series (Spark 1.2/1.3 Contributor) | ✅ | `src/lib/meta/spark.ts`, `src/lib/meta/models.ts`; draft-program, analyze-video, feedback, OT chat, activity spec, SOAP summary, goal (`reasoning:high`, prompt-cache 24h), highlights, biomech planner | Structured `json_schema` strict + Zod; the breadth is the R-tooling story |
| Muse Wonder | ✅ | Model picker in Aruga Guide / agentic chat (`runSparkOtChatAgentic`, `src/lib/meta-ai.ts:437`) — Spark 1.2/1.3/Wonder selector | Also the **Best Creative** co-qualifier — see §9 |
| SAM 3.1 | ✅ | `src/lib/meta/sam-engine.ts` streaming (`@meta-sam/parser`), multi-concept dedup + frame cache; feeds Modal SAM 3D Body | Strongest "beyond basic integration" evidence: SAM output is *consumed by a downstream 3D model*, not just drawn |
| Muse Image (1.0/1.1) | ✅ | `src/lib/meta/activity-generator.ts` two-stage Spark→Image worksheet generation; Meta-only invariant re-verified (`LLM_AUDIT_1103260036`) | **Best Creative Build** surface — personalized per-patient worksheets |
| Muse Voice Transcribe | ❌ | Not used (SOAP is text/typed; no audio pipeline) | Honest gap. Do not claim. A 30-second voice→SOAP dictation is the cheapest future R1/R-tooling point — post-deadline |
| Muse Spark Open / Glimmer (open weights) | ❌ | API Contributor models used instead; no self/partner-served open-weight inference | Consequence: **ineligible for Best Build on Meta Open Weight Models ($10k)** unless a surface is re-pointed at `meta-models/muse-spark-open-1026` on Baseten/Modal (§G6) — see §9.3 for the cost/benefit call |
| Muse Code (coding agent) | ✅ (claimed by team) | Built with Muse Spark Open 1026 harness per audit lineage | Mention in "how we built" — the guide lists it as part of the stack (§G1) |
| Inference partners (§G6) | Modal ✅ · Baseten ❌ · Fireworks ❌ | Modal SAM 3D Body (`modal/app.py`, 855 lines) is load-bearing, not decorative | Claim Modal $100 credits; Baseten only if §9.3 is attempted |

**Count for the submission form: 4 of 5 API model families + 1 inference partner, 13 distinct Meta-powered surfaces.** That is a top-decile breadth claim for this field — state it exactly that way, with the two ❌ rows omitted from marketing but never contradicted.

## 5. Stage Two — Official Rubric Re-Score (§G8)

The guide's Stage Two is **four categories, 0–10 each, weighted**: Impact 30% · Use of Meta AI Tooling 25% · Technical Depth & Execution 20% · Demo 25%. (Prior audits used an internal 5×10/50 rubric; the mapping is shown for continuity, but **this weighted score is now the headline**.)

| Category (weight) | Aruga strengths (evidence) | Gaps judges will probe | Score /10 |
|---|---|---|---|
| **Impact (30%)** | Real beneficiary chain: therapists (73% review time saved), clinics (RTM CPT 98975–98981 evidence pipeline, BMC V5), families (plain-English summaries <15ms cached, monthly Highlights); underserved geriatric 55+ band; clinician-directed safety model | No pilot LOI / named clinician quote yet; founder not a credentialed clinician — field-validation narrative still owed; accuracy of biomech angles unvalidated (sell trends, not diagnosis) | **8** |
| **Use of Meta AI Tooling (25%)** | 4/5 API families, 13 surfaces (§4); SAM→3D-body composition "surprises even us" is plausible — SAM masks as *input to another model* is not a tutorial pattern; Spark structured output + prompt caching + `reasoning:high` agents; surprise factor in per-patient Muse Image worksheets | No Voice Transcribe; no open-weight serving; no native tool-calling loop (prompt→JSON agents — the Agents 101/102 sessions, §G3, set a "verifiable agents" bar: Aruga's agent traces in `agent_runs.trace` are the answer — show them) | **9** |
| **Technical Depth & Execution (20%)** | `tsc 0`; build green at 74 pages; RLS-correct new tables (`20261102000003_agent_tables.sql:98`); SAM dedup/cache billing discipline; slim-payload Postgres hygiene (`biomech/save/route.ts:77`); HIPAA C1–H4 lineage on original routes | **39/93 tests** (mock-seam removal, root-caused); **unauthenticated agent routes** (P0-1); biomech timeout mismatch (60s vs 90–130s); ESLint 487 | **6** |
| **Demo (25%)** | Live product exists; biomech modal + 3D dot replay (`Motion3DDots`) is genuinely watchable; dark clinical UI photographs well on video | **No 3-minute video exists yet** — only a stale 7-minute guide (`docs/DEMO.md` @ `e5a7bd6`); flagship flow can time out on an unrehearsed clip; demo-requirement scope discipline (§2.2) unwritten | **6** |

### Weighted total

```
Impact      8 × 0.30 = 2.40
Meta Tooling 9 × 0.25 = 2.25
Technical    6 × 0.20 = 1.20
Demo         6 × 0.25 = 1.50
─────────────────────────────
STAGE TWO ESTIMATE     = 7.35 / 10   (internal-rubric equivalent ≈ 41/50, unchanged from 1103261642)
```

**Post-fix projection** (fix sprint §10 completed + 3-minute video shipped): Technical 6→9, Demo 6→9, Impact/Meta held → **8.70/10**. No other available work moves the weighted score more: the two lowest categories carry 45% of the weight and both are fixable in the remaining ≈25 hours, whereas Impact's missing LOI (the only path to 9–10 there) is not schedulable.

**Stage Three reality check (§G8):** top 5 *per prize track* advance to live final judging on the same rubric. In the Startups bracket the comparison set includes funded teams — 7.35/10 is a credible Stage Two score but a marginal finalist score; 8.70/10 is the realistic finalist threshold. This is the quantitative case for spending the last day on fixes + video instead of features.

## 6. What Was Built During the Hackathon (Oct 27–Nov 4) — the "new work" disclosure (§G4)

Include this table, or a link to it, in the submission. It is Aruga's disqualification shield.

| System | Built (commits) | Meta tech | One-line claim |
|---|---|---|---|
| Whole product baseline (auth, caseload, programs, submissions, messaging, reviews) | Oct 28–31 (`cbb2707`→`8571cda`) | Spark, SAM | Clinician-directed home-program loop |
| Privacy hardening C1–H4 (write-guard, 15m/60m URLs, restrictive RLS, EXIF) | Nov 1 (`6073ec5`, `f77e45e`) | — | 672× breach-window reduction |
| SAM engine (multi-concept, dedup, frame cache) + 700-keyword OTPF-4 taxonomy | Oct 29–Nov 2 | SAM 3.1 | Domain-specific segmentation, not a generic analyzer |
| Activity agent (Spark spec → Muse Image worksheet) | Nov 1–2 | Spark 1.3, Image 1.0 | Per-patient illustrated worksheets |
| Goal Tracking + Highlights agents | Nov 2 (`d60fc11`) | Spark 1.3 | 7-signal verdicts; monthly best-7 |
| **Biomech engine: SAM 3.1 → Modal SAM 3D Body (MHR angles/ROM/flags), review modal, 3D replay** | Nov 2–3 (`d60fc11`, `e1d8d89`) | SAM 3.1, Spark planner | Home video becomes therapist-reviewed movement measurement |
| Care Guide, patient goals, read-states, agent tables (RLS) | Nov 2 | — | Clinical context surfaces |

Pre-window work: **none material** — initial scaffold commit is Oct 28, inside the window. State that sentence explicitly.

## 7. Partner Resources & Credits — Claim Checklist (§G5–§G6)

| Credit | Amount | Deadline / cap | Aruga action |
|---|---|---|---|
| Meta Model API | $150/participant | **Claim by Nov 4, 9 PM ET**; card required; set Spend Limit on Billing page | Claim today (Nov 3); every team member claims their own — credits cannot be claimed for someone else |
| Modal | $100, first 1,000 | Guide §G6 form | Claim — Modal is already the biomech inference partner; cite `modal/app.py` deployment as the use case |
| Baseten | $100 + 2M TPM, ≤2,000, reviewed | Use model id `meta-models/muse-spark-open-1026` (not the docs' non-1026 id) | Only needed if §9.3 (open-weight bonus) is attempted; otherwise skip and say partners used = Modal |
| Fireworks | $100, shortlist | Reviewed with Fireworks | Optional; Aruga has no Fireworks surface — do not claim usage that doesn't exist |

**Spend discipline for demo day:** SAM bills per concept/frame and Spark high-reasoning bills per run; rehearsals on the demo clip should reuse saved biomech results (`agent/biomech/save` GET cache) rather than re-running inference — this is also the timeout-proof demo path (§10).

## 8. Sessions Worth Mining for Judge Vocabulary (§G3)

The guide's live sessions signal what judges were primed to reward: **Agents 101/102** ("multimodal AI agent," "*verifiable* agents" — echo this by showing `agent_runs.trace` thought/tool/observation records on screen), **Building Specialized Intelligence on Fireworks** (inference→training with Muse Open models — the vocabulary for any open-weight answer in Q&A), and daily **#office-hours 10–11 AM ET** (last full troubleshooting day is Nov 3 — today). Nov 4 has final office hours at 9 PM ET, which is the deadline itself — treat Nov 3 office hours as the last usable one.

## 9. Bonus Prizes — Eligibility Playbook (§G9, $50k pool)

| Prize | Eligible now? | Play |
|---|---|---|
| **Best Agentic Use-Case ($5k)** | ✅ Strongest bonus fit | Judges weigh autonomy, task completion, usefulness. Aruga runs four bounded agents (activity, biomech planner, goal, highlights) with persisted traces and a human publish gate. Frame as "agents that *prepare clinical evidence*, therapist publishes" — autonomy with a safety story. Show one trace live |
| **Best Creative Build ($5k)** | ✅ Eligible (Muse Image/Wonder) | Per-patient crayon-style worksheets generated from the clinical program (Spark→Image two-stage) is original + executable, not a filter demo. Include 3 before/after sheets in the video (0:55 segment, §11) |
| **Most Viral ($20k)** | ✅ Requires action | Post the demo (or a 30s biomech-overlay cut) on X and submit the post link via the platform; winner = likes+reposts+comments through **Nov 8 EOD**. The before/after joint-angle overlay is the most shareable asset Aruga has — schedule the post for submission day, not after judging starts |
| **Community Vote ($10k)** | ✅ Automatic via gallery | Winner announced **Nov 16**; one vote per verified account through the platform gallery. List the project gallery-ready (thumbnail = biomech overlay frame) and put the gallery link in the X post and Discord #general/intro follow-up |
| **Best Build on Meta Open Weight Models ($10k)** | ❌ Not eligible today | Requires Muse Glimmer or Muse Spark Open served on own hardware or partner inference, *verified by the infrastructure partner* during Stage One flagging. **Cost/benefit:** re-pointing one surface (e.g. Aruga Guide chat) to Baseten `muse-spark-open-1026` is technically a client-config change (`src/lib/meta/client.ts` host validation currently approves only Meta hosts — allow-list work + quality regression risk on the flagship chat). **Recommendation: skip.** A broken demo costs more than $10k eligibility gains; note it as roadmap honesty if asked |

Do not enter a bonus category with a surface that doesn't exist (Fireworks, open weights) — partner verification (§G9) makes false flags discoverable.

## 10. Submission Package & Fix Sprint — the ≈25 Hours to Nov 4, 6:00 PM PST (§G7)

Submission requires: one entry per startup via the Representative, public repo, accessible **3-minute video**, all contributors listed, project in the gallery. Ordered work (stop-features rule: nothing new after item 3):

1. **[~1d, do first] P0-1 auth fix** — `ownsPatient` gate + `logAuditEvent` + rate limit on `/api/agent/*` and `/api/tools/biomech/*` (pattern: `src/app/api/client/care-guide/route.ts:11` + `src/lib/supabase/owner.ts`). Unblocks the honest privacy sentence in the video.
2. **[~2h] Timeout-proof the demo** — pre-run biomech on the exact demo clip and serve the saved result (`biomech/save` GET); keep live inference as the backup story, not the live dependency. Decide async-vs-GPU post-deadline.
3. **[~1–2d, parallel if hands allow] P0-2 test restoration** — test seam or admin fake; at minimum get `authorization` + new agent-auth tests green and stop citing 93/93 anywhere (slides, README, submission text) until the full suite passes.
4. **[~1h] Paperwork batch** — GitHub repo confirmed Public + add `LICENSE`; `README.md` gains "Built during the hackathon Oct 27–Nov 4" (§6 table) + track statement (Startups, Build for Your World); claim Meta $150 + Modal $100 credits; appoint Representative; list contributors.
5. **[~half day] Record the 3-minute video** per §11 (three takes of the biomech segment; use take selection, not editing heroics), upload publicly, verify the link in a private browser window.
6. **[Nov 4 morning PST] Submit early** — deadline is 6:00 PM PST; platform congestion near 9 PM EST is a known failure mode and late submissions "won't be considered." Post the X viral cut the same hour; drop the gallery link in Discord.

## 11. The 3-Minute Demo Video — Script (§G7, replaces 7-min and 90-s versions)

| Time | Segment | On screen | Say (pattern, not script verbatim) |
|---|---|---|---|
| 0:00–0:25 | Problem | Therapist inbox of home videos | "Therapists prescribe home exercises, then eyeball the video. No measurement, no evidence trail, 14–20 minutes of review per patient." |
| 0:25–1:15 | **Biomech (hero)** | SAM 3.1 overlay → Biomech modal: angles, ROM trend, flags; U-view switch with no re-run | "SAM 3.1 segments the movement; our Modal SAM 3D Body stage turns it into joint angles. Measured, not eyeballed. The therapist reviews before anything is saved." |
| 1:15–1:50 | Agents | Goal verdict (7 signals, one trace expand), Highlights strip, plain-English family summary | "Agents check goals and assemble the month into seven highlights. Families read progress in plain words — cached, instant, free to re-read." |
| 1:50–2:20 | Creative | Spark→Muse Image worksheet: program text → illustrated sheet → child drawing on it | "Every program becomes a worksheet drawn for that one patient." (Best Creative flag) |
| 2:20–2:50 | How it works / Meta stack | Architecture one-pager: Spark ×4 surfaces, SAM 3.1, Image, Wonder picker; agent trace | "Four Meta model families, thirteen surfaces, one host-validated API client. Agents prepare evidence; the licensed therapist decides and publishes." ← the anti-medical-advice sentence, on the record |
| 2:50–3:00 | Close | Pricing one-liner + repo URL | "$49 per intensive patient, measurement add-on $15. Public repo — everything you saw was built October 27 to November 4." |

Rules for the recording: consented/self footage only for biomech; captions on (judges watch muted); no "93/93," no "AI advises/diagnoses," no "sports/coach"; show one failure honestly if it occurs (422 no-video state is a designed state — naming it builds the verifiable-agents story).

## 12. After Submission — Judging Window (Nov 5–16, §G3/§G8–§G9)

- **Nov 5–8:** Judging. Keep the live product up and the demo path warm; do not deploy breaking changes to the judged URL — if a fix must ship, keep it to the P0 class and re-verify the demo clip after.
- **By Nov 8 EOD:** Viral-prize engagement closes — the X post's work happens Nov 4–8, not after.
- **Nov 9, 12 PM ET:** Closing ceremony, Top 10 (5/track) live finals, community vote opens. Finalists re-judged live on the same rubric — the demo video is watched live, so the 3-minute cut *is* the final-round artifact.
- **Nov 16:** Community vote winner announced on Discord.

## 13. Winning Conditions — Final Checklist

| # | Condition (guide source) | Status at 1103261714 |
|---|---|---|
| 1 | Problem statement declared: Build for Your World (§G1) | ✅ decided; state on form + video |
| 2 | Prize track declared: Startups, Representative appointed (§G7/§G9) | ❌ do Nov 4 morning |
| 3 | Stage One: Meta API reasonably used (§G8) | ✅ 4 families, 13 surfaces, live-verified |
| 4 | Repo public + LICENSE (§G4) | ⚠️ verify Public; add LICENSE |
| 5 | "Built Oct 27–Nov 4" disclosure in repo/submission (§G4) | ❌ add §6 table to README (facts are strong) |
| 6 | Anti-project framing audit passed — no medical-advice / sports language (§G4) | ❌ sweep video script + submission text (§2.2 wording) |
| 7 | Technical: agent routes ownership-gated (P0-1) | ❌ fix sprint #1 |
| 8 | Technical: tests green or claims retired (P0-2) | ❌ fix sprint #3 |
| 9 | Demo path completes live (timeout-proofed) | ❌ fix sprint #2 (saved-result path) |
| 10 | 3-minute video recorded, public, link verified (§G7) | ❌ fix sprint #5 |
| 11 | Credits claimed: Meta $150 + Modal $100 (§G5–§G6) | ❌ today (Meta deadline Nov 4 9 PM ET) |
| 12 | Bonus flags honest: Agentic + Creative only (§G9) | ✅ decided; Open-Weight/Viral mechanics per §9 |
| 13 | X post + gallery listing ready for Viral/Community (§G9) | ❌ submission day |
| 14 | Submitted before Nov 4, 6:00 PM PST (9 PM EST) (§G7) | ❌ target Nov 4 morning PST |

**Bottom line:** Aruga's Stage One case and Meta-tooling story are already written by the codebase. The win is now decided by unglamorous work in the next ≈25 hours: one authorization fix, one honest-claims sweep, one 3-minute video, and four form fields. Projected result if executed: **Stage Two ≈ 8.70/10, finalist-competitive in the Startups track.**

*Generated for `aruga@e1d8d89` — Family: `HACKATHON_WINNING_CONDITIONS` · Previous: `old/HACKATHON_WINNING_CONDITIONS_1103261642.*` (internal 41/50) · Stable copy: `docs/HACKATHON_WINNING_CONDITIONS_LATEST.*` · Guide basis: Meta Global AI Developer Hackathon Participant Guide (Cerebral Valley), as supplied 2026-11-03 · Product evidence: `audit_report_1103261642.md`, `LLM_AUDIT_1103260036.md`, executed `tsc`/`vitest`/`next build`/`npm audit` at HEAD.*
