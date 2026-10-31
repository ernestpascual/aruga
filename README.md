# Aruga (Clinician-Directed Home-Program Companion)

> **Aruga** is a modern, clinician-directed home-program companion for speech-language pathologists (SLP), occupational therapists (OT), and physical therapists (PT). Clinicians assign structured home routines across **pediatric**, **adolescent**, **adult**, and **geriatrics (55+)** populations; clients (and caregivers) record short tabletop activity videos; and Meta AI assists with program drafting, video segmentation, multi-box SOAP documentation, and plain-English client summaries under licensed human supervision.

---

## Key Highlights

- **Branding & Aesthetic**: Refined cursive *Playwrite IT Trad* wordmark paired with a medical-grade aesthetic—charcoal/black background, dark zinc cards, off-white text, and restrained teal accents.
- **Light & Dark Mode**: Seamless theme toggle supporting system preferences, dark mode, and light mode.
- **Multi-Population Care (Pediatric, Adolescent, Adult, Geriatrics 55+)**:
  - **Pediatric Care (<12y)**: Play-based fine motor development with dedicated **Caregiver Co-Runner** tracking.
  - **Adolescent Care (12–17y)**: School ergonomics, writing stamina, executive function, and bilateral coordination.
  - **Adult Care (18–54y)**: Post-stroke neurorehabilitation, upper extremity dexterity, and workplace ergonomics.
  - **Geriatrics Care (55+y)**: Fall prevention, joint mobility with osteoarthritis, hip precautions, tremor damping, and presbyphagia.
- **Clinical Multi-Box SOAP Notes Architecture**:
  - **Live Session SOAP Notes**: Dedicated tab on each client profile allowing therapists to create, view, edit, and delete multiple session notes over time.
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
- **Direct Cloud Storage Video Uploads**:
  - High-res `.mp4`/`.webm` client recordings upload directly to private cloud storage (`program-videos` bucket) using signed URLs, bypassing serverless request body constraints.
  - Enforces 50MB free tier file size boundaries.
- **SAM 3.1 Clinical & Environmental Keyword Engines**:
  - **7 Validated Engines (700 Keywords Total)**:
    1. *Pediatric Care Engine* (100 keywords across OT, PT, SLP & OTPF-4)
    2. *Adolescent Care Engine* (100 keywords for school, motor planning & ADLs)
    3. *Adult Rehabilitation Engine* (100 keywords for neuro-rehab, stroke & ergonomics)
    4. *Geriatrics (55+) Engine* (100 keywords for mobility, fall prevention & daily independence)
    5. *Everyday Objects at Home Engine* (cups, utensils, keys, remote, toothbrush, etc.)
    6. *Everyday Objects at School Engine* (pencils, scissors, markers, notebook, glue, etc.)
    7. *Kitchen Items Engine* (spatula, mugs, jars, bowls, tongs, measuring spoons, etc.)
  - **SAM 3.1 Test Workspace (`/sam-test`)**: Live engine selector, latency measurement in milliseconds, and session history reload.
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

---

## Feature Progress & Implementation Checklist

### Core Features (Completed)
- [x] **Theme Switcher**: Instant toggle between Dark Mode and Light Mode with persistence.
- [x] **Branding**: Cursive *Playwrite IT Trad* typography; removed generic hand logo icon.
- [x] **Multi-Demographic Care**: Adult, Adolescent, Pediatric, and Geriatrics (55+) care with Caregiver co-runner fields.
- [x] **SAM 3.1 Clinical Lifespan Engines**: 4 demographic engines + 3 environmental testing engines (700 keywords total).
- [x] **SAM 3.1 Benchmarking & History**: Processing latency measurement, session storage, and reload capability.
- [x] **Clinical Multi-Box SOAP Notes**: 4 distinct textareas (S, O, A, P) for live sessions (`soap_notes`) and home program reviews (`submission_reviews`).
- [x] **Plain-English Client Summary**: Family-friendly takeaways positioned prominently below clinical notes.
- [x] **On-Demand AI Credit Protection**: Zero-credit database caching layer (`<15ms` cache hit) with manual "See Summary" expansion.
- [x] **Two-Way Handshake Invitations**: Bidirectional email invitations and linking requests between clinicians and clients.
- [x] **Care Transfer Service**: Seamless patient caseload transfer between clinicians with handover notes.
- [x] **Direct Cloud Storage Uploads**: Browser-to-bucket direct upload to private `program-videos` storage bucket.
- [x] **Multi-Client Messaging**: Caseload selector dropdown, routine `@mention` chips, and message deletion.
- [x] **In-App Notifications Dropdown**: Real-time event notifications for assignments, reviews, and transfers.
- [x] **Full Relational CRUD Architecture**: 100% relational coverage across patients, programs, steps, submissions, reviews, SOAP notes, and messages.
- [x] **Zero Dummy Data for Clinicians**: Clean empty states; synthetic demo data restricted strictly to demo bypass accounts.
- [x] **Credential Privacy Lifecycle**: Temporary passwords automatically purged from clinician view upon first client login.
- [x] **Ask OT Assistant (`/ask-ot`)**: Multi-chat clinical assistant with conversation management and database persistence.
- [x] **Idempotent Database Migrations**: 6 clean sequential migrations + `all_in_one_setup.sql`.

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
- **Backend & Auth**: Database Authentication, PostgreSQL, Private Cloud Storage, and Row-Level Security (RLS)
- **AI Models**: Meta Muse Spark 1.3 & SAM 3.1 (`https://api.meta.ai/v1`)
- **Parsers & Validation**: `@meta-sam/parser`, Zod, React Hook Form
- **Icons**: Lucide Icons
- **Testing**: Vitest (**`80/80 tests passing`** across 5 suites), Playwright
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
- **Fresh Setup**: Execute [`supabase/all_in_one_setup.sql`](supabase/all_in_one_setup.sql) directly in your PostgreSQL SQL Editor.
- **Incremental Migrations**: If your database is already initialized, run the migrations sequentially:
  1. [`supabase/migrations/20261030000001_add_old_people_category.sql`](supabase/migrations/20261030000001_add_old_people_category.sql) — adds `'old_people'` category.
  2. [`supabase/migrations/20261031000001_link_therapist_in_new_user_trigger.sql`](supabase/migrations/20261031000001_link_therapist_in_new_user_trigger.sql) — automatic client-therapist email linking on client signup.
  3. [`supabase/migrations/20261031000002_two_way_handshake_invitations.sql`](supabase/migrations/20261031000002_two_way_handshake_invitations.sql) — two-way confirmation handshake (`invitation_status`, `invitation_initiated_by`).
  4. [`supabase/migrations/20261031000003_care_transfer_service.sql`](supabase/migrations/20261031000003_care_transfer_service.sql) — care transfer service (`previous_therapist_id`, `handover_notes`).
  5. [`supabase/migrations/20261031000004_program_videos_storage.sql`](supabase/migrations/20261031000004_program_videos_storage.sql) — Cloud Storage `program-videos` bucket setup (50MB limit, video streaming).
  6. [`supabase/migrations/20261031000005_pending_requests_and_profiles_email.sql`](supabase/migrations/20261031000005_pending_requests_and_profiles_email.sql) — index optimizations and profile email synchronization.
  7. [`supabase/migrations/20261031000006_soap_notes_and_program_feedback.sql`](supabase/migrations/20261031000006_soap_notes_and_program_feedback.sql) — multi-box `soap_notes` table and `submission_reviews` SOAP fields.

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
Runs **80 unit and integration tests** across 5 suites:
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

## Documentation & Audits

- [Allied Health Pitch Presentation (10 Slides)](docs/PITCH_PRESENTATION.html) | [Markdown Version](docs/PITCH_PRESENTATION.md)
- [Database Design & Entity Relationships](docs/DATABASE_DESIGN.md)
- [SAM Engine Keywords & Clinical Classifications](docs/SAM_ENGINE_KEYWORDS.md)
- [Progress & AI Cost Audit (Latest: 1101260151, Commit 7ac955f)](audit/audit_report_1101260151.md) | [Interactive HTML](audit/audit_report_1101260151.html) | [Stable Copy (docs/)](docs/AUDIT_REPORT_LATEST.md) — Previous versions in [audit/old/](audit/old/)
- [HIPAA Security & Privacy Compliance Audit (Latest: 1101260151)](audit/HIPAA_COMPLIANCE_AUDIT_1101260151.md) | [Interactive HTML](audit/HIPAA_COMPLIANCE_AUDIT_1101260151.html) | [Stable Copy (docs/)](docs/HIPAA_AUDIT_LATEST.md)
- [Business Model Canvas V2 (Timestamp: 1031261420)](audit/BUSINESS_MODEL_CANVAS_V2_1031261420.md) | [Stable Copy (docs/)](docs/BUSINESS_MODEL_CANVAS_LATEST.md) — Archived: [audit/old/](audit/old/) / [docs/old/](docs/old/)
- [Meta AI Integration Details](docs/META_INTEGRATION.md)
- [Hackathon Demo Walkthrough](docs/DEMO.md)
- [Clinical Evaluation & Latencies](docs/EVALUATION.md)
