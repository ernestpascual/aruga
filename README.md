<p align="center">
  <img src="./public/readme-hero.svg" width="100%" alt="Aruga — clinician-directed home-program companion for PT, OT and SLP. Five agents (Activity, Biomechanic, Goals, Highlights, Guide) turn a home program from prescription to performance to progress, with the therapist always approving." />
</p>

<h1 align="center">Aruga</h1>
<p align="center"><b>Clinician-directed home-program companion for PT / OT / SLP</b></p>

<p align="center">Built for the <b>Meta Global AI Developer Hackathon</b> — <b>Build for Your World</b> · Next.js 16 · Meta Model API · Supabase · Modal</p>

<p align="center">
  <img src="https://img.shields.io/badge/Meta-AI_Developer_Hackathon-14b8a6?style=flat-square" alt="Meta Global AI Developer Hackathon" />
  <img src="https://img.shields.io/badge/Next.js-16-black?style=flat-square" alt="Next.js 16" />
  <img src="https://img.shields.io/badge/React-19-61DAFB?style=flat-square" alt="React 19" />
  <img src="https://img.shields.io/badge/TypeScript-5-3178C6?style=flat-square" alt="TypeScript 5" />
  <img src="https://img.shields.io/badge/tests-93_passing-brightgreen?style=flat-square" alt="93 tests passing" />
</p>

> Home programs fail when they're generic. Aruga's five AI agents turn a prescription into a patient-aware worksheet, measure real movement from phone video (joint angles, ROM, compensation flags), check goals against evidence, and explain progress in plain words — with the therapist approving everything before it reaches the patient.

<p align="center">
  <a href="#what-it-does">What it does</a> ·
  <a href="#who-uses-it">Who uses it</a> ·
  <a href="#the-5-agents-1-line-each">Agents</a> ·
  <a href="#modal-solution--sam-3d-body-backend-optional">Biomech backend</a> ·
  <a href="#run-it">Run it</a> ·
  <a href="docs/AGENTS_GUIDE.md">Agents guide</a>
</p>

> ⚠️ **Important:** Aruga does not replace therapy — it cannot diagnose, treat, or give medical advice. It only measures movement, drafts materials, and organizes the home program; a licensed therapist reviews and approves everything.

---

## What it does

1. **Therapist prescribes** — types a step (e.g. "Cup lift, hold 3s"). AI drafts a printable worksheet for that patient and age group.
2. **Client practices** — draws / colors the sheet, records a short video, adds a comment.
3. **AI measures + explains** — video becomes joint angles, ROM, and flags. Goals are checked. The month becomes 7 highlights. Aruga Guide answers questions with citations.

1 button per agent. Every AI output is a **draft pending approval** — never auto-published.

## Who uses it

- **Therapist** — manages caseload, prescribes home programs, drafts worksheets, writes SOAP notes, reviews client videos, runs biomech/goal/highlight agents, publishes reviews, sends care guides.
- **Client (+ caregiver)** — follows the program, draws/colors sheets, records videos, adds comments, reads published reviews + highlights + plain-English summaries, chats with Aruga Guide.

### How each user type uses AI

| Agent | Therapist | Client (+ caregiver) |
|---|---|---|
| **Activity** | Clicks `Draft with Agent` per step (`therapist/clients/[id]/programs/new`) → Spark 1.3 drafts instructions + visual brief, Muse Image 1.0 renders line art → Attach / Edit / Regenerate / Reject. Auto-draft on edit (debounced, pending approval). | Draws/colors the assigned sheet (`StepActivityWorksheet`), prints or uploads a photo. No generation — completes what therapist attached. |
| **Biomechanic** | Clicks `Analyze biomechanics` per video (`therapist/submissions/[id]`) or opens playground (`/tools/biomech`, U1–U11 intent) → Spark picks 2–8/16 concepts → SAM 3.1 segments → Modal SAM 3D Body measures ROM/flags → `Good / Watch / Needs support` + `Insert into Objective`. Sees all dates per program, not just latest. | Records the video; reads the published numbers in plain words (`shoulder 142° → 158°`) via review/SOAP summary. No analysis button — consumes therapist-published result. |
| **Goal Tracking** | Clicks `Check goals` (`therapist/clients/[id]` header) → Spark 1.3 reasons over STG/LTG + SOAP + MHR + adherence (chunked 5/batch) → draft verdicts `on_track / at_risk / behind / achieved / gap` → Publish. | Sees published verdicts + `Insert suggestion into Plan` outcome in their program; sees `gap` explanation (`No ROM measurement yet`) instead of raw signals. |
| **Highlights** | Clicks `Generate highlights` (or monthly auto 1st) → Spark 1.3 curates best 7 slots (Goals, Movement, Steady progress, Keep going, Neck & posture, Program fit, Next step) → draft strip → Publish to client dashboard. | Views published 7-moment strip on dashboard (`HighlightsStrip`, `w` weights + `↑/→/↓` vs last month). Never sees the curation prompt — just the story. |
| **Aruga Guide** | Uses same chat (`/aruga-guide`) with client context (profile + program brief) → grounded answers with References → `Send to clinician` verification gate. Model picker (Spark 1.2 / 1.3 / Wonder). | Primary user: asks everyday-words questions, attaches photo/video frames → gets explanation + `Send to clinician` to verify. 6/7 Meta compliant, web_search grounded. |
| **Helpers** | `draftHomeProgram` (shorthand → steps), `analyzeStepVideo` (video → observations + timestamps), `draftTherapistFeedback` (S/O/A/P draft), SOAP `client_summary` (first view generates, later views `<15ms` cached). | Reads the plain-English family summary (`SoapSummaryCard`, `See Summary`), per-date `View feedback` (`?date=&submissionId=`) even while program is ongoing. |

Rule: the 4 program agents produce a **draft** — nothing reaches the client until therapist taps **Approve / Publish**. Guide is conversational but **never silently writes to chart**.

## Together

Shared program → video → review loop: therapist assigns, client submits, therapist publishes feedback. Plus messaging with `@routine` mentions, notification bell, published highlights strip on the client dashboard, per-client Care Guide, and Aruga Guide with `Send to clinician` verification.

---

## Meta models used

| Model | Where Aruga uses it |
|---|---|
| **Muse Spark 1.3 / 1.3-contributor** | Activity drafts, biomech planner, goal verdicts, highlights, SOAP + summaries |
| **Muse Spark 1.2-contributor** | Chat model option in Aruga Guide |
| **Muse Wonder 1.0** | Chat model option / complex-reasoning escalation |
| **Muse Image 1.0** | Printable line-art worksheets (toggleable) |
| **SAM 3.1** | Video segmentation — tracks 2–8 body concepts per clip |
| **Muse Spark Open 1026** | Coding assistant (scaffolding, migrations, tests — human-reviewed) |
| SAM 3D Body (open weights, via Modal) | 3D joint angles from SAM boxes — the numbers behind the biomech agent |

Full agent doc: [`docs/AGENTS_GUIDE.md`](docs/AGENTS_GUIDE.md)

---

## The 5 agents (1 line each)

| Agent | Who | What it drafts | Result means |
|---|---|---|---|
| **Activity** | Therapist | Worksheet per step (instructions + line art) | Attach to step, or Edit / Regenerate / Reject |
| **Biomechanic** | Both (playground) · Therapist (clinical review) | ROM + compensation from video | `Good` = on target · `Watch` = cue it · `Needs support` = re-grade (see Modal section) |
| **Goal Tracking** | Therapist (client sees published) | STG/LTG verdict `on_track / at_risk / behind / achieved / gap` | Insert suggestion into Plan, or Publish |
| **Highlights** | Therapist publishes · Client views | Best 7 data points of the month | Publish strip to client dashboard |
| **Aruga Guide** | Both | Everyday-words answers + References | Client taps `Send to clinician` to verify |

## More AI workflows

Smaller helpers behind the main screens: shorthand → program steps (`draftHomeProgram`), video → observable actions + timestamps (`analyzeStepVideo`), notes → S/O/A/P draft (`draftTherapistFeedback`), and plain-English family summaries with DB cache (first view generates, later views return in <15ms for free).

---

## Run it

```bash
npm install
cp .env.example .env.local   # add MODEL_API_KEY
npm run dev                  # http://localhost:3000
```

```bash
npx tsc --noEmit && npm run build && npm test  # 93 tests
```

---

## Modal solution — SAM 3D Body backend (optional)

**Why Modal:** SAM 3D Body is a 1.69 GB PyTorch model (ViT-H + MHR head, `ffmpeg`/`opencv` stack). It can't run on Vercel (10s limit, no GPU, no volume) or in the browser. Modal gives us a CPU container (`cpu=2.0`, `timeout=300`) with a persistent volume for checkpoints and a public `/infer` endpoint. Cost ~$0.001–0.002/clip. Without it the app still runs; biomech returns `503 MODAL_NOT_CONFIGURED`.

**How to deploy it:**

```bash
pip install modal && modal token new
modal volume put sam3db-ckpts /path/to/model.ckpt /sam-3d-body-vith/model.ckpt
modal volume put sam3db-ckpts /path/to/mhr_model.pt /sam-3d-body-vith/assets/mhr_model.pt
modal deploy modal/app.py   # copy the https://...modal.run URL
```

```env
MODAL_MHR_URL=https://<workspace>--aruga-mhr-infer.modal.run
```

**How the process works:**

1. **Decide** — Spark reads the activity + age + therapist note, picks 2–8 things to track from a fixed list of 16 (`shoulder, elbow, wrist, hand, trunk, neck…`).
2. **Segment** — SAM 3.1 follows those concepts through the video (~45 frames). One pass, ~$0.009.
3. **Measure (Modal)** — Modal downloads frames via signed URL, crops by SAM box (skips ViTDet), runs SAM 3D Body + One-Euro smoothing → shoulder/elbow/trunk/neck/wrist angles, finger aperture (mm), balance (CoM/BoS), plus flags.
4. **Rate** — Next.js compares each number to the target for *that* activity → `Good / Watch / Needs support` + adherence + trend. One Modal call per clip; switching views reuses the same result.

**How to read it:** `Good (teal)` = inside target (e.g. trunk ≤8°) → maintain. `Watch (amber)` = close but off (trunk 8–14°) → cue technique. `Needs support (red)` = clearly off (trunk >14°) → re-prescribe. Adherence ≥80/60% = Good/Watch, else Needs support. Flags (`forward head >25°`, `shoulder hike`, `high sway`) bump risk to `moderate_fall`. One phone camera: ±2–3° big joints, ±12° small hand — bad framing suppresses instead of guessing.

**Try it:** `Tools → Biomechanic Agent` (`/tools/biomech`) or submission → `Analyze biomechanics (Agent)` → ROM cards + overlay. Full steps: [`modal/DEPLOYMENT_GUIDE.md`](modal/DEPLOYMENT_GUIDE.md)

**Reading Modal logs (all of this is normal startup noise, not errors):**
- `Momentum is not enabled` / `No Flash Attention` / `timm ... deprecated` — library chatter on import. Ignore.
- `model and loaded state dict do not match` + `missing keys ...` — the checkpoint ships without optional heads (face-expression model, hand pose correctives, character mesh/texture extras). The loader skips them and runs on the body-pose weights. Caveat: fine finger articulation is approximated, not fully modeled — trust wrist-ROM-level insights, don't over-claim finger-joint precision.
- `No human detector is used` — intentional: we bypass ViTDet and feed it SAM boxes directly (that's the ~10× per-frame saving).
- `Mask-condition inference is not supported` — it runs in box-conditioned mode, which is what we send. Fine.
- `No FOV estimator ... default FOV` — focal length falls back to a default. Affects absolute depth scale slightly; joint *angles* (what the insights use) are essentially unaffected.
- `Please make sure the input image is in RGB format` — informational; frames are converted BGR→RGB before inference.

What matters is what comes *after* those lines: a completed execution with duration (first run after deploy includes ~60–120s model load; allow ~2 min, warm runs are much faster) vs. an actual `timed out`/`internal error`, which means per-request inference was too slow — trim to a ≤15s clip and re-run.

> **Note:** 30s clips on Modal CPU (2 cores) take ~90–130s. We sample 8 frames spaced across the clip — use ≤15s clips and, on a cold start, just wait for the first run (retries are warm and much faster). Check Modal app logs for `processingMs`.

---

## Supabase (optional — app runs without it)

Supabase adds login, database, and file storage. Without it, Aruga still runs in demo mode (mock patients, local flows, AI via Meta API still works).

- **Without Supabase:** browse `/tools/biomech`, `/activity-agent-playground`, `/sam-test`. No login, no saving.
- **With Supabase:** add these to `.env.local` for full therapist/client accounts + saving programs, videos, and reviews:
  ```env
  NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your-publishable-key
  SUPABASE_SECRET_KEY=your-supabase-secret-key
  ```
- **Setup (one time):** run `supabase/all_in_one_setup.sql` in Supabase SQL Editor, then verify with `scripts/verify-rls.sql`.

---

## Stack

Next.js 16 · React 19 · Tailwind v4 · Zod · `@meta-sam/parser` · Recharts · Vitest (93) · Supabase (optional, see above) · Modal (optional GPU)

## Docs

- [Agents Guide](docs/AGENTS_GUIDE.md) · [Meta Integration](docs/META_INTEGRATION.md) · [Demo](docs/DEMO.md) · [Evaluation](docs/EVALUATION.md)
- [Audits](audit/) · [Pitch](docs/PITCH_PRESENTATION.md)
