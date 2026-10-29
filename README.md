# Aruga (Clinician-Directed Home-Program Companion)

> **Aruga** is a modern, clinician-directed home-program companion for speech-language pathologists (SLP), occupational therapists (OT), and physical therapists (PT). Clinicians assign structured home routines across **adult**, **adolescent**, and **pediatric** populations; clients (and caregivers) record short tabletop activity videos; and Meta AI assists with program drafting, video segmentation, and clinical feedback under human supervision.

---

## Key Highlights

- **Branding & Aesthetic**: Refined cursive *Playwrite IT Trad* wordmark paired with a medical-grade aesthetic—charcoal/black background, dark zinc cards, off-white text, and a restrained teal accent.
- **Light & Dark Mode**: One-click theme toggle supporting system preferences, dark mode, and light mode.
- **Multi-Population Care (Adult, Adolescent, Pediatric)**:
  - **Adult Care**: Post-stroke neurorehabilitation and upper extremity dexterity.
  - **Adolescent Care**: Writing stamina, ergonomic posture, and bilateral coordination.
  - **Pediatric Care**: Play-based fine motor development with dedicated **Caregiver Co-Runner** tracking.
- **Full Supabase Authentication & Credential Lifecycle**:
  - Role selection (`therapist` vs. `client`) and demographic profiling upon registration.
  - Automated client account provisioning with temporary passwords upon therapist caseload enrollment.
  - 1-click formatted credential copy (SMS/WhatsApp/Email).
  - **Privacy Rule**: Temporary credentials remain viewable and copyable by the therapist **only until** the client logs in for the first time or changes their password, at which point credentials are permanently wiped from clinician view (`temporary_password = NULL`).
  - In-app password change for authenticated users and email password recovery on the login page.
- **Direct Meta AI Integration**:
  - **Muse Spark 1.3** (`muse-spark-1.3`): Expands rough clinician notes into structured steps with safety boundaries; drafts feedback from verified observations.
  - **SAM 3.1** (`sam-3.1`): Streams video object segmentation parsed via `@meta-sam/parser` to render real bounding boxes and SVG mask tracking over tabletop exercise videos.
  - **Ask OT Assistant (`/ask-ot`)**: Multi-conversation conversational OT copilot persisted to Supabase with chat history and clearing.
  - **SAM Test Bench (`/sam-test`)**: Live segmentation sandbox saving all records under the authenticated user.
- **1-on-1 Human Messaging**: Scoped private chat with clickable `@home-program` mention chips linking directly to routines.
- **Zero Dummy Data**: Clean state for newly registered accounts; dummy fixtures strictly preserved for instant demo bypass accounts.

---

## Feature Progress & Implementation Checklist

### Core Features (Completed)
- [x] **Theme Switcher**: Instant toggle between Dark Mode and Light Mode with persistence.
- [x] **Branding**: Cursive *Playwrite IT Trad* typography; removed generic hand logo icon.
- [x] **Demographic Segmentation**: Adult, Adolescent, and Pediatric care with Caregiver co-runner fields.
- [x] **Supabase Authentication**: Email/password registration, login, and automatic redirection to role dashboards.
- [x] **Customizable User Profiles**:
  - Client: 8 customizable fields (Age, DOB, Condition, Caregiver, Goals, Schedule, Sensory, Workplace/School).
  - Therapist: 8 clinical fields (Discipline, License, Clinic, Specialties, Phone, Hours, Caseload, Bio).
- [x] **Change Password (Post-Authentication)**: Clients and therapists can update their password securely in their respective profiles.
- [x] **Forgot Password & Recovery**: Password reset via email and recovery token validation (`/login?mode=reset`).
- [x] **Client Credential Provisioning & Clipboard Copy**:
  - Automatic Supabase account creation when therapist adds a client.
  - 1-click formatted credential copy for SMS, WhatsApp, or Email.
- [x] **Credential Privacy Lifecyle**:
  - Therapist can copy temporary password before first login (`🔑 Temp Creds Active`).
  - Once client logs in, credentials are automatically and permanently deleted from therapist control (`🔒 Account Claimed`).
- [x] **Ask OT Assistant (`/ask-ot`)**: Multi-chat clinical assistant with conversation management and database persistence.
- [x] **SAM 3.1 Test Bench (`/sam-test`)**: Video segmentation with results saved to `sam_test_records`.
- [x] **Home Program Management**: Step creation, routine assignment, and caseload review.
- [x] **1-on-1 Messaging**: Direct therapist-client messaging with routine mention chips.
- [x] **Zero Dummy Data for New Accounts**: Real clean state; synthetic data restricted to bypass accounts.
- [x] **All-In-One PostgreSQL Setup Script**: `supabase/all_in_one_setup.sql` with safe migrations.

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

### 4. Operational Turnaround & Process Timelines
- **Video AI Analysis Pipeline**: **~8.8 seconds total** per 30-sec video submission (0.8s client pre-flight, 1.5s S3 upload, 1.2s keyframe extraction, 3.5s SAM 3.1 tracking, 1.4s Muse Spark LLM synthesis, 0.4s DB write).
- **Clinician Review Turnaround**: **1.5 – 2.0 minutes** per submission (down from 8–10 mins manual review; **78% time saved**, reclaiming **~20.8 hours/month** per clinician on a 20-patient caseload).
- **Patient Daily Routine**: **10 – 12 minutes / day** (4 exercises × 30s video + prep & rest; ~5.5–6.0 hrs/month total).
- **RTM Compliance (CPT 98980)**: Automatically logs the required **20 minutes / calendar month** of clinical monitoring time.
- **Backlog Rollout ETA**: **~2.5 Weeks** across Sprints 1–3 to complete all remaining 6 roadmap items.

---

## Tech Stack

- **Framework**: Next.js 16 (App Router) with React 19 and TypeScript (Strict Mode)
- **Styling**: Tailwind CSS v4 & custom clinical theme tokens
- **Backend & Auth**: Supabase Auth (@supabase/ssr), PostgreSQL, Private Storage, and Realtime
- **AI Models**: Meta Muse Spark 1.3 & SAM 3.1 (`https://api.meta.ai/v1`)
- **Parsers & Validation**: `@meta-sam/parser`, Zod, React Hook Form
- **Icons**: Lucide Icons
- **Testing**: Vitest (`24/24 passed`), Playwright

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

### 3. Database Setup
Execute `supabase/all_in_one_setup.sql` directly in your Supabase SQL Editor. It creates all tables, safe migrations, Row Level Security policies, and demo fixtures.

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
Runs 24 unit and integration tests covering:
- Muse Spark structured output and feedback validation
- Video observation safety boundaries
- SAM 3.1 streaming output parser integration
- Authorization, role isolation, and draft review concealment

Production build verification:
```bash
npm run build
```

---

## Documentation & Audits

- [Business Model Canvas V1 (Timestamp: 1029260349)](audit/BUSINESS_MODEL_CANVAS_V1_1029260349.md)
- [Progress & AI Cost Audit Report (Timestamp: 1029260313)](audit/audit_report_1029260313.md)
- [Meta AI Integration Details](docs/META_INTEGRATION.md)
- [Hackathon Demo Walkthrough](docs/DEMO.md)
- [Clinical Evaluation & Latencies](docs/EVALUATION.md)
