# Modal MHR Deployment Guide — Aruga Biomech Engine (SAM 3.1 → SAM 3D Body)

> **Scope:** Deploy `modal/app.py` (`aruga-mhr`) to Modal L4 and integrate its `/infer` API with the Next.js Biomech Agent (`POST /api/agent/biomech/run`). All sensitive values live in env — never hardcode.

Last updated: 2026-11-02

---

## 1) What you are deploying

| Piece | Where | What it does |
|---|---|---|
| **SAM 3.1 segmentation** | Meta Model API (`https://api.meta.ai/v1`) | `segment_concepts(concepts ⊆ 16)` → boxes+RLE masks. Called by Next before Modal. |
| **SAM 3D Body / MHR** | **Modal GPU `aruga-mhr`** (`modal/app.py`) | `POST /infer` receives `{samPerson, videoUrl, options}` (no raw mp4) → `pred_keypoints_3d/2d`, `angles`, `rom`, `flags`, `summary`. One inference per clip, reused across U1-U11. |
| **Planner + Next proxy** | `POST /api/agent/biomech/run` | Picks 2-8 keywords from `BIOMECH_KEYWORDS` 16 (`src/lib/meta/biomech-prompt.ts`), calls Meta → Modal → persists `biomech_jobs` + `agent_runs` + `ai_analyses.mhr_results`. Requires `MODAL_MHR_URL`. |
| **UI** | `therapist/submissions/[id]` per-step card | Dropdown U1-U11 + **Analyze biomechanics (Agent)** → polls `GET /api/agent/biomech/status`, renders `BiomechPanel` + `SamOverlay`. |

Spec source: `plan/BIOMECH_ENGINE_PLAN.md` §3-§6. No browser onnx, no 100-keyword engine.

---

## 2) Prerequisites

```bash
# 1. Modal account + token (https://modal.com)
pip install modal
modal token new          # browser login, writes ~/.modal.toml
modal token current      # verify

# 2. Repo + Node
node -v   # >=20
npm ci

# 3. Supabase project (Storage bucket `program-videos` must exist, RLS per supabase/03_storage_buckets.sql)
# 4. Meta Model API key (MODEL_API_KEY) for SAM 3.1 — set in Next env, not in Modal
```

---

## 3) Environment variables — put ALL sensitive routes in env (reminder)

> ⚠️ **Reminder — do this now:** Copy `.env.example` → `.env.local` (local) and set the same keys in your hosting env (Vercel/Render/etc). Never commit `.env.local`. All Modal/Next secrets below are env-only; code reads `process.env` and `os.environ`.
> **Sensitive API routes are never hardcoded.** `MODAL_MHR_URL`, `MODAL_SECRET`, `MODAL_WEBHOOK_URL`, `SUPABASE_SECRET_KEY`, `MODEL_API_KEY`, and any `*_URL` that contains a token must come from env (see `.env.example`). If you add a new sensitive route/URL, add it to `.env.example` first, then to your hosting env — this guide and `modal/deploy.sh` will pick it up.

### 3.1 Next.js (`.env.local` + hosting dashboard)

| Var | Required | Example | Where used | Notes |
|---|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | yes | `https://xyz.supabase.co` | `lib/supabase/*` | Public. |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | yes | `sb_publishable_...` | client | Public anon. |
| `SUPABASE_SECRET_KEY` | yes | `sb_secret_...` | `lib/supabase/admin.ts` | **Secret** — service_role, server-only. |
| `NEXT_PUBLIC_APP_URL` | yes | `https://aruga.vercel.app` | links | Public. |
| `MODEL_API_KEY` | yes | `sk-meta-...` | `lib/meta/client.ts` | **Secret** — Meta Model API, server-only. |
| `META_API_BASE_URL` | yes | `https://api.meta.ai/v1` | `lib/meta/client.ts` | Public. |
| `MUSE_IMAGE_MODEL_ID` | no | `muse-image-1.0` | image gen | Default `muse-image-1.0`. |
| `AI_MODE` | yes | `live` | `lib/meta/agent.ts` | `live` (real) or `mock` (dev). |
| `MAX_UPLOAD_MB` | no | `25` | uploads | Default 25. |
| `MAX_VIDEO_SECONDS` | no | `30` | ingest | Default 30, clipped @3 FPS. |
| **`MODAL_MHR_URL`** | **yes — only required for Biomech** | `https://<workspace>--aruga-mhr-infer.modal.run` | `api/agent/biomech/run` | **Sensitive** — Modal endpoint URL from `modal deploy` output. Leave unset to disable Biomech (returns `503 MODAL_NOT_CONFIGURED`). **This is the only Modal var you need.** |
| `MODAL_SECRET` | no — optional | `whsec_...` random 32+ chars | `api/agent/biomech/run` → `x-modal-secret` header | **Secret (optional)** — only if you enable auth on Modal (`modal secret create aruga-mhr-env MODAL_SECRET=...`). Generate: `openssl rand -hex 32`. If set, must match Modal secret (see §3.2). Free-tier mock works without it. |
| `MODAL_MHR_ENDPOINT` | no — ignore | same as `MODAL_MHR_URL` | fallback alias | Legacy alias — leave blank if `MODAL_MHR_URL` is set. |
| `MODAL_WEBHOOK_URL` | no — ignore | `https://aruga.vercel.app/api/mhr/webhook` | Modal → Next callback (optional §5) | Only for async long clips — leave blank for current sync flow. |

> **For local + Vercel you only need `MODAL_MHR_URL`.** Add it to `.env.local` (local) and to **Vercel → Project → Settings → Environment Variables** for `Production` + `Preview` (then Redeploy). Ignore the other three unless you need authenticated webhooks. If `MODAL_MHR_URL` is unset, Biomech returns `503` but all other features work.

### 3.2 Modal (`modal secret create` — optional, only for authenticated mode)

Modal secrets are injected as `os.environ` in the GPU container. **You can skip this entirely for the free-tier mock** — `modal/app.py:42` runs without secrets (`_secrets = []` when `aruga-mhr-env` missing, `x-modal-secret` check off).

Create only when you want auth (recommended for prod L4):

```bash
# Optional — only if you want Next ↔ Modal authenticated
modal secret create aruga-mhr-env \
  MODAL_SECRET='replace-with-openssl-rand-hex-32'   # openssl rand -hex 32
  # SUPABASE_URL='https://xyz.supabase.co'          # only if Modal needs to call back
  # MODAL_WEBHOOK_URL='https://aruga.vercel.app/api/mhr/webhook'

# Verify (value masked)
modal secret list
```

`modal/app.py` reads these via `os.environ["MODAL_SECRET"]` etc (see §4.2). No secret is committed. If you don't create the secret, just deploy — no `MODAL_SECRET` needed in Next either (only `MODAL_MHR_URL`).

---

## 4) Deploy to Modal

### 4.1 Quick start (stub, no GPU weights — verifies wiring)

The repo ships a deterministic mock (`_mock_mhr`) so you can verify end-to-end without downloading 1.69 GB checkpoints.

```bash
cd /Users/ernest.pascual/Downloads/Development/aruga   # or your checkout

# Local dry-run (no deploy)
modal run modal/app.py::stub_infer --item-json '{"submissionId":"test","stepSubmissionId":"step1","options":{"concepts":["person","shoulder"]}}'

# Deploy stub to cloud (creates https://<workspace>--aruga-mhr-infer.modal.run)
modal deploy modal/app.py

# Copy the printed endpoint URL → set MODAL_MHR_URL in Next env (§3.1)
# Example output: https://ernest-pascual--aruga-mhr-infer.modal.run
```

Test from Next:

```bash
# In another terminal (Next dev running with MODAL_MHR_URL set)
curl -X POST http://localhost:3000/api/agent/biomech/run \
  -H 'Content-Type: application/json' \
  -d '{"submissionId":"<real-submission-uuid>","stepSubmissionId":"<real-step-submission-uuid>","intent":"U1"}'
# 503 until MODAL_MHR_URL set; 422 if step has no video; 200 with mhr JSON when wired
```

### 4.2 Production (real SAM 3D Body — uncomment Phase 1 image)

1. Edit `modal/app.py` — uncomment the **Phase 1 image** block (pytorch 2.4 + `facebookresearch/sam-3d-body`) and ensure `volumes={"/ckpts": volume}` is set:

```python
# modal/app.py — Phase 1 image (uncomment)
image = (
    modal.Image.from_registry("pytorch/pytorch:2.4.0-cuda12.1-cudnn9-runtime")
    .pip_install("opencv-python-headless", "numpy", "onnxruntime-gpu", "scipy")
    # add real deps: "git+https://github.com/facebookresearch/sam-3d-body.git"
)
volume = modal.Volume.from_name("sam3db-ckpts", create_if_missing=True)
```

2. Download checkpoints to Modal Volume (one-time, ~1.69 GB + 3.4 GB ONNX / 0.9 GB INT8):

```bash
# Option A: upload local ckpts
modal volume put sam3db-ckpts /path/to/model.ckpt /ckpts/model.ckpt
modal volume put sam3db-ckpts /path/to/mhr_model.pt /ckpts/mhr_model.pt
modal volume ls sam3db-ckpts   # verify

# Option B: bake into image (add modal.Image step that wget from gated URL — requires auth)
```

3. Replace `_mock_mhr` with real `estimator.process_one_image(crop_rgb)` + One-Euro filter per `plan/BIOMECH_ENGINE_PLAN.md` §3.2. Keep the same request/response shape so Next does not change.

4. Wire `MODAL_SECRET` check in `infer` (see `modal/app.py` — reads `os.environ["MODAL_SECRET"]`, rejects missing/invalid `x-modal-secret` with 401). Update Modal secret via `modal secret create` (§3.2) if you rotate it.

5. Deploy:

```bash
modal deploy modal/app.py
# Note new URL if workspace changed → update MODAL_MHR_URL in Next env
modal app list    # aruga-mhr should be "deployed"
```

Cost: L4 `$0.000222/s` → ~`$0.002/clip @3 FPS (45 frames/15s)` naive; INT8 `$0.0006` (see plan §3.4). **One inference per clip** — U1+U5+U11 reuse same `mhr_result` via `GET /api/agent/biomech/status`.

---

## 5) Integrate the deployed API with the Next.js Biomech Agent

### 5.1 Request contract (Next → Modal `POST /infer`)

Next `api/agent/biomech/run` builds this and POSTs to `MODAL_MHR_URL + /infer` (signed URL TTL 600s, concepts validated ⊆ 16):

```json
{
  "submissionId": "uuid",
  "stepSubmissionId": "uuid",
  "videoUrl": "https://xyz.supabase.co/storage/v1/object/sign/program-videos/...?token=... (10m TTL)",
  "samPerson": { "boxes": [], "masks": [], "mediaSize": { "width": 1280, "height": 720 }, "sampleFps": 3 },
  "options": { "concepts": ["person","shoulder","elbow","forearm","wrist"], "ageBand": "adult" }
}
```

Headers: `Content-Type: application/json`, `x-modal-secret: <MODAL_SECRET>` (if set).

### 5.2 Response contract (Modal → Next)

Modal returns (persisted to `biomech_jobs.mhr_result` + `ai_analyses.mhr_results`):

```json
{
  "submissionId": "uuid",
  "stepSubmissionId": "uuid",
  "modelId": "sam-3d-body-vith + MHR 1.0",
  "processingMs": 1840,
  "frames": [{ "frameIndex": 12, "timestampSeconds": 0.4, "angles": { "shoulderFlex_L": 142.3, "neckAngles": { "flexExt": 38 } }, "rom": {...}, "confidence": {"pose": 0.82, "angleErrorDeg": 3.5}, "flags": ["trunk_compensation_mild"] }],
  "summary": { "peakAngles": {"neckFlex_max": 52}, "rom": {"shoulderFlex_range": 136}, "gait": {"stepLengthSymmetry": 0.94}, "risk": "moderate_fall", "confidenceOverall": 0.78 },
  "concepts": ["person","shoulder", "..."]
}
```

Next route: `POST /api/agent/biomech/run` validates, creates `biomech_jobs`, forwards to Modal, returns `mhr` + `{intent, concepts}` to UI. Poller: `GET /api/agent/biomech/status?stepSubmissionId=`.

### 5.3 Error codes the UI handles (no mock fallback)

| Code | HTTP | Cause | UI message |
|---|---|---|---|
| `NO_VIDEO` | 422 | `step_submissions.video_path` null | "No video for this step — client has not uploaded video." Button disabled. |
| `MODAL_NOT_CONFIGURED` | 503 | `MODAL_MHR_URL` unset | "Biomech Engine not configured — deploy modal/app.py and set env. No mock fallback." Shows `concepts` hint. |
| `MODAL_FAILED` | 502 | Modal non-2xx | `Modal MHR failed: 500 ...` + `code: MODAL_FAILED`. |
| `401` from Modal | 401 | `x-modal-secret` mismatch | Rotate `MODAL_SECRET` both sides (§3). |

### 5.4 Optional async webhook (long clips)

If you need >60s Modal jobs, switch to async: Modal posts back to `POST /api/mhr/webhook` with `x-modal-secret`, Next verifies and upserts `ai_analyses.mhr_results` + `biomech_jobs status=completed`. Set `MODAL_WEBHOOK_URL` in both envs. Current sync path (`modalRes.json()` inline) is sufficient for ≤30s clips.

---

## 6) Verification checklist

- [ ] `modal token current` OK, `modal deploy modal/app.py` prints URL
- [ ] `MODAL_MHR_URL` set in `.env.local` and in Vercel env (only required var; `MODAL_SECRET` only if you enabled auth — must match both sides)
- [ ] Supabase `program-videos` bucket exists, `step_submissions` row has `video_path`
- [ ] `curl POST /api/agent/biomech/run` with real `submissionId/stepSubmissionId/intent U1` → 200 with `frames/summary` (or 503 with clear message if URL missing)
- [ ] Therapist → `therapist/submissions/[id]` → per-step U1-U11 dropdown → **Analyze biomechanics (Agent)** → `BiomechPanel` shows ROM cards + flags, **Insert into Objective** appends to SOAP
- [ ] Changing dropdown re-filters cached `mhr_result` — no re-bill (1 Modal call serves U1+U5+U11 views)
- [ ] `GET /api/agent/biomech/status?stepSubmissionId=` returns `completed` + `mhr_result`
- [ ] Rotate `MODAL_SECRET` → redeploy Modal → update Next env → re-test 401 gone

---

## 7) Security reminders

- **Never commit** `.env.local`, `~/.modal.toml`, or any `sb_secret` / `MODEL_API_KEY` / `MODAL_SECRET`. `.gitignore` already ignores `.env*`.
- **All sensitive routes are env-only:** `MODAL_MHR_URL`, `MODAL_SECRET`, `SUPABASE_SECRET_KEY`, `MODEL_API_KEY` — no defaults in code. `api/agent/biomech/run` returns `503 MODAL_NOT_CONFIGURED` instead of inventing data when `MODAL_MHR_URL` is missing.
- **Signed URLs:** `program-videos` signed 600s TTL; Modal fetches video via signed URL, never stores it. No PHI persistence on GPU.
- **Webhook auth:** Verify `x-modal-secret` on every Modal→Next call (`api/mhr/webhook`). Use `min_containers=1` + Modal Volume cache to avoid cold-start ckpt download.
- **RLS:** `biomech_jobs` / `agent_runs` / `ai_analyses` RLS `therapist_owns_patient` — therapist sees own patients only (see `supabase/migrations/20261102000003_agent_tables.sql`).

---

## 8) Troubleshooting

| Symptom | Fix |
|---|---|
| `MODAL_NOT_CONFIGURED` 503 | Set `MODAL_MHR_URL` in Next env (no trailing `/infer` — route appends it). Redeploy Next. |
| `Modal MHR failed: 401` | `MODAL_SECRET` mismatch — `modal secret create aruga-mhr-env` + update Next env to same value, `modal deploy` again. |
| `Failed to create signed video URL` | Bucket `program-videos` missing or `SUPABASE_SECRET_KEY` wrong. Check `supabase/03_storage_buckets.sql` ran. |
| `No video for this step` 422 | Client has not uploaded video for that `step_submission_id`. Upload required before Biomech. |
| Cold start 30-60s first call | Expected — `min_containers=1` + Volume cache mitigates. |
| Gated ckpt 403 | SAM 3D Body ckpt is gated — request access, then `modal volume put`. |

---

## 9) Cost (per Spec §3.4)

- Modal L4 naive: `$0.002/clip @3 FPS (45 frames/15s)` → $1 ≈ 115 min; INT8 `$0.0006` → $1 ≈ 7 hrs. Dense 30 FPS 10× — avoid.
- Meta SAM 3.1: `$0.009/pass` (1 pass for 2-8 concepts batched). 100-engine would be 100× — agentic saves 92%.
- Planner LLM: `<$0.001/run`. Reuse: 2 workflows same clip = $0; 2 clips = 2×.

---

## 10) Files to keep in sync

- `modal/app.py` — Modal app (this folder)
- `src/app/api/agent/biomech/run/route.ts` — Next proxy (reads `MODAL_MHR_URL`/`MODAL_SECRET`)
- `src/app/api/agent/biomech/status/route.ts` — poller
- `src/app/api/mhr/webhook/route.ts` — async callback (if used)
- `src/lib/meta/biomech-prompt.ts` — `BIOMECH_KEYWORDS` 16 (sole keyword source)
- `supabase/migrations/20261102000003_agent_tables.sql` — `biomech_jobs`, `agent_runs`
- `.env.example` — template for all env vars above (copy to `.env.local`, set in host)
