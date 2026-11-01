# Aruga (Clinician-Directed Home-Program Companion)

> **Aruga** is a modern, clinician-directed home-program companion for speech-language pathologists (SLP), occupational therapists (OT), and physical therapists (PT). Clinicians assign structured home routines across **pediatric**, **adolescent**, **adult**, and **geriatrics (55+)** populations; clients (and caregivers) record short tabletop activity videos; and Meta AI assists with program drafting, video segmentation, multi-box SOAP documentation, and plain-English client summaries under licensed human supervision.

---

## Key Highlights

- **Branding & Aesthetic**: Refined cursive *Playwrite IT Trad* wordmark paired with a medical-grade aesthetic—charcoal/black background, dark zinc cards, off-white text, and restrained teal accents.
- **Dark Clinical Theme (Locked)**: Single dark theme enforced at layout level — `ThemeProvider` dark-only, `ThemeToggle` removed from all navs/login/landing for visual consistency.
- **Mobile-Responsive Therapist Experience**: Hamburger slide drawer (`w-[300px] max-w-[85vw]`) on `md:hidden`, stacked headers, horizontally-scrollable filter pills with `scrollbar-none`/`snap-x`, stacked client/program cards (`p-3 sm:p-5`), grid footers, and `h-10` touch targets — all therapist routes (`dashboard`, `clients`, `clients/[id]`, `clients/[id]/programs/new`, `activities`, `profile`, `submissions/[id]`, `messages`) verified at 375px with zero horizontal overflow (`globals.css:scrollbar-none`).
- **Multi-Population Care (Pediatric, Adolescent, Adult, Geriatrics 55+)**:
  - **Pediatric Care (<12y)**: Play-based fine motor development with dedicated **Caregiver Co-Runner** tracking.
  - **Adolescent Care (12–17y)**: School ergonomics, writing stamina, executive function, and bilateral coordination.
  - **Adult Care (18–54y)**: Post-stroke neurorehabilitation, upper extremity dexterity, and workplace ergonomics.
  - **Geriatrics Care (55+y)**: Fall prevention, joint mobility with osteoarthritis, hip precautions, tremor damping, and presbyphagia.
- **Clinical Multi-Box SOAP Notes Architecture**:
  - **Session Clinical Documentation (SOAP Notes)**: Dedicated tab on each client profile for creating/viewing/editing/deleting multiple session notes; supports optional `session_recording_url` + `assessment_links` (JSONB) parity with submission reviews (`supabase/migrations/20261031000008` + `20261031000012`).
- **Activity Studio (Muse Spark + Muse Image)**: 20 system templates (5 per age band: pedia/adolescent/adult/geriatric) browsing/generation; per-step therapist attachment via `StepActivityControl` → `ActivityGeneratorModal` (template pick + **custom prompt without template** via `CustomActivityCreatorModal`) + `Generate image with Muse Image` checklist (`generateImage` flag — when off, text-only). Client completion via interactive canvas (`drawing_data_url` + `drawing_strokes` JSONB, 12 crayons, eraser `destination-out`) or photo fallback; print/PDF. Persisted to `generated_activities`/`activity_completions` (5MB cap, `uq_activity_completion_step_sub`).
  - **Home Program Feedback**: Replaced single feedback boxes with **4 distinct SOAP textareas**:
    - **Subjective (S)**: Patient quotes, fatigue, comfort, pain score.
    - **Objective (O)**: Quantified reps, ranges of motion, grip strength metrics.
    - **Assessment (A)**: Clinical analysis, neuromuscular progress, compensatory habits.
    - **Plan (P)**: Routine adjustments, frequency changes, exercise progression.
  - **Plain-English Client Summary**: 5th box synthesizing clinical notes into a warm, accessible 2–3 sentence message for patients and family caregivers.
- **On-Demand AI Credit Protection & Database Caching**:
  - Summaries are loaded on-demand via a **"See Summary"** button—preventing automatic AI credit consumption upon viewing pages.
  - **Zero-Credit Database Cache**: If a summary is already generated, it is retrieved directly from PostgreSQL in `<15 ms` with **zero AI inference credits consumed**.
  - **One-Time Synthesis**: If empty, clicking "See Summary" generates the plain-English takeaway with Meta Muse Spark and **immediately caches it to the database**, so all future client views are completely free.
- **Two-Way Client-Therapist Handshake**:
  - Therapists can invite clients by email address or link existing client accounts.
  - Clients can search for clinicians and send connection requests.
  - Full handshake lifecycle: `pending`, `accepted`, `declined` tracked in database.
- **Care Transfer Service**:
  - Therapists can transfer an entire patient caseload, exercise history, and videos to a colleague clinician.
  - Preserves clinical audit trails with `previous_therapist_id` and mandatory `handover_notes`.
- **Direct Cloud Storage Uploads**:
  - High-res client recordings + photos upload directly to private cloud storage (`program-videos` bucket, now `image/jpeg|png|webp|heic` + video MIME types) using signed URLs, bypassing serverless body limits; `submit_program_steps` RPC accepts `video_path` (generic media path) OR `skipped+reason` (`supabase/migrations/20261031000013`).
  - Practice schedule: up to 10 `scheduled_dates` per `home_programs` (JSONB) → one `submissions.scheduled_date` per date; strict program→submission unique removed in favor of `idx_submissions_prog_date` (`supabase/migrations/20261031000009`).
  - Activity assets in private `activity-assets` bucket (20MB, `png|jpeg|webp|svg+xml|pdf`, `06: SEED 20 ACTIVITY TEMPLATES` in `all_in_one_setup.sql`).
  - Enforces 100MB `program-videos` / 20MB `activity-assets` boundaries (all buckets `public=false`).
- **SAM 3.1 Clinical & Environmental Keyword Engines**:
  - **7 Validated Engines (700 Keywords Total)**:
    1. *Pediatric Care Engine* (100 keywords across OT, PT, SLP & OTPF-4)
    2. *Adolescent Care Engine* (100 keywords for school, motor planning & ADLs)
    3. *Adult Rehabilitation Engine* (100 keywords for neuro-rehab, stroke & ergonomics)
    4. *Geriatrics (55+) Engine* (100 keywords for mobility, fall prevention & daily independence)
    5. *Everyday Objects at Home Engine* (cups, utensils, keys, remote, toothbrush, etc.)
    6. *Everyday Objects at School Engine* (pencils, scissors, markers, notebook, glue, etc.)
    7. *Kitchen Items Engine* (spatula, mugs, jars, bowls, tongs, measuring spoons, etc.)
  - **SAM 3.1 Test Workspace (`/sam-test`)**: Sleek sticky header + stepper, grouped lifespan/environment engine cards, searchable chips, video+payload two-column, results/history cards; isolate `#1` black background with hole overlay + custom Play/Replay/scrub/Snapshot controls; 30 objects, Download placeholder.
- **Multi-Client Messaging & Direct Routine Mentions**:
  - Therapists can manage messages across their caseload with a **Client Selector Dropdown**.
  - Supports message deletion (`is_deleted` flag).
  - Routine mention chips (`@routine`) link directly to specific assigned programs.
- **In-App Notifications**:
  - Real-time notification bell dropdown tracking published reviews, routine assignments, messages, and care transfers.
- **Strict Zero Dummy Data for Clinicians**:
  - Genuine empty states for newly registered therapist caseloads. Synthetic demo accounts are strictly isolated.
- **Automated Credential Privacy Lifecycle**:
  - Temporary passwords generated during onboarding are permanently wiped from clinician visibility (`temporary_password = NULL`) the moment the client logs in.
- **Therapist-Created Client Auto-Link on First Login**:
  - When a therapist creates a client (email + temp password), the client row is `invitation_status = 'pending'`; on first `signIn` the API (`src/app/api/auth/clear-temp-credentials/route.ts:40`) auto-flips to `accepted`, sets `first_login_at`/`client_user_id`, and clears the temp credential — enforced by DB trigger `supabase/RUN_ONCE_AUTO_LINK_ON_FIRST_LOGIN.sql:1`. No manual accept required.
- **Live Session SOAP Note UX**: Create flow now shows **"Create SOAP Note"** on the modal CTA (`src/app/therapist/clients/[id]/page.tsx:2350`, edit still "Save SOAP Note Changes").

---

## Feature Progress & Implementation Checklist

### Core Features (Completed)
- [x] **Locked Dark Clinical Theme + Mobile-Responsive Therapist UI**: Dark-only `ThemeProvider` + hamburger drawer / scrollable pills / stacked cards at 375px.
- [x] **Branding**: Cursive *Playwrite IT Trad* typography; removed generic hand logo icon.
- [x] **Multi-Demographic Care**: Adult, Adolescent, Pediatric, and Geriatrics (55+) care with Caregiver co-runner fields (migrated `old_people` → `geriatric`, migration `20261031000010`).
- [x] **SAM 3.1 Clinical Lifespan Engines**: 4 demographic engines + 3 environmental testing engines (700 keywords total).
- [x] **SAM 3.1 Benchmarking & History**: Processing latency measurement, session storage, and reload capability.
- [x] **Clinical Multi-Box SOAP Notes**: 4 distinct textareas (S, O, A, P) for `soap_notes` + `submission_reviews` (copy label: **Session Clinical Documentation**).
- [x] **Session Recordings & Assessment Links**: Optional `session_recording_url` + `assessment_links` JSONB on both `soap_notes` and `submission_reviews` (`00008` + `00012`).
- [x] **Scheduled Practice Dates**: Up to 10 `scheduled_dates` (JSONB) per `home_programs` → `submissions.scheduled_date` with `idx_submissions_prog_date`; submission edit window preserved (`00009`).
- [x] **Photo-or-Video Step Submissions**: `step_submissions.video_path` is generic media path + `media_meta` JSONB (`mime/sizeBytes/durationSeconds/width/height/mediaKind`); RPC `submit_program_steps` validates media-or-skip (`00013`).
- [x] **Activity Studio (Muse Spark + Muse Image Worksheets)**: 20 system templates (`05` + `06` in `all_in_one_setup.sql`), `generated_activities` + `program_steps.generated_activity_id` + `activity_completions` (canvas `drawing_data_url`/`drawing_strokes`/photo fallback, 5MB, `uq_activity_completion_step_sub`), bucket `activity-assets` (20MB), template-or-custom-prompt creation with `generateImage` flag.
- [x] **Geriatric Category Migration**: `client_category` now `pedia|adolescent|adult|geriatric|old_people` with `old_people→geriatric` backfill (`00010` migrated to `all_in_one_setup.sql`).
- [x] **Private Storage Buckets (3)**: `program-videos` (100MB), `chat-attachments` (50MB), `activity-assets` (20MB) — all `public=false`, `authenticated` storage-object policies.
- [x] **HIPAA Storage Hardening**: `00011` enforces `program-videos public=false` + `TO authenticated` (Finding 3), `audit_events` immutability via `prevent_audit_tampering()`, audit indexes.
- [x] **Plain-English Client Summary**: Family-friendly takeaways positioned prominently below clinical notes.
- [x] **On-Demand AI Credit Protection**: Zero-credit database caching layer (`<15ms` cache hit) with manual "See Summary" expansion.
- [x] **Two-Way Handshake Invitations**: Bidirectional email invitations and linking requests between clinicians and clients.
- [x] **Care Transfer Service**: Seamless patient caseload transfer between clinicians with handover notes.
- [x] **Multi-Client Messaging**: Caseload selector dropdown, routine `@mention` chips, and message deletion.
- [x] **In-App Notifications Dropdown**: Real-time event notifications for assignments, reviews, and transfers.
- [x] **Full Relational CRUD Architecture**: 100% relational coverage across patients, programs, steps, submissions, reviews, SOAP notes, messages, and activities.
- [x] **Zero Dummy Data for Clinicians**: Clean empty states; synthetic demo data restricted strictly to demo bypass accounts.
- [x] **Credential Privacy Lifecycle**: Temporary passwords automatically purged from clinician view upon first client login (badge copy: `Active` when cleared).
- [x] **Therapist-Created Client Auto-Link on First Login**: Pending therapist-invited clients auto-accept on first `signIn` via `src/app/api/auth/clear-temp-credentials/route.ts:40` + DB trigger `supabase/RUN_ONCE_AUTO_LINK_ON_FIRST_LOGIN.sql:1` (sets `invitation_status='accepted'` + `first_login_at`, wipes temp password).
- [x] **Session Documentation UX Polish**: Tab/heading/modal copy unified to **Session Clinical Documentation** (copy-only, no behavior change).
- [x] **Aruga Guide (`/aruga-guide`, permanent redirect from `/ask-ot`)**: Multi-chat clinical assistant with general rehab PT/OT/Speech guidance, `CLIENT CONTEXT` from profile+program, persistent "References + Send to clinician to verify".
- [x] **Idempotent Database — `all_in_one_setup.sql` as Source of Truth**: Canonical consolidated script (schema + RLS + triggers + buckets + seeds + activity templates + template seeds); incremental `supabase/migrations/20261031*.sql` retained for existing DBs.
- [x] **Privacy Hardening (C1–C3/H1–H4)**: RLS/API owner gates, random storage paths, short-lived signed URLs, EXIF strip — see [Security & Privacy Hardening](#security--privacy-hardening-c1c3--h1h4--nov-2026) and `supabase/RUN_ONCE_PRIVACY_FIX*.sql`.
- [x] **Encryption Roadmap**: Column-level `pgsodium` + Vault and client-side E2E envelope planned in [`docs/FUTURE_PLANS.md`](docs/FUTURE_PLANS.md).

### Roadmap & Next Milestones
- [ ] **Realtime Push Subscriptions**: Live WebSocket push updates for messages and review publications without page reload.
- [ ] **Automated SMTP Email Dispatch (Resend / SendGrid)**: Deliver invitations directly to client inboxes.
- [ ] **Gamified Pediatric Engagement**: Visual milestones, badges, and streaks for pediatric daily practice.
- [ ] **RTM Billing & CPT Documentation Generator**: Automated logs for Remote Therapeutic Monitoring (CPT 98975, 98977, 98980).
- [ ] **Progressive Web App (PWA)**: Offline exercise caching and mobile camera recording.

---

## AI Compute Cost Evaluation & User Allocations (60-Min @ 30 FPS Model)

A comprehensive financial model was evaluated for Meta AI compute usage (Muse Spark 1.3 LLM & SAM 3.1 Video Engine) based on **30 FPS frame analysis** and a **60-minute monthly video allocation per active user** (108,000 frames/month).

### 1. Unit Call Costs & Processing Metrics
- **Frame Rate**: `30 FPS` (`1,800 frames / minute`)
- **Monthly Allocation**: `60 minutes of video / user` (`108,000 frames total`)
- **SAM 3.1 Video Engine**:
  - *Optimized (Temporal Keyframe Propagation)*: **$0.090 / video min** (**$5.40 / 60 mins**)
  - *Unoptimized (Brute-force 30 FPS)*: **$0.00015 / frame** ($16.20 / 108k frames)
- **Meta Muse Spark 1.3**:
  - *Automated Step Review Drafting*: **$0.0016 / draft** (120 submissions = $0.192)
  - *Ask OT Assistant*: **$0.0015 / turn** (60 turns/mo = $0.090)
  - *Clinician Review Syntheses*: **$0.0025 / report** (8 reports/mo = $0.020)
  - *Plain-English Family Summary (Cached)*: **$0.0012 / initial generation** (subsequent client views: **$0.00 via DB Cache**)

### 2. Monthly Cost per Active Patient
For a full intensive 60-minute video rehabilitation workload, total direct AI compute is **~$5.71 / active patient / month** (further reduced on repeat summary views due to PostgreSQL caching).

### 3. Recommended Per-User Allocation Tiers
| Tier | Monthly Video Time (30 FPS) | Total Frames | Video Submissions | Ask OT Queries | Direct AI Cost (Optimized) | Suggested Monthly Price | Gross Margin |
|---|---|---|---|---|---|---|---|
| **Starter / Clinic Trial** | 15 mins | 27,000 frames | 30 submissions | 20 turns | **$1.46** | *Free (14-day trial)* | N/A |
| **Standard Rehabilitation** | 35 mins | 63,000 frames | 70 submissions | 45 turns | **$3.36** | **$29 / patient / mo** | **88.4%** |
| **Intensive Care (Full Quota)** | **60 mins** | **108,000 frames** | **120 submissions** | **60 turns** | **$5.71** | **$49 / patient / mo** | **88.3%** |
| **Clinic Pro Bundle** | 900 mins (15 patients) | 1,620,000 frames | 1,800 submissions | 900 turns | **$81.30** | **$499 / clinic / mo** | **83.7%** |

---

## Tech Stack

- **Framework**: Next.js 16 (App Router) with React 19 and TypeScript (Strict Mode)
- **Styling**: Tailwind CSS v4 & custom clinical theme tokens
- **Backend & Auth**: Database Authentication, PostgreSQL, Private Cloud Storage, Row-Level Security (RLS), and first-login auto-link trigger (`supabase/RUN_ONCE_AUTO_LINK_ON_FIRST_LOGIN.sql`)
- **AI Models**: Meta Muse Spark 1.3 & SAM 3.1 (`https://api.meta.ai/v1`)
- **Parsers & Validation**: `@meta-sam/parser`, Zod, React Hook Form
- **Icons**: Lucide Icons
- **Testing**: Vitest (**`93/93 tests passing`** across 5 suites), Playwright
- **Coding Assistant**: [Muse Spark Open 1026](https://www.llama.com/docs/model-cards-and-prompt-formats/muse-spark/) used to assist in coding tasks — scaffolding components, writing migrations, and generating tests under human review

---

## How We Used Muse Models & SAM

Aruga is built on Meta AI via `https://api.meta.ai/v1` (see [`docs/META_INTEGRATION.md`](docs/META_INTEGRATION.md)). All AI outputs are treated as tentative drafts under licensed human supervision — never shown to patients until a clinician reviews/publishes.

### Muse Spark (Reasoning & Clinical Text)

We use **Muse Spark** family for structured, safety-bounded clinical reasoning (`server-only` in `src/lib/meta/spark.ts`, `prompts.ts`, `schemas.ts`, `client.ts`):

- **Muse Spark 1.3 Contributor (`muse-spark-1.3-contributor`)** — primary model for:
  - **Program Drafting (`draftHomeProgram`)**: converts informal therapist shorthand into sequential steps with reps/duration; flags ambiguities in `warnings` array, never hallucinates diagnoses.
  - **Video Observation (`analyzeStepVideo`)**: emits observable actions (e.g., “cylindrical grasp, lifting 3in”) with timestamps and a single object concept for SAM.
  - **Multi-Box SOAP Drafting (`draftTherapistFeedback`)**: synthesizes only confirmed observations into Subjective / Objective / Assessment / Plan boxes.
  - **Plain-English Family Summary (`/api/ai/soap-summary`)**: 6th-grade 2–3 sentence takeaway for patients/caregivers; checks `soap_notes.client_summary` / `submission_reviews.client_summary` first → returns in `<15ms` with zero credits if cached, otherwise synthesizes once and write-backs to Postgres (HIPAA Safe Harbor de-identified via `src/lib/hipaa/de-identify.ts` before egress).

- **Muse Spark 1.2 Contributor (`muse-spark-1.2-contributor`)** — default for **Ask OT Assistant** (`/ask-ot`, `src/app/api/ot-chat/*`, `src/lib/meta/models.ts`): multi-turn clinical Q&A with conversation persistence, model selector supporting Spark 1.2 / 1.3 / Wonder.

- **Muse Wonder 1.0 (`muse-wonder-1.0`)** — available as alternative in `OT_CHAT_MODELS` for comparative reasoning quality / latency in Ask OT chat (registered in `src/lib/meta/models.ts`).

Operational modes: `AI_MODE=mock|live|off` (mock uses validated adult/pediatric/geriatric fixtures; live validates host `api.meta.ai`; off disables AI with clear clinician notice). Config via `MODEL_API_KEY` + `META_API_BASE_URL`.

### SAM 3.1 (Segmentation & Tracking)

We use **SAM 3.1** streaming video segmentation (`src/lib/meta/sam.ts`, `@meta-sam/parser`) for kinematic tracking:

- **7 Validated Engines (700 keywords, `src/lib/meta/sam-engines/index.ts`)**: Pediatric / Adolescent / Adult / Geriatrics (55+) + Everyday Home / School / Kitchen Items — 100 keywords each, single-noun enforced (`INVALID_SAM_PROMPT`), case-insensitive dedup (bill once per concept), frame-memory cache, overlap suppression.
- **Streaming Protocol**: `POST https://api.meta.ai/v1/responses` with `stream:true` → `parseVideoStream()` → `recordsOfKind(..., "box"/"mask")` → `decodeMaskToSVGPath()` synchronized to playback in `SamOverlay.tsx`. Measured end-to-end via `/sam-test` workspace (latency ms, session history).
- **Cost Model**: Optimized temporal keyframe propagation (1 keyframe / 15 frames) = **$0.090/min** ($5.40 / 60 mins) vs brute-force $0.00015/frame; caching + dedup further reduce redundant calls.

### Muse Spark Open 1026 (Coding Assistant)

Beyond runtime AI, **Muse Spark Open 1026** (Meta, Oct 2026) was used as a coding assistant to accelerate development under human oversight: scaffolding Next.js App Router routes, authoring Supabase migrations (e.g., `20261031000008–00012`), hardening `video-recorder.tsx` and `session-timeout-provider.tsx`, and expanding Vitest suites to 93 tests. All generated code was reviewed, type-checked (`tsc --noEmit`), and build-verified (`next build`) before commit.

---

## Getting Started

### 1. Clone & Install Dependencies
```bash
git clone <repo-url>
cd aruga
npm install
```

### 2. Configure Environment Variables
Copy `.env.example` to `.env.local`:
```bash
cp .env.example .env.local
```

Required variables:
```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your-supabase-publishable-key
SUPABASE_SECRET_KEY=your-supabase-service-role-key
NEXT_PUBLIC_APP_URL=http://localhost:3000
MODEL_API_KEY=your-meta-model-api-key
META_API_BASE_URL=https://api.meta.ai/v1
AI_MODE=mock # 'live' | 'mock' | 'off'
APP_MODE=demo
MAX_UPLOAD_MB=25
MAX_VIDEO_SECONDS=30
```

> **Security Note**: Never expose or commit `.env.local` or service keys to version control.

### 3. Database Setup & Migrations
- **Fresh Setup (Recommended)**: Execute [`supabase/all_in_one_setup.sql`](supabase/all_in_one_setup.sql) directly in Supabase SQL Editor — **single source of truth** containing schema + RLS + triggers + RPCs + 3 private buckets + `audit_events` + `soap_notes` + activity tables (`activity_templates`/`generated_activities`/`activity_completions`/`program_steps.generated_activity_id`) + 20 activity template seeds. Then apply [`supabase/RUN_ONCE_PRIVACY_FIX.sql`](supabase/RUN_ONCE_PRIVACY_FIX.sql), [`supabase/RUN_ONCE_AUTO_LINK_ON_FIRST_LOGIN.sql`](supabase/RUN_ONCE_AUTO_LINK_ON_FIRST_LOGIN.sql) (auto-accepts therapist-created pending invites on first login), and (if upgrading legacy permissive policies) [`supabase/RUN_ONCE_PRIVACY_FIX_C3_DROP_OPEN_POLICIES.sql`](supabase/RUN_ONCE_PRIVACY_FIX_C3_DROP_OPEN_POLICIES.sql) — all idempotent. Verify with [`scripts/verify-rls.sql`](scripts/verify-rls.sql).
- **Incremental Migrations** (for already-initialized DBs) — run sequentially:
  1. `20261030000001_add_old_people_category.sql` — adds `'old_people'` category.
  2. `20261031000001_link_therapist_in_new_user_trigger.sql` — automatic client-therapist email linking on client signup.
  3. `20261031000002_two_way_handshake_invitations.sql` — two-way handshake (`invitation_status`, `invitation_initiated_by`).
  4. `20261031000003_care_transfer_service.sql` — care transfer (`previous_therapist_id`, `handover_notes`).
  5. `20261031000004_program_videos_storage.sql` — `program-videos` bucket.
  6. `20261031000005_pending_requests_and_profiles_email.sql` — profile email indexes.
  7. `20261031000006_soap_notes_and_program_feedback.sql` — `soap_notes` + `submission_reviews` SOAP fields.
  8. `20261031000007_ensure_therapist_created_user_is_client_type.sql` — therapist-created users strictly `role='client'`.
  9. `20261031000008_soap_recording_and_assessment_links.sql` — `soap_notes.session_recording_url` + `assessment_links` JSONB.
  10. `20261031000009_home_program_scheduled_dates_and_submission_edits.sql` — `home_programs.scheduled_dates` JSONB + `submissions.scheduled_date` + multi-date index.
  11. `20261031000010_update_geriatric_category.sql` — adds `'geriatric'` + backfills `old_people→geriatric`.
  12. `20261031000011_hipaa_security_safeguards.sql` — `program-videos public=false` + `TO authenticated` read, `prevent_audit_tampering()` immutability, audit indexes (**Finding 3** regression fixed in `00013`).
  13. `20261031000012_submission_reviews_soap_recording_and_assessments.sql` — `submission_reviews.session_recording_url` + `assessment_links`.
  14. `20261031000013_photo_upload_support.sql` — image MIME types, storage update/delete policies, `submit_program_steps` media-or-skip RPC, `video_path`/`media_meta` docs.

### 4. Run Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## Testing & Quality Assurance

Run the Vitest test suite:
```bash
npm test
```
Runs **93 unit and integration tests** across 5 suites:
- `tests/authorization.test.ts`: Role-based isolation, draft concealment, frozen protocol checks.
- `tests/supabase-crud.test.ts`: Complete CRUD operations for clients, home programs, step video uploads (Cloud Storage), therapist per-step feedback and overall reviews, real-time messaging, **Two-Way Handshake Confirmations**, **Care Transfer Service**, and **Live Session SOAP Notes**.
- `tests/sam-engine.test.ts`: SAM 3.1 concept handling, deduplication, caching, and multi-concept segmentation.
- `tests/sam-payloads.test.ts`: Validation of the 7 clinical & environmental 100-keyword engines.
- `tests/meta-ai.test.ts`: Muse Spark structured output, safety boundaries, and feedback generation.

Production build verification:
```bash
npx tsc --noEmit
npm run build
```

---

## Security & Privacy Hardening (C1–C3 / H1–H4 — Nov 2026)

> **Current posture:** TLS in-transit + Supabase AES-256 at-rest + strict RLS/API owner checks. No column-level or E2E ciphertext yet — tracked in [Future Encryption Roadmap](docs/FUTURE_PLANS.md). Full before/after with file:line proofs: [`docs/PRIVACY_HARDENING_LATEST.md`](docs/PRIVACY_HARDENING_LATEST.md) (detailed: `docs/PRIVACY_HARDENING_C1-H4_1101260315.md`).

**What was fixed (build `56/56`, tests `93/93`):**

| ID | Issue | Fix | Key files |
|---|---|---|---|
| **C1** | Cross-tenant writes via `patientId`/`creatorId` from body | `auth.uid()`-derived creator + `therapist_owns_patient(patient_id)` gate on every insert | `src/app/api/activities/generate/route.ts:42`, `src/app/api/therapist/soap-notes/route.ts:140`, `src/app/api/therapist/programs/route.ts:359`, `src/lib/supabase/owner.ts:1` |
| **C2** | 7-day predictable bearer URLs (`submissions/{id}/{step}_ts.mp4`) | Random `nanoid(12)` prefix + per-view `15m` (videos) / `60m` (chat) `createSignedUrl`; storage-path-only persisted | `src/app/api/client/submissions/upload/route.ts:105,158`, `src/app/api/messages/route.ts:308`, `src/app/api/client/submissions/route.ts:70` |
| **C3** | 42 permissive `USING (true)` RLS policies — direct `anon`-key exfiltration | Dropped permissive set, re-applied restrictive `supabase/01_schema.sql:322` baseline | `supabase/RUN_ONCE_PRIVACY_FIX_C3_DROP_OPEN_POLICIES.sql:1`, verified via `scripts/verify-rls.sql:1` |
| **H1** | Silent `DEMO_*` fallback bypass | Gated behind `isDemo` header, else `401` | `src/app/api/therapist/clients/route.ts:314`, `src/app/api/therapist/programs/route.ts:184` |
| **H2** | Invitation/oracle enumeration (`403` vs `404`) | Normalized to `404` | `src/app/api/therapist/clients/route.ts:39,835,930` |
| **H3** | Notification email over-disclosure | `maskEmail()` (`j***@domain`) + ownership check | `src/app/api/notifications/route.ts:6,152` |
| **H4** | EXIF GPS leak on uploads | `sharp.rotate().withMetadata({})` strip before `storage.upload` | `src/app/api/client/submissions/upload/route.ts:110`, `src/app/api/messages/route.ts:311` |

**Storage:** All buckets now `public=false` (no public read) — `program-videos`, `chat-attachments`, `activity-assets` — with `authenticated`-only `storage.objects` policies.

**Therapist → Client Auto-Link on First Login:** Therapist-created rows start `pending`; on client `signIn`, `src/app/api/auth/clear-temp-credentials/route.ts:40` (triggered from `src/lib/supabase/auth-context.tsx:193`) sets `invitation_status='accepted'`, `first_login_at=NOW()`, `client_user_id` self-heal, and `temporary_password=NULL`. DB trigger `supabase/RUN_ONCE_AUTO_LINK_ON_FIRST_LOGIN.sql:6` enforces the same for `first_login_at`/`client_user_id` transitions + backfills already-logged-in pendings. Result: created clients auto-appear in therapist caseload after first login, no manual accept.

**Apply the fix (one file, idempotent):**

```bash
# In Supabase SQL Editor — run once (or re-run safely):
supabase/RUN_ONCE_PRIVACY_FIX.sql
supabase/RUN_ONCE_AUTO_LINK_ON_FIRST_LOGIN.sql          # auto-accepts therapist pending invites on first login + backfill
supabase/RUN_ONCE_PRIVACY_FIX_C3_DROP_OPEN_POLICIES.sql  # if your DB had legacy "Allow all" policies

# Verify:
scripts/verify-rls.sql  # expect: buckets public=false, qual=true → 0 rows, RLS enabled, therapist_owns_patient exists
```

**Encryption today vs next:**

- **Today:** Platform-managed (TLS + AES-256 volumes + SSE-S3). App fields are plaintext behind RLS/API — snapshot with `service_role` can read.
- **Next (Track A, Q1 2027):** Column-level `pgsodium` + Vault — `soap_notes`, `reviews`, `messages.body`, `patients.email` as `BYTEA` ciphertext; snapshot without Vault keys is opaque. See [`docs/FUTURE_PLANS.md#2-track-a`](docs/FUTURE_PLANS.md#2-track-a--column-level-encryption-pgsodium--vault).
- **Next (Track B, Q2 2027 pilot):** Client-side E2E envelope (WebCrypto AES-GCM + ECDH) — server never sees plaintext; per-patient opt-in, AI requires explicit consent. See [`docs/FUTURE_PLANS.md#3-track-b`](docs/FUTURE_PLANS.md#3-track-b--client-side-end-to-end-encryption-webcrypto-envelope).

---

## Documentation & Audits

- [Allied Health Pitch Presentation (10 Slides)](docs/PITCH_PRESENTATION.html) | [Markdown Version](docs/PITCH_PRESENTATION.md)
- [Database Design & Entity Relationships](docs/DATABASE_DESIGN.md)
- [SAM Engine Keywords & Clinical Classifications](docs/SAM_ENGINE_KEYWORDS.md)
- [Progress & AI Cost Audit (Latest: 1101260315, Commit f77e45e)](audit/audit_report_1101260315.md) | [Interactive HTML](audit/audit_report_1101260315.html) | [Stable Copy (docs/)](docs/AUDIT_REPORT_LATEST.md) — Previous versions in [audit/old/](audit/old/)
- [HIPAA Security & Privacy Compliance Audit (Latest: 1101260315, C1–H4 Hardened)](audit/HIPAA_COMPLIANCE_AUDIT_1101260315.md) | [Interactive HTML](audit/HIPAA_COMPLIANCE_AUDIT_1101260315.html) | [Stable Copy (docs/)](docs/HIPAA_AUDIT_LATEST.md) — Privacy Outline: [PRIVACY_HARDENING_LATEST.md](docs/PRIVACY_HARDENING_LATEST.md)
- [Business Model Canvas V4 (C1–H4 BAA-Ready, 1101260315)](audit/BUSINESS_MODEL_CANVAS_V4_1101260315.md) | [Interactive HTML](audit/BUSINESS_MODEL_CANVAS_V4_1101260315.html) | [Stable Copy (docs/)](docs/BUSINESS_MODEL_CANVAS_LATEST.md) — Archived in [audit/old/](audit/old/) / [docs/old/](docs/old/)
- [Meta AI Integration Details](docs/META_INTEGRATION.md)
- [Hackathon Demo Walkthrough](docs/DEMO.md)
- [Clinical Evaluation & Latencies](docs/EVALUATION.md)
- [Future Plans — Column-Level & E2E Encryption Roadmap](docs/FUTURE_PLANS.md)
