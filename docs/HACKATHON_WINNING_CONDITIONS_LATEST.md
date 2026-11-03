# Aruga — Hackathon Winning Conditions (Recalibrated: Judge-Local, Meta-APIs-Only, Unauthenticated Demo)

**Timestamp:** `1103261726` (November 3, 2026, 17:26 PST)
**Document ID:** `HACKATHON_WINNING_CONDITIONS_1103261726`
**Head Commit:** `e1d8d8987f14e5355bdc8a3fae7cf2802000dfb2` — `integrated biomech engine, ux improvements`
**Recalibration Trigger (participant-confirmed, 2026-11-03):** *Judges will only have Meta APIs. They will not use Supabase, because they will only be running it locally (per the answered question). The submission therefore needs an unauthenticated demo approach.*
**Previous Hackathon Audits:** [HACKATHON_WINNING_CONDITIONS_1103261714.md](../audit/old/HACKATHON_WINNING_CONDITIONS_1103261714.md) (Official Guide edition, 7.35/10 — scored the hosted/production threat model) · [HACKATHON_WINNING_CONDITIONS_1103261642.md](../audit/old/HACKATHON_WINNING_CONDITIONS_1103261642.md) (41/50) · [HACKATHON_WINNING_CONDITIONS_1102260208.md](../audit/old/HACKATHON_WINNING_CONDITIONS_1102260208.md) (43/50)
**Superseded files archived to:** `old/` (1103261714 pair)
**Interactive Companion:** [HACKATHON_WINNING_CONDITIONS_1103261726.html](../audit/HACKATHON_WINNING_CONDITIONS_1103261726.html)
**Companions:** [audit_report_1103261642.md](../audit/audit_report_1103261642.md) · [HIPAA_COMPLIANCE_AUDIT_1103261642.md](../audit/HIPAA_COMPLIANCE_AUDIT_1103261642.md) (production deployment only — see §2) · [BUSINESS_MODEL_CANVAS_V5_1103261642.md](../audit/BUSINESS_MODEL_CANVAS_V5_1103261642.md)

**Status:** ✅ **STAGE ONE: PASS (judge-local topology) · Official Stage-Two estimate 7.80/10 (was 7.35) · Projected 8.55/10 with the §8 judge-quickstart shipped · DEADLINE Wed Nov 4, 9:00 PM EST (6:00 PM PST)**
**Demo topology:** `git clone → npm i → .env.local (MODEL_API_KEY + AI_MODE=live + MODAL_MHR_URL) → npm run dev → three unauthenticated playgrounds, no login, no Supabase`

> No `.env*` was read. Every judge-local claim below was verified in source at HEAD: which routes touch a database, which accept judge-supplied video directly, and what happens when Supabase env vars are simply absent.

---

## 1. What the Recalibration Changes — and What It Does Not

The previous edition (1103261714) scored Aruga as a **hosted production system**: multi-tenant, real patients, an internet-facing URL. Under that threat model, unauthenticated agent routes are a P0 vulnerability and the test suite is the craft evidence. The participant has now confirmed the actual judging topology is different in every load-bearing way:

| Dimension | Hosted model (1103261714) | **Judge-local model (this edition)** |
|---|---|---|
| Where it runs | Vercel + Supabase, public URL | Judge's own machine, `localhost:3000` |
| Credentials supplied | Full stack incl. Supabase keys | **Meta Model API key only** (their $150 credit key) |
| Supabase | Required | **Absent — env vars blank, admin client = `null`** |
| Users | Therapists + real patients (ePHI) | One judge, judge-supplied or bundled sample video, **no real patient data exists on the machine** |
| Auth's purpose | Protect one tenant's ePHI from another | **Nothing to protect — authentication would only block the demo** |
| Timeout regime | Vercel 60s function caps | Local `next dev/start` — Vercel caps do not apply |
| Relevant audit | HIPAA audit + audit_report P0s govern | **This document governs; HIPAA P0-1 is explicitly out of scope for judging** |

**Consequences, stated once and plainly:**

1. **Unauthenticated demo routes are now correct design, not a finding.** On a judge's laptop there is no tenant boundary to enforce: the only video is the one the judge just uploaded, on hardware the judge owns. Requiring Supabase login would make the project *unjudgeable*, which under Stage One ("reasonably used the Meta Model API" — demonstrably, by running it) is the only fatal outcome. The demo surface in §3 is therefore intentionally auth-free.
2. **The HIPAA audit is not retracted — it is scoped.** `HIPAA_COMPLIANCE_AUDIT_1103261642` Finding H-1/P0-1 remains fully valid for any *hosted deployment with real patients* and must be fixed before a clinic pilot. It does not apply to a single-user local demo containing no ePHI, and judges must never be pointed at a hosted Aruga URL loaded with real data as the demo path. Two threat models, two documents, no contradiction. The submission should say this in one sentence (script in §7) rather than let a judge discover the tension.
3. **Two prior deductions shrink or vanish locally:** the Vercel 60s-vs-Modal-130s timeout mismatch (P1-3) does not bind on localhost, and the 39/93 test suite matters only if a judge runs `npm test` — plausible for craft assessment, irrelevant to whether the demo works. One prior deduction *grows*: documentation that assumes login/Supabase (`docs/DEMO.md`, `.env.example`) now actively misleads the only audience that matters.

## 2. The Judge-Local Demo Surface — Verified Route by Route

Aruga already contains a DB-free demo topology; it was built as "playgrounds" and is exactly what this judging mode needs. Verified at HEAD (`grep createAdminClient/createServerClient` per route):

### Tier A — Works with only a Meta key (the judge path)

| Surface | Route(s) | Why it works without Supabase |
|---|---|---|
| **Biomechanic playground** `/tools/biomech` | `POST /api/tools/biomech/run` | Accepts judge-uploaded `videoDataUrl` directly; admin client is only touched if a `videoStoragePath` is supplied (`src/app/api/tools/biomech/run/route.ts:41`). **Localhost bonus:** the 4.5MB Vercel payload guard is explicitly bypassed for local requests — up to ~100MB direct uploads (`route.ts:61`) |
| **SAM workspace** `/sam-test` | `POST /api/sam-test`, `POST /api/agent/biomech/demo` | `/api/sam-test` keeps an **in-memory ring buffer** — no DB by design (`src/app/api/sam-test/route.ts:22`). The demo route declares it in its own header: *"No DB required"* (`src/app/api/agent/biomech/demo/route.ts:10`) and takes `videoDataUrl` |
| **Activity playground** `/activity-agent-playground` | Spark/Muse Image via meta routes | Worksheet generation (Spark spec → Muse Image) needs no persistence to demonstrate |
| **Meta helpers** | `POST /api/meta/draft-program`, `/api/meta/draft-feedback`, `POST /api/ot-chat` | Zero database references in any of the three route files |

Four bundled sample clips already ship for judges who won't record themselves: `public/demo/tabletop_exercise.mp4`, `cup_grasp_transfer.mp4`, `block_stacking.mp4`, `washcloth_supination.mp4`.

### Tier B — Expected to be inert locally (must be documented, not discovered)

Everything behind Supabase returns a clean failure with blank env vars: therapist/client login flows, submissions, `POST /api/agent/biomech/save` (500, needs `biomech_jobs`), goal/highlights **run** routes (admin-gated), SOAP summary cache. These are not broken — they are the production product, out of scope for a Meta-key-only demo. The failure mode today is that a judge *finds* them by clicking around and reads "500" as breakage. §8 fixes this with a demo-mode gate rather than judge luck.

### The one external dependency beyond Meta: Modal

Full biomech (joint angles, not just SAM masks) needs `MODAL_MHR_URL`. Judges will not deploy `modal/app.py` (checkpoints, volume, `modal deploy`) — nor should they. **The endpoint is the team's already-deployed Modal function; judges only need the URL string in their `.env.local`.** Without it, Tier A degrades gracefully and honestly: SAM segmentation + Spark analysis still run, biomech returns `503 MODAL_NOT_CONFIGURED` with instructions (typed error, no fake angles). Ship the Modal URL in the judge quickstart (§8); treat the hosted Modal endpoint as part of the submission, like a demo API key that happens to be a URL. (If `MODAL_SECRET` is set on the deployment, either unset it for the judging window or print the value in the quickstart — judges cannot guess a secret, and a 401 here reads as a broken demo.)

## 3. The Unauthenticated Approach — Design Rules

Unauthenticated must be a *deliberate, bounded* design, not an accident a judge stumbles into. Four rules make it defensible in the room:

1. **Scope it to judge-supplied data.** Demo routes accept uploads (`videoDataUrl`) and bundled samples — they never enumerate or expose pre-existing records. Tier A routes satisfy this today: none of them can read another person's data because locally there is no other person. State this property in the README quickstart; it's the answer to any "is this secure?" question: *"Locally there is one user and only the data they bring."*
2. **Make demo mode visible.** One env flag (e.g. `ARUGA_DEMO=1`, set in the judge `.env.local` template) should: show a slim "Judge demo — local, unauthenticated, not for patient data" banner, hide/disable Tier B navigation (login, caseload, submissions) with a tooltip instead of a 500, and be **documented as forbidden for hosted deployments**. This converts every Tier B dead-end from apparent breakage into visible intent. (~Half a day of UI gating; no route rewrites — Tier A already works.)
3. **Fail loud and typed, never fake.** The existing pattern is correct and should be kept verbatim: missing Meta key → 503 with the exact env var named; missing Modal → 503 `MODAL_NOT_CONFIGURED`; SAM finds nothing → 422 with per-concept failures. Judges forgive configuration errors they can fix; they do not forgive invented output. Do not add mock-result fallbacks to hit a demo deadline.
4. **Keep the production story one sentence away.** The video/README should carry the scoped sentence: *"This local demo is intentionally unauthenticated — it runs on your machine with your videos. The production deployment adds Supabase auth, per-therapist ownership gates, and audit logging; that's the HIPAA-audited configuration."* (True today for original routes per C1–H4; the agent-route gate is the known pre-pilot fix — do not claim it's shipped. If asked directly, the honest answer is "demo surface auth-free by design; clinic surface gated; agent routes get the same gate before any real deployment" — judges reward the distinction, and the guide's Agents sessions primed them to ask.)

## 4. Stage One — Recalibrated (§G8)

Stage One asks: viable idea, fits a problem statement, **reasonably used the Meta Model API** — assessed, per the participant's answered question, by *running it locally with a Meta key*. Under that procedure Aruga is unusually well-matched: the Meta-powered surfaces are precisely the DB-free ones, so the thing judges can run *is* the Meta integration, with no database diluting the attribution.

| Gate | Verdict (was) | Judge-local evidence |
|---|---|---|
| Fits Build for Your World | ✅ | Unchanged — domain problem, time freed, newly-possible measurement |
| Reasonably uses Meta Model API | ✅ **stronger than hosted scoring** | Judge personally executes Spark (draft-program, chat), SAM 3.1 (sam-test, biomech), Muse Image (worksheets) within minutes of `npm run dev`; 13 surfaces / 4 model families per `LLM_AUDIT_1103260036`, live probes 200 OK |
| Viable product | ✅ (was ⚠️ conditional) | Condition relocated: viability = "does the Tier A path complete on a judge's machine." Build passes, 4 sample clips bundled, localhost payload bypass, typed config errors. The hosted conditions (auth fix, suite) are pre-pilot, not Stage One, under this topology |

**Stage One verdict: PASS** (upgraded from Conditional Pass — the condition that remains is shipping the §8 quickstart so judges land on Tier A first try).

## 5. Stage Two — Recalibrated Scores (§G8, official weights)

| Category (weight) | Was (hosted) | **Now (judge-local)** | What moved and why |
|---|---|---|---|
| **Impact (30%)** | 8 | **8** | Guide questions (who benefits, how much it matters, could people use it, problem-statement fit) are properties of the idea and market, not of runtime topology. Local demoing neither adds a pilot LOI nor removes the quantified time savings. Held. |
| **Use of Meta AI Tooling (25%)** | 9 | **9** | Held — and the *evidence quality* improves: judges don't watch a video claim about SAM→3D composition, they run SAM themselves and see `billedRequests`, tracks, and failures live. Creativity/beyond-basic-integration is easier to credit when personally executed. No Voice/open-weights, as before. |
| **Technical Depth & Execution (20%)** | 6 | **7** | Three recalibrations: (1) the DB-free demo architecture is itself craft *for this brief* — in-memory SAM sessions, direct-upload data plane, localhost payload bypass, fail-loud typed errors show a team that designed its seams; (2) the timeout mismatch does not bind locally (Modal's 90–130s completes under `next start`; `maxDuration` is a Vercel concept), removing a "sound engineering?" strike; (3) unauthenticated Tier A routes convert from finding to intent. Remaining deductions: the 39/93 suite if a judge runs it, 487 ESLint problems, monolith page components, and Tier B 500s visible until §8's demo gate ships. |
| **Demo (25%)** | 6 | **7** | The demo already exists as runnable playgrounds with bundled clips — materially better than "a video we haven't cut." Not an 8–9 yet because the *guided path* is missing: no judge quickstart doc, `docs/DEMO.md` still walks a login flow judges can't complete, `.env.example` labels Supabase "**required**" (line 4) while `README.md` calls it optional — a judge who believes `.env.example` may never start. Demo score is now a documentation problem, not a product problem. |

### Weighted total

```
                    Hosted (1103261714)    Judge-local (this edition)
Impact      8       2.40                   2.40
Meta Tool.  9       2.25                   2.25
Technical   6→7     1.20  →                1.40
Demo        6→7     1.50  →                1.75
                    ─────                  ─────
TOTAL               7.35 / 10              7.80 / 10
```

**Projected with §8 shipped** (judge quickstart + demo-mode gate + 3-minute video recorded from the local path): Technical 7→7.5 (Tier B reads as intent; suite claim handled by honest note — full restoration remains post-deadline), Demo 7→9 → **8.55/10**. That projection is cheaper than the previous edition's 8.70 path and more certain, because every remaining point is documentation/UI gating the team controls outright — no external dependency, no accuracy study, no LOI.

## 6. Bonus Prizes — Recalibrated (§G9)

| Prize | Change under judge-local |
|---|---|
| Best Agentic ($5k) | ✅ Unchanged, still strongest bonus fit. Local bonus: judges can inspect `agent_runs`-style traces and re-run agents with their own inputs — verifiable-agents credibility (Agents 102) is *higher* locally than on video |
| Best Creative ($5k) | ✅ Unchanged (Muse Image worksheets; judge can generate a sheet for a program they invent on the spot — participatory demos win creative categories) |
| Most Viral ($20k) | Unchanged mechanics (X post, engagement to Nov 8 EOD) |
| Community Vote ($10k) | Unchanged (gallery, Nov 16) |
| Best Open Weight ($10k) | ❌ Still ineligible (API models, not self/partner-served Spark Open/Glimmer). Skip, as before |

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

Also fix the two contradictions that would stop a judge at step 2: `.env.example:4` ("Supabase (required)") → "(optional — leave blank for judge demo)", and point `docs/DEMO.md`'s header at `JUDGE_DEMO.md` for hackathon judging (the 7-minute login walkthrough remains valid for the hosted product).

## 8. Remaining Sprint — Recalibrated (replaces the hosted fix sprint; ≈1 day, not 2–3)

| # | Item | Effort | Points at stake |
|---|---|---|---|
| 1 | `JUDGE_DEMO.md` quickstart (§7) + README top-section + `.env.example` "(required)"→"(optional — blank for demo)" fix + Modal URL printed | ~1h | Demo 7→8; prevents the only Stage One failure mode left (judge never gets it running) |
| 2 | `ARUGA_DEMO=1` gate: banner + hide/disable Tier B nav with tooltip; verify Tier A end-to-end with blank Supabase env from a clean clone | ~half day | Demo 8→9, Technical +0.5 (dead-ends become intent) |
| 3 | Record the **3-minute video from the local demo path itself** (screen-capture the playgrounds; script in 1103261714 §11 stands, with §3.4's production sentence at 2:20) | ~half day | Demo holds 9 under Stage Three live re-watch |
| 4 | Honest-suite note in README ("test suite under restoration; demo path is the three playgrounds") — do **not** spend deadline hours restoring 54 tests, and never cite 93/93 | ~5 min | Caps Technical downside if a judge runs `npm test` |
| 5 | Credits + forms: claim Meta $150 (by Nov 4, 9 PM ET) and Modal $100; Startups track; Representative; contributor list; repo Public + LICENSE | ~1h | Eligibility (unchanged from prior edition) |

**Explicitly deprioritized by this recalibration** (do after Nov 4, before any clinic pilot — they remain P0/P1 in the production audits): agent-route ownership gates (HIPAA H-1), full test-suite restoration (audit P0-2), async/GPU biomech for hosted timeouts (P1-3). Spending the final day on them would optimize for judges who, per the confirmed setup, will never encounter the conditions those fixes address.

## 9. Final Checklist (judge-local edition)

| # | Condition | Status |
|---|---|---|
| 1 | Tier A playgrounds run with Meta key only, no Supabase (verified in source) | ✅ built — verify once from clean clone with blank `SUPABASE_*` |
| 2 | Bundled sample clips for judges (`public/demo/*.mp4` ×4) | ✅ present |
| 3 | Team Modal endpoint URL ready to paste (secret unset or printed) | ❌ confirm before submitting |
| 4 | `JUDGE_DEMO.md` + README quickstart + `.env.example` fix | ❌ §8.1 (~1h) |
| 5 | `ARUGA_DEMO=1` banner + Tier B nav gating | ❌ §8.2 (~half day) |
| 6 | Production-vs-demo sentence in video + README (§3.4) | ❌ at recording |
| 7 | 3-minute video, recorded from local path, public link verified | ❌ §8.3 |
| 8 | Repo Public + LICENSE; Startups track; Representative; contributors | ❌ §8.5 |
| 9 | Credits claimed (Meta $150 by Nov 4 9 PM ET; Modal $100) | ❌ today |
| 10 | Anti-project language sweep (no medical-advice/sports framing) | ❌ at recording (prior edition §2.2) |
| 11 | Submitted before **Nov 4, 6:00 PM PST** — target Nov 4 morning | ❌ |

**Bottom line:** The confirmed judging setup plays to Aruga's existing architecture. The DB-free, unauthenticated playgrounds — previously scored as the gap in a hosted security story — are the correct and already-built answer to "judges with only a Meta key, running locally." What remains is one hour of honest documentation, half a day of demo-mode gating, and a 3-minute video of the demo judges will actually run. **Stage Two 7.80/10 today, 8.55/10 projected — with the pre-pilot production fixes (auth gates, test suite) explicitly and correctly deferred past the deadline, not abandoned.**

*Generated for `aruga@e1d8d89` — Family: `HACKATHON_WINNING_CONDITIONS` · Previous: `old/HACKATHON_WINNING_CONDITIONS_1103261714.*` (hosted model, 7.35/10) · Stable copy: `docs/HACKATHON_WINNING_CONDITIONS_LATEST.*` · Basis: Participant Guide (Cerebral Valley) as supplied 2026-11-03 + participant-confirmed judge-local/Meta-only setup · Production posture unchanged: `HIPAA_COMPLIANCE_AUDIT_1103261642.md` governs any hosted/real-patient deployment.*
