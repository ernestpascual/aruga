# Aruga — Hackathon Winning Conditions (Code-Only Recalibration: Judge-Local, Meta-APIs-Only, No Demo Credit)

**Timestamp:** `1103261848` (November 3, 2026, 18:48 PST)
**Document ID:** `HACKATHON_WINNING_CONDITIONS_1103261848`
**Head Commit:** `412978b7ce7ba17a8c8785ed749729bf2c82a3a1` — `update test suite and docs`
**Working tree at audit time:** clean (`git status` empty — the tree IS the commit; nothing staged, stashed, or untracked outside `audit/`/`docs/` housekeeping)
**Recalibration Trigger (participant, 2026-11-03):** *Judges will only have Meta APIs and will run the app locally — no Supabase. Provide an unauthenticated path so they can demo the features. Redo the audit on the latest commit hash. Do not include the demo in the analysis.*
**Previous Hackathon Audits:** [HACKATHON_WINNING_CONDITIONS_1103261726.md](old/HACKATHON_WINNING_CONDITIONS_1103261726.md) (judge-local, 7.80/10 — first judge-local edition, same constraint) · [HACKATHON_WINNING_CONDITIONS_1103261714.md](old/HACKATHON_WINNING_CONDITIONS_1103261714.md) (hosted model, 7.35/10) · [HACKATHON_WINNING_CONDITIONS_1103261642.md](old/HACKATHON_WINNING_CONDITIONS_1103261642.md) (41/50) · [HACKATHON_WINNING_CONDITIONS_1102260208.md](old/HACKATHON_WINNING_CONDITIONS_1102260208.md) (43/50)
**Superseded files archived to:** `old/` (1103261726 pair + untimestamped duplicate pair)
**Interactive Companion:** [HACKATHON_WINNING_CONDITIONS_1103261848.html](HACKATHON_WINNING_CONDITIONS_1103261848.html)
**Companions:** [audit_report_1103261642.md](audit_report_1103261642.md) · [HIPAA_COMPLIANCE_AUDIT_1103261642.md](HIPAA_COMPLIANCE_AUDIT_1103261642.md) (production deployment only — see §2) · [BUSINESS_MODEL_CANVAS_V5_1103261642.md](BUSINESS_MODEL_CANVAS_V5_1103261642.md) · [LLM_AUDIT_1103260036.md](LLM_AUDIT_1103260036.md) (key validity probes)

**Status:** ✅ **STAGE ONE: PASS (judge-local topology) · Official Stage-Two estimate 7.90/10 (was 7.80) · Projected 8.50/10 with the §8 judge-quickstart shipped · DEADLINE Wed Nov 4, 9:00 PM EST (6:00 PM PST)**

---

## 0. Auditor's Note — What "Do Not Include the Demo" Means Here

The participant's instruction for this edition has three parts, applied literally:

1. **Base everything on the latest commit hash.** Every load-bearing claim below cites a file and line verified in the working tree at `412978b` (tree verified clean — the cited code IS the commit). No claim is carried forward from a prior edition without re-verification; where re-verification changed a claim, the delta is stated in §1.
2. **Unauthenticated local operation is the fixed constraint, not a preference.** Judges run `npm run dev` on their own machines with only a Meta Model API key. No Supabase URL, keys, or project; no accounts; no login. Anything requiring a database is out of the demo by definition.
3. **"The demo" is excluded from scoring evidence.** For this audit, *demo* means: (i) mock/placeholder fallbacks, `DEMO_*` fixtures, `isDemo`/mock branches, and the in-test Supabase fake (`tests/mocks/supabase-fake.ts` — harness-only, judges never run it); (ii) demo video and walkthrough materials (`docs/DEMO.md`'s login-first walkthrough, any recorded demo). None of these count as capability. The scored surface is shipped code paths that execute real Meta API calls on judge-supplied inputs. Tier A playgrounds are scored because they are real routes calling real models — not because they are labeled "demo".

Consequence: score movement in this edition comes only from (a) newly verified facts at HEAD, and (b) correction of prior-edition claims that do not survive HEAD verification. No credit is given for prescribed-but-unshipped work (§8 stays a projection, not a score).

---

## 1. Delta Since 1103261726 (Same Constraint, New Commit)

`e1d8d89..412978b` contains **zero `src/` changes** (verified: `git diff --stat e1d8d89 412978b -- src/` empty) — the range is tests, docs, and audit housekeeping. The product the judges run is byte-identical to what 1726 verified. This edition therefore re-verifies rather than re-discovers, and its deltas are:

| # | Claim / item | 1726 status | HEAD verification (`412978b`) | Effect |
|---|---|---|---|---|
| 1 | Test suite hermetic 93/93 | Cited as 39/93 liability ("if a judge runs `npm test`") | **Fixed and verified this session:** `npm test` → 7 files, 93 passed, ~1s, no env, no network (`tests/mocks/supabase-fake.ts` + contract-aligned tests). `npm run build` type-checks clean including tests | **Technical +0.5** — the single largest judge-runnable craft proof after the playgrounds |
| 2 | `npm run build` passes | Implied, not stated | Verified during this session on the identical tree | Supports Technical; no deduction |
| 3 | Tier A route table (§2) | Verified at e1d8d89 | Re-verified line-by-line at HEAD — all rows hold; two wordings tightened (Modal secret posture, sam-test persistence) | No movement (confirms, doesn't add) |
| 4 | Bonus "inspect `agent_runs` traces and re-run agents locally" | Claimed as local advantage | **Corrected:** goal/highlights/clinical-biomech `run` routes hard-require Supabase (`*_agent/*/run/route.ts` all `if (!admin) return 503`), so no traces exist locally and those agents cannot re-run on a judge machine. The locally re-runnable agentic loop is `POST /api/tools/biomech/run` (Spark planner → SAM 3.1 → Modal → adherence) plus the activity spec pipeline | Bonus fit unchanged; evidence corrected (no score change — fits were never about traces) |
| 5 | Goal Tracking considers home-program step results | Not claimed in 1726 | **Checked and NOT present:** `GoalEvidence` type carries per-step fields (`goal-agent.ts:20`) but the route still selects only `id, state, created_at` (`goal-tracking/run/route.ts:56`) and the prompt uses only state/date (`goal-agent.ts:63`). Excluded from scoring per §0 | No movement (Tier B either way; recorded as deferred work, not a finding) |
| 6 | §8 prescription items (JUDGE_DEMO.md, ARUGA_DEMO gate, `.env.example` fix, 3-min video, Modal URL confirmation) | All ❌ | Still ❌ — `JUDGE_DEMO.md` absent, no `ARUGA_DEMO`/`JUDGE_DEMO` string anywhere in `src/` or docs, `.env.example:4` still reads "Supabase (required)", `docs/DEMO.md` still opens with a login/persona walkthrough (header: *"Updated for Commit: e5a7bd6"*), Modal live status not verifiable from the repo | Projection basis unchanged; Demo held (see §5) |
| 7 | `modal/deploy.sh` | Referenced by DEPLOYMENT_GUIDE flow | **Deleted at HEAD** (`ls modal/` → `app.py`, `DEPLOYMENT_GUIDE.md` only). Guide's direct `modal deploy modal/app.py` command remains valid; script-based flow does not exist | Docs-debt note added to §8 (one line, not scored) |
| 8 | ESLint "487 problems" deduction (carried in Technical) | Cited as remaining deduction | **Dropped as evidence:** no ESLint config ships in the repo (`npm run lint` has no config to run against), so the figure is not reproducible from the commit. Replaced with a verifiable deduction (monolith pages: 3120/1784/1123 lines, `wc -l` at HEAD) | Part of Technical +0.5 (removes an unverifiable strike; the verified strike stays) |

---

## 2. The Judge-Local Demo Surface — Re-Verified at HEAD `412978b`

Method: `grep createAdminClient/createServerClient` per route file; `if (!admin)` = hard requirement (503 without Supabase), guarded `if (admin)` = graceful degradation. No test run, no mock, no fixture counts as evidence — only the branch structure in the committed code.

### Tier A — Works with only a Meta key (the judge path)

| Surface | Route(s) | Why it works without Supabase (HEAD file:line) |
|---|---|---|
| **Biomechanic playground** `/tools/biomech` | `POST /api/tools/biomech/run` | Admin touched **only** inside the `videoStoragePath` branch (`route.ts:41`); direct `videoDataUrl` uploads skip it entirely. Localhost payload bypass intact (`route.ts:58-62`, ~100 MB direct). SAM 3.1 + Spark planner run on the Meta key |
| **SAM workspace** `/sam-test` | `POST /api/sam-test`, `POST /api/agent/biomech/demo` | sam-test keeps an **in-memory ring buffer** — no DB by design (`route.ts:22`); DB insert is best-effort inside `if (admin)` (`route.ts:223-225`). Demo route header: *"No DB required"* (`demo/route.ts:10`), takes `videoDataUrl`, forwards to Modal |
| **Activity playground** `/activity-agent-playground` | `POST /api/activities/generate`, `GET /api/activities/templates` | Generate works key-only; every `admin` use is guarded (`generate/route.ts:50,121,153` — persistence skipped, generation proceeds). Templates hard-requires admin but every caller `.catch(() => ({templates: []}))` (`GenerateActivityAgentModal.tsx:73-74`) — empty shelf, working generator |
| **Meta helpers + chat** | `POST /api/meta/draft-program`, `POST /api/meta/draft-feedback`, `POST /api/ot-chat` | Zero `createAdminClient`/`createServerClient` references in any of the three route files (verified by grep). Pure Meta API calls on the request body. `/aruga-guide` renders without login (no redirect/route-guard code in the page) and every conversation-history fetch is wrapped in `try/catch` + `.catch()` — chat works, history silently doesn't persist |
| **Bundled sample clips** | `public/demo/*.mp4` (4 files, verified present) | Judges who won't record get `tabletop_exercise`, `cup_grasp_transfer`, `block_stacking`, `washcloth_supination` |

Two newly verified facts since 1726: (a) therapist/client dashboards have **no forced login redirect** — without a user they render inert empty states (fetch functions early-return on `!user?.id`), so judge wandering reads as "empty product", not a crash; (b) `npm test` (93/93, ~1s, hermetic) and `npm run build` both pass with zero env — judges can verify craft without any keys at all.

### Tier B — Expected to be inert locally (must be documented, not discovered)

Login + all CRUD (clients, programs, submissions, reviews, SOAP, messages, notifications, therapist-link, transfers, care guides, activity completions), `POST /api/agent/goal-tracking/run`, `POST /api/agent/highlights/run`, `POST /api/agent/biomech/run`, `POST /api/agent/biomech/save`, `POST /api/agent/activity/run`, `POST /api/ai/soap-summary` (cache read/write), `POST /api/client/submissions/upload` — every one hard-requires `createAdminClient()` and returns 500/503 with blank env. These are not broken; they are the production product, out of scope for a Meta-key-only demo. The failure mode today is a judge *finding* them by clicking around and reading "500" as breakage. §8 fixes this with a demo-mode gate rather than judge luck.

### The one external dependency beyond Meta: Modal

Full biomech (joint angles, not just SAM masks) needs `MODAL_MHR_URL`. Judges will not deploy `modal/app.py` (checkpoints, volume, `modal deploy` — and note `modal/deploy.sh` no longer exists at HEAD; deployment is direct `modal deploy modal/app.py` per the guide). **The endpoint is the team's already-deployed Modal function; judges need only the URL string in `.env.local`.** Without it, Tier A degrades honestly: tools/biomech returns typed `503 MODAL_NOT_CONFIGURED`; the demo route returns typed `502/503` before spending judge credits. Per `modal/DEPLOYMENT_GUIDE.md`, the Modal secret is **optional** — if the deployment enforces `MODAL_SECRET`, judges cannot proceed (a 401 reads as a broken demo), so ship the URL with no secret gate for the judging window. Live/reachable status of the deployment is **not verifiable from this repo** — it is checklist item #3, unchanged.

---

## 3. The Unauthenticated Approach — Design Rules (Unchanged, Still Unshipped)

Unauthenticated must be a *deliberate, bounded* design, not an accident a judge stumbles into. Four rules (re-verified as still-needed at HEAD — none is implemented):

1. **Scope it to judge-supplied data.** Demo routes accept uploads (`videoDataUrl`) and bundled samples; they never enumerate or expose pre-existing records. Tier A routes satisfy this today: none of them can read another person's data because locally there is no other person. State this property in the README quickstart; it is the answer to any "is this secure?" question: *"Locally there is one user and only the data they bring."*
2. **Make demo mode visible.** One env flag (e.g. `ARUGA_DEMO=1`, set in the judge `.env.local` template) should: show a slim "Judge demo — local, unauthenticated, not for patient data" banner, hide/disable Tier B navigation (login, caseload, submissions) with a tooltip instead of a 500, and be **documented as forbidden for hosted deployments**. This converts every Tier B dead-end from apparent breakage into visible intent. (~Half a day of UI gating; no route rewrites — Tier A already works.)
3. **Fail loud and typed, never fake.** The existing pattern is correct and should be kept verbatim: missing Meta key → 503 with the exact env var named; missing Modal → 503 `MODAL_NOT_CONFIGURED`; SAM finds nothing → 422 with per-concept failures. Judges forgive configuration errors they can fix; they do not forgive invented output. Do not add mock-result fallbacks to hit a demo deadline.
4. **Keep the production sentence one click away.** The video/README should carry the scoped sentence: *"This local demo is intentionally unauthenticated — it runs on your machine with your videos. The production deployment adds Supabase auth, per-therapist ownership gates, and audit logging; that's the HIPAA-audited configuration."* (True today for original routes per C1–H4; the agent-route gate is the known pre-pilot fix — do not claim it is shipped. If asked directly, the honest answer is "demo surface auth-free by design; clinic surface gated; agent routes get the same gate before any real deployment.")

---

## 4. Stage One — Recalibrated (§G8)

Stage One asks: viable idea, fits a problem statement, **reasonably used the Meta Model API** — assessed by running it locally with a Meta key. Under that procedure Aruga is unusually well-matched: the Meta-powered surfaces are precisely the DB-free ones, so the thing judges can run *is* the Meta integration, with no database diluting the attribution.

| Gate | Verdict (was) | Judge-local evidence at HEAD |
|---|---|---|
| Fits Build for Your World | ✅ | Unchanged — domain problem, time freed, newly-possible measurement |
| Reasonably uses Meta Model API | ✅ **stronger than hosted scoring** | Judge personally executes Spark (draft-program, chat), SAM 3.1 (sam-test, biomech), Muse Image (worksheets) within minutes of `npm run dev`; 13 surfaces / 4 model families per `LLM_AUDIT_1103260036` (live probes 200 OK at audit time) |
| Viable product | ✅ | Condition relocated in 1726 and now fully satisfiable: viability = "the Tier A path completes on a judge's machine." Build passes, 4 sample clips ship, localhost payload bypass verified (`tools/biomech/run/route.ts:58-62`), typed config errors. The hosted conditions (auth fix, suite) are pre-pilot, not Stage One |

**Stage One verdict: PASS** (condition from 1726 stands: ship the §8 quickstart so judges land on Tier A first try).

---

## 5. Stage Two — Recalibrated at HEAD (§G8, Official Weights)

| Category (weight) | 1726 | **Now (this edition)** | What moved and why |
|---|---|---|---|
| **Impact (30%)** | 8 | **8** | Held — beneficiaries, magnitude, problem-statement fit are properties of the idea and market, not of runtime topology. Local demoing neither adds a pilot LOI nor removes the quantified time savings |
| **Use of Meta AI Tooling (25%)** | 9 | **9** | Held — and the evidence quality point from 1726 stands: judges run SAM themselves and see `billedRequests`, tracks, and per-concept failures live. Creativity/beyond-basic-integration is credited on executed integrations only (per §0, no demo-material credit) |
| **Technical Depth & Execution (20%)** | 7 | **7.5** | +0.5, all verified: (1) the test suite is restored and hermetic — `npm test` is 7 files / 93 passing in ~1s with zero env, so the "39/93 if a judge runs it" deduction is gone, replaced by a positive; (2) the carried-over "487 ESLint problems" strike is **withdrawn as unverifiable** — no ESLint config ships in the repo, so the figure cannot be reproduced from this commit; (3) remaining, verified deductions hold the ceiling: monolith pages (`therapist/clients/[id]` 3120 lines, `client/programs/[id]` 1784 lines, `therapist/submissions/[id]` 1123 lines) and Tier B dead-ends still rendering as 500s until the §8 gate ships |
| **Demo (25%)** | 7 | **7** | Held — the guided path is still missing and every blocker named in 1726 is still present at HEAD: no `JUDGE_DEMO.md`, `.env.example:4` still labels Supabase "**required**", `docs/DEMO.md` still opens with a login/persona walkthrough (header pins commit `e5a7bd6`), `ARUGA_DEMO` gate absent. Demo score remains a documentation problem, not a product problem |

### Weighted total

```
                    1103261726    This edition (1103261848)
Impact      8       2.40          2.40
Meta Tool.  9       2.25          2.25
Technical   7→7.5   1.40    →     1.50
Demo        7       1.75    →     1.75
                    ─────         ─────
TOTAL               7.80 / 10     7.90 / 10
```

**Projected with §8 shipped** (quickstart + `.env.example` fix + printed Modal URL + demo-mode gate + 3-minute local-path video; suite item already done, forms/credits unchanged): Technical 7.5→8 (Tier B reads as intent), Demo 7→9 → **8.50/10**. Every remaining point is documentation/UI gating the team controls outright — no external dependency, no accuracy study, no LOI.

---

## 6. Bonus Prizes — Recalibrated (§G9, With One Correction)

| Prize | Change under judge-local |
|---|---|
| Best Agentic ($5k) | ✅ Unchanged fit, **evidence corrected**: the re-runnable agentic loop on a judge machine is `POST /api/tools/biomech/run` (Spark planner → SAM 3.1 → Modal SAM3D → deterministic adherence) and the activity spec pipeline — both executable with only a key. The 1726 line about "inspecting `agent_runs`-style traces and re-running agents" is withdrawn: goal/highlights/clinical-biomech `run` routes 503 without Supabase, so no traces exist locally. Do not pitch traces judges cannot open |
| Best Creative ($5k) | ✅ Unchanged (Muse Image worksheets; judge can generate a sheet for a program they invent on the spot — participatory demos win creative categories) |
| Most Viral ($20k) | Unchanged mechanics (X post, engagement to Nov 8 EOD) |
| Community Vote ($10k) | Unchanged (gallery, Nov 16) |
| Best Open Weight ($10k) | ❌ Still ineligible (API models, not self/partner-served Spark Open/Glimmer). Skip, as before |

---

## 7. Judge Quickstart — the Document to Ship (target: `JUDGE_DEMO.md` + README section)

Ship this as a top-of-README section and a submission-form link. Every line below is verified against HEAD; write it exactly this concretely:

```bash
git clone https://github.com/ernestpascual/aruga && cd aruga
npm install
cp .env.example .env.local   # then fill ONLY the three lines in step 2
npm run dev                  # http://localhost:3000
```

1. **You need:** Node 20+, a Meta Model API key (your hackathon credit key). No Supabase, no accounts, no login — the demo is intentionally unauthenticated and runs entirely on your machine.
2. **Set in `.env.local`:** `MODEL_API_KEY=<your key>`, `AI_MODE=live`, `MODAL_MHR_URL=https://<team's deployed Modal endpoint>` (provided by the team; only needed for full joint-angle biomechanics). Leave all `SUPABASE_*` lines blank.
3. **Open in order:** `/tools/biomech` (upload `public/demo/cup_grasp_transfer.mp4` or your own ≤15s clip → SAM 3.1 tracks → Modal measures angles; allow ~2 min on first run) → `/sam-test` (free-form SAM concepts on any clip) → `/activity-agent-playground` (Spark writes a program, Muse Image draws its worksheet).
4. **Expected behavior:** therapist/client login areas are the production product and are inert without Supabase — that's intended, not a bug. Missing-key or missing-Modal states return explicit 503s naming the env var; nothing in the demo fabricates results.
5. **The production sentence:** *"This local demo is intentionally unauthenticated — it runs on your machine with your videos. The production deployment adds Supabase auth, per-therapist ownership gates, and audit logging (HIPAA-audited configuration)."*
6. **Optional craft check (no keys needed):** `npm test` (93/93, ~1s, hermetic — no env, no network) and `npm run build` (clean). The suite runs entirely on in-memory fixtures; it never touches a database.

Also fix the two contradictions that would stop a judge at step 2: `.env.example:4` ("Supabase (required)") → "(optional — leave blank for judge demo)", and point `docs/DEMO.md`'s header at `JUDGE_DEMO.md` for hackathon judging (the 7-minute login walkthrough remains valid for the hosted product).

---

## 8. Remaining Sprint — Recalibrated (≈1 day)

| # | Item | Effort | Points at stake |
|---|---|---|---|
| 1 | `JUDGE_DEMO.md` quickstart (§7) + README top-section + `.env.example` "(required)"→"(optional — blank for demo)" fix + Modal URL printed + `modal/deploy.sh` note (script deleted at HEAD — quickstart must use direct `modal deploy modal/app.py`) | ~1h | Demo 7→8; prevents the only Stage One failure mode left (judge never gets it running) |
| 2 | `ARUGA_DEMO=1` gate: banner + hide/disable Tier B nav with tooltip; verify Tier A end-to-end with blank Supabase env from a clean clone | ~half day | Demo 8→9, Technical +0.5 (dead-ends become intent) |
| 3 | Record the **3-minute video from the local demo path itself** (screen-capture the playgrounds) | ~half day | Demo holds 9 under Stage Three live re-watch |
| 4 | Credits + forms: claim Meta $150 (by Nov 4, 9 PM ET) and Modal $100; Startups track; Representative; contributor list; repo Public + LICENSE | ~1h | Eligibility (unchanged from prior edition) |

**Done since 1726 (removed from the sprint):** test-suite restoration — `npm test` is 93/93 hermetic at HEAD; cite it freely. The old "never cite 93/93" guidance is retracted.
**Explicitly deprioritized as before** (post-Nov 4, pre-pilot; P0/P1 in the production audits): agent-route ownership gates (HIPAA H-1), home-program step results in the Goal Tracking prompt (type fields exist, route/prompt not yet wired — Tier B only, judge-irrelevant), async/GPU biomech for hosted timeouts. Spending the final day on them would optimize for judges who will never encounter the conditions those fixes address.

---

## 9. Final Checklist (judge-local edition)

| # | Condition | Status |
|---|---|---|
| 1 | Tier A playgrounds run with Meta key only, no Supabase (verified in source at HEAD) | ✅ built — verify once from clean clone with blank `SUPABASE_*` |
| 2 | Bundled sample clips for judges (`public/demo/*.mp4` ×4) | ✅ present at HEAD |
| 3 | Team Modal endpoint URL ready to paste (secret unset or printed) | ❌ confirm before submitting (live status not verifiable from repo) |
| 4 | `JUDGE_DEMO.md` + README quickstart + `.env.example` fix | ❌ §8.1 (~1h) |
| 5 | `ARUGA_DEMO=1` banner + Tier B nav gating | ❌ §8.2 (~half day) |
| 6 | Production-vs-demo sentence in video + README (§3.4) | ❌ at recording |
| 7 | 3-minute video, recorded from local path, public link verified | ❌ §8.3 |
| 8 | Repo Public + LICENSE; Startups track; Representative; contributors | ❌ §8.4 |
| 9 | Credits claimed (Meta $150 by Nov 4 9 PM ET; Modal $100) | ❌ today |
| 10 | `npm test` 93/93 hermetic + `npm run build` clean (judge-runnable craft proof) | ✅ verified at HEAD this session |
| 11 | Submitted before **Nov 4, 6:00 PM PST** — target Nov 4 morning | ❌ |

**Bottom line:** The confirmed judging setup plays to Aruga's architecture, and this edition tightens the one thing the last edition got wrong about verification: the test suite is no longer a liability to hide — it is hermetic, green, and runnable by a judge with zero configuration. What remains is one hour of honest documentation, half a day of demo-mode gating, and a 3-minute video of the demo judges will actually run. **Stage Two 7.90/10 today, 8.50/10 projected — pre-pilot production fixes explicitly deferred, not abandoned.**

*Generated for `aruga@412978b7ce7ba17a8c8785ed749729bf2c82a3a1` — Family: `HACKATHON_WINNING_CONDITIONS` · Previous: `old/HACKATHON_WINNING_CONDITIONS_1103261726.*` (judge-local, 7.80/10) · Stable copy: `docs/HACKATHON_WINNING_CONDITIONS_LATEST.*` · Basis: code at HEAD (working tree verified clean; `src/` identical between `e1d8d89` and `412978b`), participant-confirmed judge-local/Meta-only setup · Excluded from scoring per §0: mock/placeholder fallbacks, DEMO fixtures, demo video/walkthrough materials · Production posture unchanged: `HIPAA_COMPLIANCE_AUDIT_1103261642.md` governs any hosted/real-patient deployment.*
