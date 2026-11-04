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

<p align="center">
  <a href="#about-aruga">About</a> ·
  <a href="#what-it-does">What it does</a> ·
  <a href="#who-uses-it">Who uses it</a> ·
  <a href="#the-5-agents-1-line-each">Agents</a> ·
  <a href="#modal-solution--sam-3d-body-backend-required-for-biomechanics">Biomech backend</a> ·
  <a href="#describe-your-use-of-meta-products">Meta products</a> ·
  <a href="#why-are-metas-models-important-to-your-solution">Why Meta</a> ·
  <a href="#run-it">Run it</a> ·
  <a href="docs/AGENTS_GUIDE.md">Agents guide</a>
</p>

> ⚠️ **Important:** Aruga does not replace therapy — it cannot diagnose, treat, or give medical advice. It only measures movement, drafts materials, and organizes the home program; a licensed therapist reviews and approves everything.

---

## About Aruga

**Aruga** (Filipino: *to take care of, to nurture*) is a **clinician-directed home-program companion** for PT, OT, and SLP that makes the home half of rehabilitation **visible, measurable, and personal** — bringing the clinic's eyes into real life, where recovery actually happens. It is **asynchronous by design**: prescribe, practice, measure, validate, feedback, and family story — all store-and-forward, with no appointments, no live video, and no wearables.

The name is the idea. In Filipino, *aruga* is what a caregiver does — staying close, guiding the hands, watching the small reps no one else sees. That's the gap Aruga fills: Clinic sessions help, but gains fade unless they survive the kitchen, the workplace, the playground — home is where life happens, so that's where therapy has to work. Yet most practice happens alone, from memory or a handout, with progress reported by chat. **Unobserved practice silently fails 50–65% of the time**<sup>[1](#studies-cited)</sup> — not for lack of effort, but **invisibility**.

The loop is simple. A therapist writes the home program in shorthand — Aruga turns it into clear, ordered steps, with an **optional worksheet illustrated for that one patient** (big print for grandma, playful for kids, or just the steps alone). The client practices and records a short video per step — that video becomes **evidence**. **SAM 3.1 segments the movement**, and a **SAM 3D Body stage on Modal computes joint angles, ROM, and compensation flags**, forming a per-patient **movement twin** — kinematic, never diagnostic. Every submission updates the twin; every judgment is read from it.

**Four bounded agents do the prep work** — Activity drafts steps and worksheets, Biomechanic rates movement **Good / Watch / Needs support**, Goal Tracking re-validates every goal after every session, Highlights curates the month's best seven — **each produces only a draft**. **Nothing reaches a patient until the therapist taps Approve or Publish.** Aruga never treats, diagnoses, or advises; it exists to **help therapists give their best care**, where clients actually live.

---

## Describe your use of Meta products

Every model call runs through the Meta Model API (`https://api.meta.ai/v1`); open weights run on Modal and Baseten.

- **Muse Spark 1.3** — the reasoning core of all five agents: activity drafts, biomech concept planning, 7-signal goal verdicts, best-7 highlights, SOAP drafts and family summaries. Strict `json_schema` outputs, `reasoning:medium/high`, prompt caching, and multi-turn `previous_response_id` chains.
- **Responses API + built-in tools** — one agentic loop per agent (`parallel_tool_calls`, cached prompts); server-side `web_search` grounds Aruga Guide answers with citations instead of hallucinated references.
- **Muse Spark 1.2-contributor + Muse Wonder 1.0** — selectable chat models in Aruga Guide; Wonder reserved for max-reasoning escalation.
- **Muse Image 1.0** — printable line-art worksheets rendered per patient from the agent's visual brief (toggleable per step).
- **SAM 3.1** — temporal segmentation of 2–8 body concepts per clip via streaming Responses + `@meta-sam/parser`; one pass regardless of concept count.
### Open weights via partners

Meta's open models do the heavy lifting through our two inference partners:

- **SAM 3D Body via Modal** — open-weights 3D pose model, served from a Modal volume + endpoint for joint angles and ROM. We run it on CPU (no GPU credits), and the same container scales straight onto GPU for ~10× speed.
- **Muse Spark Open 1026 via Baseten** — open-weights model run through Baseten inference for testing ideas, plus coding help and code auditing (human-reviewed).

## Why are Meta's models important to your solution?

Home rehab fails on two halves: nobody can *see* the practice, and nobody has time to *reason* over it. Meta is the stack that covers both halves behind one API — remove any piece and the loop breaks back into invisible practice.

- **Seeing: vision models turn a phone into a measurement device.** SAM 3.1 tracks the body through ordinary video — no wearables, no depth cameras, no clinic hardware — and SAM 3D Body open weights convert those tracks into joint angles and ROM. That matters because the literature is blunt: non-adherence reaches 50–65% in general musculoskeletal cohorts and 50–70% in low-back-pain cohorts<sup>[1](#studies-cited)</sup>; one Ethiopian outpatient cohort found just 35.3% adherent<sup>[2](#studies-cited)</sup>. And self-report diaries — the field's standard instrument — test as unreliable against objective measures, with only ~35% of patients highly adherent even under individualized programs<sup>[3](#studies-cited)</sup>. Video proof-of-work replaces the diary, and smartphone markerless measurement now validates at roughly ±4–6° joint-angle error<sup>[4](#studies-cited)</sup> — trend-grade, honest about its bands, therapist-reviewed before use. Without Meta's vision stack, Aruga would be another exercise library; with it, practice becomes evidence.
- **Reasoning: language models turn evidence into drafts a clinician can approve.** Every agent output is a draft pending approval — worksheets, verdicts, highlights, summaries. That pattern only works if the model reliably emits valid, evidence-cited, structured output. Spark's strict JSON schemas, reasoning-effort dial, and prompt caching are what make hundreds of reviewable drafts per clinic practical instead of a formatting lottery.
- **Grounding: answers carry citations, not vibes.** Aruga Guide's server-side web search returns references with every answer, and the *Send to clinician* gate keeps a human in the loop — the difference between a health chatbot and a clinical companion.
- **Turnaround: the whole loop resolves in minutes.** SAM segmentation completes in one streaming pass, open-weights 3D inference resolves a 30s clip in ~90–130s on a small Modal CPU (warm runs much faster), and cached Spark reasoning drafts instantly — measurement and judgment both land inside a therapist's async review window. Slow measurement is what kept tele-assessment in labs; this stack puts it on a mid-range phone.
- **Fit: async, phone-first, no new hardware.** The evidence converges on asynchronous, low-bandwidth care — a single submitted video, reviewed later. Meta's models accept exactly that input: no live streaming, no sensors, no appointments. The models fit the care model instead of forcing care to fit the tech.

Each product carries one wall: SAM sees, Spark reasons, Image illustrates, open weights do the heavy 3D lifting.

### Studies cited

1. Physiopedia. (n.d.). *Adherence to home exercise programs*. https://www.physio-pedia.com/Adherence_to_Home_Exercise_Programs
2. Yalew, E. S., Melese, A. Z., Guadie, Y. G., & Gashaw, M. (2022). Adherence to home-based exercise program and its predictors among patients treated in physiotherapy outpatient department in Amhara Region hospitals in Ethiopia: A prospective cross-sectional study. *Patient Preference and Adherence*, *16*, 561–572.
3. Argent, R., Daly, A., & Caulfield, B. (2018). Patient involvement with home-based exercise programs: Can connected health interventions influence adherence? *JMIR mHealth and uHealth*, *6*(3), e47. https://doi.org/10.2196/mhealth.8518
4. Validation of OpenCap: A low-cost markerless motion capture system for lower-extremity kinematics during return-to-sport tasks. (2024). *Journal of Biomechanics*. Two smartphones vs. 10-camera Vicon: grand mean error 3.85° MAE / 4.34° RMSE; knee-osteoarthritis patient validation ≈ 6° RMSE. https://www.sciencedirect.com/science/article/abs/pii/S0021929024002781

---

## What it does

1. **Therapist prescribes in seconds** — types "Cup lift, hold 3s" and gets back a full step plus a worksheet drawn for that exact patient: big print for grandma, playful for kids.
2. **Client practices at home, on camera** — colors the sheet, records each step on any phone, adds a quick note ("wrist felt tight on rep 4").
3. **AI turns video into answers** — joint angles, ROM, and flags; goals re-checked against evidence; the month distilled into 7 highlights; questions answered in plain words with sources.

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

## The 5 agents (1 line each)

| Agent | Who | What it drafts | Result means |
|---|---|---|---|
| **Activity** | Therapist | Worksheet per step (instructions + line art) | Attach to step, or Edit / Regenerate / Reject |
| **Biomechanic** | Both (playground) · Therapist (clinical review) | ROM + compensation from video | `Good` = on target · `Watch` = cue it · `Needs support` = re-grade (see Modal section) |
| **Goal Tracking** | Therapist (client sees published) | STG/LTG verdict `on_track / at_risk / behind / achieved / gap` | Insert suggestion into Plan, or Publish |
| **Highlights** | Therapist publishes · Client views | Best 7 data points of the month | Publish strip to client dashboard |
| **Aruga Guide** | Both | Everyday-words answers + References | Client taps `Send to clinician` to verify |

## More AI workflows

Behind the five agents, smaller helpers do the repetitive drafting inside the main screens — each one turns rough input into a reviewable draft, never a final answer:

- **Program drafting (`draftHomeProgram`)** — the therapist types shorthand ("cup lift 5x, hold 3s, both hands") → Spark returns ordered steps with reps, hold times, and precautions, flagging anything ambiguous instead of guessing. Saves structuring every program from scratch.
- **Video observation (`analyzeStepVideo`)** — a submitted clip → timestamped observable actions ("cylindrical grasp, lift 3 in at 0:04") plus the single clearest object concept to hand to SAM 3.1. Gives the therapist a scannable timeline instead of rewatching the whole video.
- **Feedback drafting (`draftTherapistFeedback`)** — rough therapist notes plus confirmed observations → a structured Subjective / Objective / Assessment / Plan draft. The therapist edits, confirms, and publishes — the AI never writes directly to the record.
- **Plain-English family summaries (`client_summary`)** — clinical SOAP notes → a warm 2–3 sentence takeaway at family reading level. The first view generates it once and caches it in Postgres; every later view returns in <15ms with no regeneration needed. The family gets the same truth, in their own words, instantly.

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

## Modal solution — SAM 3D Body backend (required for biomechanics)

**Why Modal:** SAM 3D Body is a 1.69 GB PyTorch model (ViT-H + MHR head, `ffmpeg`/`opencv` stack). It can't run on Vercel (10s limit, no GPU, no volume) or in the browser. Modal gives us a CPU container (`cpu=2.0`, `timeout=300`) with a persistent volume for checkpoints and a public `/infer` endpoint. A 30s clip resolves in ~90–130s (warm runs much faster). We run on CPU because we did not receive Modal credits — which doubles as a scalability proof: if the full pipeline resolves on two shared CPU cores, it only gets faster on GPU. The Biomechanic agent requires it — without `MODAL_MHR_URL` set, analysis calls fail with `503 MODAL_NOT_CONFIGURED`.

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
2. **Segment** — SAM 3.1 follows those concepts through the video (~45 frames) in a single pass.
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

> **Note:** We sample 8 frames spaced across the clip — use ≤15s clips and, on a cold start, just wait for the first run (retries are warm and much faster). Check Modal app logs for `processingMs`.

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

Next.js 16 · React 19 · Tailwind v4 · Zod · `@meta-sam/parser` · Recharts · Vitest (93) · Supabase (optional, see above) · Modal (SAM 3D Body backend)

## Docs

- [Agents Guide](docs/AGENTS_GUIDE.md) · [Meta Integration](docs/META_INTEGRATION.md) · [Demo](docs/DEMO.md) · [Evaluation](docs/EVALUATION.md)
- [Audits](audit/) · [Pitch](docs/PITCH_PRESENTATION.md)
