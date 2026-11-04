# Modal Deployment — SAM 3D Body (Biomechanic Agent)

## Why Modal

SAM 3D Body (`facebookresearch/sam-3d-body`, ViT-H + MHR head) is too heavy for Vercel or the browser:

- **Size:** 1.69 GB checkpoints + PyTorch + `ffmpeg`/`opencv` stack — needs a persistent volume (`sam3db-ckpts` → `/ckpts`).
- **Time:** 10 sampled frames take ~90–130s on CPU — Vercel caps at 10–60s, Modal allows `timeout=300`.
- **Compute:** runs on `cpu=2.0` (no GPU needed for judging) with SAM-box cropping that skips ViTDet (1060→100 ms/frame) + One-Euro smoothing.

Result: a public `POST {MODAL_MHR_URL}/infer` endpoint that turns video frames into 3D joint angles for ~$0.001–0.002/clip. Without it the app still runs — biomech returns `503 MODAL_NOT_CONFIGURED`.

## How the process works

```
Next.js → SAM 3.1 (Meta API): track 2–8 concepts → boxes + masks
Next.js → Modal /infer: { samPerson, videoUrl (signed URL), concepts }
Modal: fetch frames → crop by SAM box → SAM 3D Body → One-Euro filter
       → compute_frame_biomech_and_scene (angles, ROM, flags, CoM/BoS)
Modal → Next.js: { frames[].angles, summary.peakAngles/rom, flags }
Next.js: rate vs activity target → Good / Watch / Needs support
```

One Modal call per clip. Switching U1/U5/U11 views re-filters the same result — no re-bill. Missing ckpts → `503`, no person found → `422`.

## Deploy

```bash
pip install modal
modal token new      # one-time browser login
modal token current  # verify
```

Fetch checkpoints with the script (gated `facebookresearch/sam-3d-body` — request access first, then `HF_TOKEN=hf_...`):

```bash
pip install huggingface_hub
HF_TOKEN=hf_... python modal/fetch_ckpts.py --upload   # downloads + puts both ckpts
modal volume ls sam3db-ckpts   # verify
```

```bash
modal deploy modal/app.py
# prints https://<workspace>--aruga-mhr-infer.modal.run
```

Point Next.js at it (local + Vercel → Settings → Environment Variables → Redeploy):

```env
MODAL_MHR_URL=https://<workspace>--aruga-mhr-infer.modal.run
# no trailing /infer — Next appends it
```

Optional auth: `modal secret create aruga-mhr-env MODAL_SECRET=$(openssl rand -hex 32)` + same `MODAL_SECRET` in Next env (sent as `x-modal-secret`).

## Test

```bash
curl -X POST http://localhost:3000/api/agent/biomech/run \
  -H 'Content-Type: application/json' \
  -d '{"submissionId":"<uuid>","stepSubmissionId":"<uuid>","intent":"U1"}'
# 503 → MODAL_MHR_URL missing or ckpts missing
# 422 → step has no video, or no person detected
# 200 → { frames, summary, concepts }
```

In UI: Therapist → submission → per-step card → U1–U11 dropdown → **Analyze biomechanics (Agent)** → `BiomechPanel` + overlay. Playground: `Tools → Biomechanic Agent` (`/tools/biomech`).

> **Note:** 30s clips on Modal CPU (2 cores) take ~90–130s. Sampling 10 frames spaced across clip; wait a bit longer or check Modal app logs for `processingMs`. For 10× speed redeploy Modal with GPU (see `modal/app.py` cpu→gpu).

## Troubleshooting

| Symptom | Fix |
|---|---|
| `503 MODAL_NOT_CONFIGURED` | `MODAL_MHR_URL` unset — set it, restart / redeploy Next |
| `503 checkpoints not found` | Wrong volume path — re-`put` to `/sam-3d-body-vith/...` (no `/ckpts` prefix) |
| `422 no person detected` | Bad framing/lighting — re-record with full body in frame |
| `401` | `MODAL_SECRET` mismatch — sync both sides, `modal deploy` again |
| Vercel timeout | `vercel.json` sets `maxDuration: 60` — use clips ≤15s on Hobby |
