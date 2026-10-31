# Aruga (Clinician-Directed Home-Program Companion)

> **Aruga** is a modern, clinician-directed home-program companion for speech-language pathologists (SLP), occupational therapists (OT), and physical therapists (PT). Clinicians assign structured home routines across **pediatric**, **adolescent**, **adult**, and **old people (55+)** populations; clients (and caregivers) record short tabletop activity videos; and Meta AI assists with program drafting, video segmentation, and clinical feedback under human supervision.

---

## Key Highlights

- **Branding & Aesthetic**: Refined cursive *Playwrite IT Trad* wordmark paired with a medical-grade aesthetic—charcoal/black background, dark zinc cards, off-white text, and a restrained teal accent.
- **Light & Dark Mode**: One-click theme toggle supporting system preferences, dark mode, and light mode.
- **Multi-Population Care (Pediatric, Adolescent, Adult, Old People 55+)**:
  - **Pediatric Care (<12y)**: Play-based fine motor development with dedicated **Caregiver Co-Runner** tracking.
  - **Adolescent Care (12–17y)**: School ergonomics, writing stamina, executive function, and bilateral coordination.
  - **Adult Care (18–54y)**: Post-stroke neurorehabilitation, upper extremity dexterity, and workplace ergonomics.
  - **Old People Care (55+y)**: Fall prevention, joint mobility with osteoarthritis, hip precautions, tremor damping, and presbyphagia.
- **SAM 3.1 Clinical & Environmental Keyword Engines**:
  - **7 Validated Engines**:
    1. *Pediatric Care Engine* (100 keywords across OT, PT, SLP & OTPF-4)
    2. *Adolescent Care Engine* (100 keywords for school, motor planning & ADLs)
    3. *Adult Rehabilitation Engine* (100 keywords for neuro-rehab, stroke & ergonomics)
    4. *Old People (55+) Engine* (100 keywords for mobility, fall prevention & daily independence)
    5. *Everyday Objects at Home Engine* (fine motor daily items: cups, utensils, keys, remote, toothbrush, etc.)
    6. *Everyday Objects at School Engine* (academic fine-motor tools: pencils, scissors, markers, notebook, glue, etc.)
    7. *Kitchen Items Engine* (adaptive culinary & IADL items: spatula, mugs, jars, bowls, tongs, measuring spoons, etc.)
  - **SAM 3.1 Test Workspace (`/sam-test`)**: Live engine selector with pre-populated multi-concept chips, processing duration tracking (latency stored in milliseconds), and a historical session reload feature.
  - See the complete clinical classification guide: [SAM Engine Keywords Guide](docs/SAM_ENGINE_KEYWORDS.md).
- **100% Supabase CRUD Architecture**:
  - **Patients & Caseload**: Full `GET`, `POST`, `PATCH`, and `DELETE` via [`/api/therapist/clients`](src/app/api/therapist/clients/route.ts).
  - **Home Programs & Steps**: Full `GET`, `POST`, `PATCH`, and `DELETE` with reordering via [`/api/therapist/programs`](src/app/api/therapist/programs/route.ts).
  - **Client Exercise Submissions**: Draft initialization (`get_or_create`), step draft saving, and final submission via [`/api/client/submissions`](src/app/api/client/submissions/route.ts).
  - **Clinician Reviews**: Full draft review notes, observation confirmations, and atomic publishing via [`/api/therapist/reviews`](src/app/api/therapist/reviews/route.ts).
  - **1-on-1 Messages**: Scoped clinical threads between clinicians and patients via [`/api/messages`](src/app/api/messages/route.ts).
  - **Ask OT AI Multi-Chat**: Thread management, message persistence, and session clearing via [`/api/ot-chat/conversations`](src/app/api/ot-chat/conversations/route.ts).
- **Strict Zero Dummy Data for Clinicians**:
  - Therapists only see their own genuine assigned caseload.
  - Clean empty states when caseloads are newly initialized.
  - Add Client and Edit Client modals start with completely blank fields and generic guidance (no placeholder dummy names like "Leo Chen" or "Marcus Vance").
- **Authentication & Credential Lifecycle**:
  - Role selection (`therapist` vs. `client`) with clean single-spinner login.
  - Automated client account provisioning with temporary passwords upon therapist enrollment.
  - 1-click formatted credential copy (SMS/WhatsApp/Email).
  - **Privacy Rule**: Temporary credentials remain viewable by the clinician **only until** the client logs in for the first time, at which point credentials are permanently wiped from clinician view (`temporary_password = NULL`).
- **Direct Meta AI Integration**:
  - **Muse Spark 1.3** (`muse-spark-1.3`): Expands clinician notes into structured steps with safety boundaries; drafts feedback from verified observations.
  - **SAM 3.1** (`sam-3.1`): Streams video object segmentation parsed via `@meta-sam/parser` to render real bounding boxes and SVG mask tracking over tabletop exercise videos.
  - **Ask OT Assistant (`/ask-ot`)**: Multi-conversation conversational OT copilot persisted to Supabase with chat history and clearing.

---

## Feature Progress & Implementation Checklist

### Core Features (Completed)
- [x] **Theme Switcher**: Instant toggle between Dark Mode and Light Mode with persistence.
- [x] **Branding**: Cursive *Playwrite IT Trad* typography; removed generic hand logo icon.
- [x] **Demographic Segmentation**: Adult, Adolescent, Pediatric, and Old People (55+) care with Caregiver co-runner fields.
- [x] **SAM 3.1 Clinical Lifespan Engines**: 4 demographic engines + 3 environmental testing engines (Home, School, Kitchen).
- [x] **SAM 3.1 Benchmarking & History**: Processing latency measurement, session storage, and reload capability.
- [x] **Full Supabase CRUD for Therapist & Client**: Comprehensive relational endpoints for patients, programs, steps, submissions, reviews, and messaging.
- [x] **Zero Dummy Data for Clinicians**: Clean empty states; synthetic demo data restricted strictly to demo bypass accounts.
- [x] **Login UX Polish**: Single unified loading spinner during authentication.
- [x] **Supabase Authentication**: Email/password registration, login, and automatic redirection to role dashboards.
- [x] **Customizable User Profiles**:
  - Client: 8 customizable fields (Age, DOB, Condition, Caregiver, Goals, Schedule, Sensory, Workplace/School).
  - Therapist: 8 clinical fields (Discipline, License, Clinic, Specialties, Phone, Hours, Caseload, Bio).
- [x] **Credential Privacy Lifecycle**: Temporary passwords automatically purged from clinician view upon first client login.
- [x] **Ask OT Assistant (`/ask-ot`)**: Multi-chat clinical assistant with conversation management and database persistence.
- [x] **SAM 3.1 Test Bench (`/sam-test`)**: Video segmentation with results saved to `sam_test_results`.
- [x] **1-on-1 Messaging**: Direct therapist-client messaging with routine mention chips stored in Supabase.
- [x] **Idempotent Database Migrations**: `supabase/migrations/20261030000001_add_old_people_category.sql` and `supabase/all_in_one_setup.sql`.

### Roadmap & In-Progress (Pending Implementation)
- [ ] **Direct Supabase Storage Video Uploads**: Browser-to-bucket direct upload for high-res `.mp4`/`.webm` client recordings.
- [ ] **Realtime Subscriptions**: Live push updates for 1-on-1 messages and review status changes without page refresh.
- [ ] **Automated Email Dispatch (Resend / Supabase SMTP)**: Send welcome invitations and credentials directly to client emails.
- [ ] **Gamified Pediatric Engagement**: Visual milestones, badges, and streaks for pediatric daily practice.
- [ ] **RTM Billing & CPT Documentation**: Automated logs for Remote Therapeutic Monitoring (CPT 98975, 98977, 98980).
- [ ] **Progressive Web App (PWA)**: Offline exercise caching and mobile camera recording.

---

## AI Call Cost Evaluation & User Allocations (60-Min @ 30 FPS Model)

A comprehensive cost evaluation was performed for Meta AI compute usage (Muse Spark 1.3 LLM & SAM 3.1 Video Engine) based on **30 FPS frame analysis** and a **60-minute monthly video allocation per active user** (108,000 frames/month). Full audit details can be found in the [Progress Audit Report Markdown](audit/audit_report_1029260313.md) ([Interactive HTML](audit/audit_report_1029260313.html)) and the [Business Model Canvas V1 Markdown](audit/BUSINESS_MODEL_CANVAS_V1_1029260349.md) ([Interactive HTML](audit/BUSINESS_MODEL_CANVAS_V1_1029260349.html)).

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

### 2. Monthly Cost per Active Patient
For a full intensive 60-minute video rehabilitation workload (120 exercises + reviews + 60 Ask OT questions), total direct AI compute is **~$5.71 / active patient / month**.

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
- **Backend & Auth**: Supabase Auth (@supabase/ssr), PostgreSQL, Private Storage, and Realtime
- **AI Models**: Meta Muse Spark 1.3 & SAM 3.1 (`https://api.meta.ai/v1`)
- **Parsers & Validation**: `@meta-sam/parser`, Zod, React Hook Form
- **Icons**: Lucide Icons
- **Testing**: Vitest (`50/50 tests passed`), Playwright

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
- **Fresh Setup**: Execute [`supabase/all_in_one_setup.sql`](supabase/all_in_one_setup.sql) directly in your Supabase SQL Editor.
- **Incremental Migrations**: If your database is already initialized, run the following in order:
  1. [`supabase/migrations/20261030000001_add_old_people_category.sql`](supabase/migrations/20261030000001_add_old_people_category.sql) — adds `'old_people'` category.
  2. [`supabase/migrations/20261031000001_link_therapist_in_new_user_trigger.sql`](supabase/migrations/20261031000001_link_therapist_in_new_user_trigger.sql) — automatic client-therapist email linking on client signup.
  3. [`supabase/migrations/20261031000002_two_way_handshake_invitations.sql`](supabase/migrations/20261031000002_two_way_handshake_invitations.sql) — two-way confirmation handshake (`invitation_status`, `invitation_initiated_by`).
  4. [`supabase/migrations/20261031000003_care_transfer_service.sql`](supabase/migrations/20261031000003_care_transfer_service.sql) — care transfer service (`previous_therapist_id`, `handover_notes`).
  5. [`supabase/migrations/20261031000004_program_videos_storage.sql`](supabase/migrations/20261031000004_program_videos_storage.sql) — Supabase Storage `program-videos` bucket setup (50MB free tier limit, video streaming).

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
Runs 60 unit and integration tests across 5 suites:
- `tests/authorization.test.ts`: Role-based isolation, draft concealment, frozen protocol checks.
- `tests/supabase-crud.test.ts`: Complete CRUD operations for clients, home programs, step video uploads (Supabase Storage), therapist per-step feedback and overall reviews, real-time messaging, **Two-Way Handshake Confirmations**, and **Care Transfer Service**.
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

- [SAM Engine Keywords & Clinical Classifications](docs/SAM_ENGINE_KEYWORDS.md)
- [Business Model Canvas V1 (Timestamp: 1029260349)](audit/BUSINESS_MODEL_CANVAS_V1_1029260349.md)
- [Progress & AI Cost Audit Report (Timestamp: 1029260313)](audit/audit_report_1029260313.md)
- [Meta AI Integration Details](docs/META_INTEGRATION.md)
- [Hackathon Demo Walkthrough](docs/DEMO.md)
- [Clinical Evaluation & Latencies](docs/EVALUATION.md)
