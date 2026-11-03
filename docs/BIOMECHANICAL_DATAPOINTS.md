# Aruga Biomech Engine — How It Works, What Insights Mean & How to Read ROM + 3D

> **Live pipeline only — no mock data.** Every frame is real `facebookresearch/sam-3d-body` (MHR) inference on Modal `cpu=2.0`. See `modal/app.py` for the only compute path.

---

## 1. End-to-End Pipeline (4 steps the UI shows)

```
Describe activity → Spark planner → SAM 3.1 segmentation → Modal SAM 3D Body → Compare
```

| Step | What runs | Where | Output | Cost / Time |
|------|-----------|-------|--------|-------------|
| **1 — Plan** | **Spark** (Meta API) picks open-vocabulary `concepts` from 16-keyword allowlist (`src/lib/meta/biomech-planner.ts:64`, `src/lib/meta/biomech-prompt.ts`) | Server `planBiomechConcepts()` | `concepts: ["person","shoulder",...] + rationale` | ~300 ms, fallback heuristic if Spark down |
| **2 — Segment** | **SAM 3.1** `segmentConcepts()` with `boxes+masks` per concept, stitch + track | Server `src/lib/meta/sam-engine.ts` | `samResult.boxes` (xyxy per frame), `tracks`, `failures`, `billedRequests` | 1 credit / request |
| **3 — Pose** | **Modal `/infer`** `modal/app.py` — real SAM 3D Body (`load_sam_3d_body` + `SAM3DBodyEstimator(detector=None)`, `inference_type="body"`), One-Euro filtered, `compute_frame_biomech_and_scene` | Modal `cpu=2.0`, `timeout=300`, `_max_frames_cpu=10` adaptive `step = total_frames // 10` for 30 s clips | `mhr.frames[]` (angles, motionAnnotations, flags, pred_keypoints_2d/3d, sceneUnderstanding, biomechTelemetry) + `mhr.summary` (peakAngles, rom, gait, posturalAndDeformity, sceneSummary) | No mock; 503 if `/ckpts/sam-3d-body-vith` missing, 422 if no person |
| **4 — Moving viz** | Overlay `BiomechOverlay.tsx` + `Motion3DDots` | Client | Skeleton + HUD chips + RangeBars + Sparklines + 3D projection | Real `pred_keypoints_3d` only |

**Spark never invents angles.** It only chooses *which joints to watch*. All numbers come from Step 3.

---

## 2. MHR70 Keypoints — What the Model Actually Sees

SAM 3D Body outputs **70 joints** in camera space (`pred_keypoints_3d: [70,3]` meters, `pred_keypoints_2d: [70,2]` pixels). Aruga uses a stable subset:

| Joint | Index | Used for |
|-------|-------|----------|
| Head / Nose | 0 | Head vector, CoM |
| L_Shoulder / R_Shoulder | 5 / 6 | Shoulder flexion, thorax midpoint |
| L_Elbow / R_Elbow | 7 / 8 | Elbow flexion, forearm axis |
| L_Hip / R_Hip | 9 / 10 | Pelvis midpoint, hip flexion, pelvic obliquity |
| L_Knee / R_Knee | 13 / 14 | Knee flexion, knee valgus |
| L_Ankle / R_Ankle | 15 / 16 | Gait, BoS center |
| R_Thumb_tip / R_Index_tip / R_Mid_tip | 21 / 25 / 29 | R aperture, R wrist flexion |
| R_Wrist | 41 | R wrist + hand |
| L_Thumb_tip / L_Index_tip / L_Mid_tip | 42 / 46 / 50 | L aperture, L wrist flexion |
| L_Wrist | 62 | L wrist + hand |
| Neck | 69 | Neck flex/lateral/rotation |

One-Euro filter (`min_cutoff=1.0, beta=0.007, d_cutoff=1.0`) runs on the 70×3 stream before any angle — `modal/app.py:57 OneEuroFilter3D`.

### Derived Frames (`compute_frame_biomech_and_scene`)

Each frame computes from filtered 70 points (`modal/app.py:104-342`):

```python
pelvis = 0.5*(L_Hip + R_Hip)          # [9,10]
thorax = 0.5*(L_Sh + R_Sh)            # [5,6]
vertical_up = [0, -1, 0]               # camera Y is down
spine_vec = thorax - pelvis
com3d = 0.50*pelvis + 0.35*thorax + 0.15*head + cam_t
bos_center = 0.5*(L_Ank + R_Ank) + cam_t
```

---

## 3. Every Angle / Metric — Formula & Meaning

### 3.1 Big-Muscle Angles

| Metric (per frame) | JSON path | Formula (`modal/app.py`) | What it means |
|--------------------|-----------|--------------------------|---------------|
| **Shoulder flexion L/R** | `angles.shoulderFlex_L/R` `+_signed` `+_motion` | `180 - angle(pelvis, shoulder, elbow)` `:145` | Arm raised forward. Signed by `distal.z - proximal.z` (flexion = forward). Neutral < 7°. |
| **Elbow flexion L/R** | `angles.elbowFlex_L/R` | `180 - angle(shoulder, elbow, wrist)` `:147` | Bending. Neutral < 5°, flex > 15° is real bend. |
| **Hip flexion L/R** | `angles.hipFlex_L/R` | `180 - angle(thorax, hip, knee)` `:149` | Thigh lifted to trunk. |
| **Knee flexion L/R** | `angles.kneeFlex_L/R` | `180 - angle(hip, knee, ankle)` `:151` | Knee bent (always ≥ 0; extension = 0). Used for LB tasks. |
| **Trunk lean (compensation)** | `angles.trunkLean` `+_motion` | `angle(pelvis+verticalUp, pelvis, thorax)` `:155`, **signed** by `thorax.z - pelvis.z < 0` forward | **Not Spark** — SAM3D 70 kpts. How much the trunk leans off vertical. **>8° mild, >14° moderate flag** `:325`. High trunk = shoulder not doing work. |
| **Neck flexion (signed)** | `angles.neckAngles.flexExt` + `flexExt_signed` | `angle(thorax+spine_vec, thorax, head)` `:161`, signed by `head.z - thorax.z` | Forward head. **>25° flag** `neck_compensation_forward_head`. Absolute < 2° snapped to 0 `:166`. |
| **Neck lateral / rotation** | `angles.neckAngles.lateralFlex / rotation` | `arctan2(neck_vec.x, -neck_vec.y)` `:171`, yaw `arctan2(head.x-thorax.x, \|head.z-thorax.z\|)*0.6` `:173` | Side-bend and turn. |
| **Pelvic obliquity / Shoulder tilt** | `angles.pelvicObliquityDeg / shoulderTiltDeg` | `_vector_tilt_deg(l_hip,r_hip)` `:181`, `_vector_tilt_deg(l_sh,r_sh)` `:182` | Side-drop. Shoulder tilt > 6° = `shoulder_hike_compensation`. |
| **Knee valgus L/R** | `angles.kneeValgusDeg_L/R` | `(knee.x - 0.5*(hip.x+ankle.x))*100` `:185` | Knock-knee. |
| **Bilateral asymmetry** | `biomechTelemetry.bilateralAsymmetryIndex` | `|sh_flex_l - sh_flex_r| / mean(sh_flex) *100` `:189` | One side compensating for the other. |
| **CoM & BoS margin** | `biomechTelemetry.com3d / bosMarginMm` | `hypot(com3d.xz - bos_center.xz)*1000` `:178` | Center of mass off base of support. **>140 mm flag** `com_instability_high_sway`. |
| **Movement smoothness** | `biomechTelemetry.movementSmoothnessSparc` | SPARC on wrist speed | Jerkiness indicator. |

### 3.2 Wrist / Hand / Forearm / Thumb (fine motions beyond big muscles)

These grade **tendon gliding** — hook fist, full fist, open hand — not just big reach.

| Metric | JSON | Formula | Meaning |
|--------|------|---------|---------|
| **Wrist flexion L/R** | `angles.wristAngles.flexExt_L/R` `_signed` `_motion` | `180 - angle(elbow, wrist, mid_tip)` `:245` then `_signed_flex` by `mid_tip.z - elbow.z` `:247` | Forearm→hand bend. Flexion = palm down/forward. Flag `wrist_end_range_flexion/extension` if |wrist| > 60° `:333`. |
| **Wrist deviation L/R** | `angles.wristAngles.deviation_L/R` | `_wrist_deviation`: forearm vs hand projected to frontal (z=0), angle + sign by x `:251` | Radial/ulnar tilt. Excess = compensation for grasp. |
| **Finger aperture L/R** | `angles.wristAngles.fingerAperture_L/R_mm` | `‖thumb_tip - index_tip‖*1000` `:268` thumb 21/42, index 25/46 | Thumb-index pinch distance. **<15 mm = `tendon_gliding_full_fist`, >70 mm = `tendon_gliding_open_hand`** `:335`. |
| **Hand closure L/R** | `angles.wristAngles.handClosure_L/R_mm` | `‖thumb_tip - wrist‖*1000` `:271` | Fist tightness. |

> MHR70 indices (verified `modal/app.py:130-139`): R_wrist 41, L_wrist 62, R_thumb 21, R_index 25, R_mid 29, L_thumb 42, L_index 46, L_mid 50, neck 69, hips 9/10.

---

## 4. What “Insights” (Compare) Means — Ratings, Scores, Evidence

`src/lib/meta/biomech-planner.ts:142 deriveExpectation` + `src/app/api/tools/biomech/run/route.ts:130 resolveMetric / 154 insights`

### 4.1 How expectations are chosen (deterministic — no LLM)

| Activity text contains | Expectation added | MetricPath | Target | Unit |
|------------------------|-------------------|------------|--------|------|
| `shoulder/reach/lift/overhead/cup/drink/hair/arm/elbow/hand` | Shoulder flexion | `summary.peakAngles.shoulderFlex_max` | `≥120` | ° |
| `trunk/lean/balance/sit/stand/compensation` | Trunk lean | `frames[].angles.trunkLean_max` else `trunkLean` | `≤8` else `≤12` | ° |
| `neck/head/cervical/chin` | Neck flexion | `summary.peakAngles.neckFlex_max` | `0–30` | ° |
| `hip/knee/ankle/leg/walk/gait/stand/squat` | Knee flexion | `summary.peakAngles.kneeFlex_L_max` | `≥60` | ° |
| `wrist/forearm/hand/finger/thumb/pincer/grasp/tendon gliding/hook/fist/open hand/peg/pinch` (and always 1 wrist posture otherwise) | Wrist flexion (tendons) + Finger aperture + Wrist deviation | `summary.peakAngles.wristFlex_L_max` `10–60`, `summary.rom.fingerAperture_range_mm` `≥18`, `frames[].angles.wristDeviation_max` `≤25` | °/mm/° |
| Always | Base of support | `summary.posturalAndDeformity.meanBosMarginMm` | `≤120` | mm |

Capped to 6 insights (`slice(0,6)`).

### 4.2 Rating & score

`thresholdBand(value, target)` `biomech-planner.ts:178`:

- **Two-sided** (`min`+`max`): `value in [min,max]` → **Good**; within `margin = max(10, (max-min)*0.5)` outside → **Watch** else **Needs support**.
- **One-sided min**: `≥min` Good; `≥min*0.75` Watch else Needs support. (e.g. shoulder ≥120 Good, ≥90 Watch)
- **One-sided max**: `≤max` Good; `≤max*1.4` Watch else Needs support. (e.g. trunk ≤8 Good, ≤11.2 Watch)
- Missing/null → Watch.

Scores: Good 90 / Watch 65 / Needs support 35.

**Adherence** `run/route.ts:186`: `kinematicPct = round((good + watch*0.6)/n *100)`. Label: ≥80 Strong, ≥50 Partial else Needs support. Explanation: `X/n metrics in target; Y borderline. Based on prescribed activity "…"` No checklist in playground (`checklistPct=100`).

**Trend** (if `previousMhr` supplied): `deltaSh = cur shoulderFlex_max - prev shoulderFlex_max`, `direction improving if >2° / regressing if <-2° / stable`, `|deltaSh|>3° = Meaningful else Within measurement noise (±3–5°)`.

### 4.3 Evidence frames

- Trunk: top 3 `|trunkLean|` frames by magnitude.
- Wrist flex/deviation: top 3 `|flexExt_L| / |deviation_L|`.
- Aperture: top 3 `aperture_L/R` largest (open → closed sweep).
- Others: peak value at t=0.

Displayed as `Evidence: metricPath • 0.9s 22° , …` plus computed formula line.

---

## 5. Reading ROM Summary + Flags

**ROM Summary card** (`page.tsx:502`):

| Card | Source | Read as |
|------|--------|---------|
| **Shoulder** | `summary.peakAngles.shoulderFlex_max` | Highest shoulder flexion reached in clip. Compare to target ≥120° for reach tasks. Clip ROM `summary.rom.shoulderFlex_range` = max-min (excursion). |
| **Neck** | `summary.peakAngles.neckFlex_max` | Peak forward head. >30 is excessive for most tasks. |
| **Wrist L (+ R sublabel)** | `summary.peakAngles.wristFlex_L/R_max` | Peak wrist bend per side. Used to grade tendon gliding phases. |
| **Aperture** | `summary.rom.fingerAperture_range_mm` else `peakAngles.fingerAperture_L_max_mm` | How far thumb-index opens across clip. Small range = still gripping / not opening. `>18 mm` range expected for full tendon cycle. |
| **BoS** | `summary.posturalAndDeformity.meanBosMarginMm` | Mean CoM outside BoS. Lower = more stable. >120 mm flagged. |
| **Sway** | `summary.gait.comSwayVelocityMmPerSec` | CoM sway speed. Higher = less stable. |
| **Clip ROM line** | `summary.rom.shoulderFlex_range • neckFlex_range • wristFlex_L/R_range • fingerAperture_range_mm` | Total excursion per clip = available functional range used. |

**Live HUD** (`BiomechLiveHud`): chips update per scrubbed frame; **RangeBars** show current value dot inside `[clip min – clip max]`; **Sparklines** show value across all frames with white dot at `currentTime`.

**Provenance card** (`page.tsx:493`) explains truncation handling: `sceneUnderstanding.isTruncatedByFrameEdge + bboxCoverage`, flag `scene_subject_partially_out_of_frame` when SAM box touches image edge (`x1<=5`/`x2>=w-5`). Angles still computed but marked — check `mhr.frames[].sceneUnderstanding.subjectFrameCoveragePct` + `flags`.

**Flags** (`modal/app.py:324-340`) — per-frame, amber pills:

- `trunk_compensation_mild/moderate` (>8°/>14°)
- `neck_compensation_forward_head` (>25° signed)
- `shoulder_hike_compensation` (tilt >6°)
- `com_instability_high_sway` (BoS margin >140 mm)
- `wrist_end_range_flexion/extension` (|wrist|>60°)
- `tendon_gliding_full_fist` (aperture <15 mm) / `open_hand` (>70 mm)
- `scene_subject_partially_out_of_frame` (truncated)

---

## 6. Reading the 3D Projection (dots) — Whole-Human Map

**Component** `Motion3DDots` `src/app/tools/biomech/page.tsx:551` — `canvas 320px`, `rounded-xl`, `p-4` card below ROM Summary.

### What you're seeing

- **Source**: `mhr.frames[].pred_keypoints_3d` **real only** — 70×3 meters in camera space. Guard `has3d = frames[0].pred_keypoints_3d.length >=30 && Array.isArray([...][0])`. If missing: amber banner `No 3D data — Modal returned 2D only (no mock)`.
- **Centering**: mean of hips `pelvis = (hip9+hip10)/2` subtracted (`center`); fallback mean of all 70 if hips missing. So the body stays in place while you rotate.
- **Auto-fit**: `scale = (min(innerW,innerH)*0.38)/maxAbs`, `maxAbs = max|x,y,z|` of centered cloud + `innerH*0.52` vertical bias. Entire body fits with 22% padding — head never clips.
- **Projection**: orthographic with Euler `ry=rotY°, rx=rotX°` (`project: x1=x*cosY - z*sinY, y1=y*cosX - z1*sinX, z2=...`, screen `cx+x1*s, cy-y1*s`). Depth `z` drives sort + shading.
- **Whole-body bones** (23 edges): `wholeBodyEdges = [0-69-5/6, 5-6, 5-7-62-50/46/42, 6-8-41-29/25/21, 5-11,6-12,11-12,9-11,10-12,9-10,11-13-15-17,12-14-16-20,15-16]` — head-neck-trunk, both arms → wrists → hand tips, hips→knees→ankles→feet. Color by region (teal shoulders, violet L-wrist, pink R-wrist, teal hands) + depth-faded; bones toggle.
- **Dots** (70, depth-sorted, `z` ascending): nose 0 amber r3.4, neck 69 amber r3.0, shoulders 5/6 teal r3.0, elbows/knees/hips r2.6, wrists 62/41 r5.0 violet/pink, hand tips 21/25/29/42/46/50 teal r3.2, feet r2.0, others r2.0. Depth shade `0.55+0.45*((z+0.8)/1.6)` + outer stroke, nearer dots more opaque.
- **Trail** (toggle): real 3D path for `62 L_wrist, 41 R_wrist, 50 L_mid, 29 R_mid, 42 L_thumb, 21 R_thumb` across `frames.length` (adaptive-sampled up to 10 / ~30 s). Violet/pink/teal with `0.55/0.45` alpha.
- **Controls**: `Bones` + `Trail` pills, `Y -75→75°` (yaw) + `X -45→45°` (pitch) sliders (mobile row-split), live label `frame i/n @s • 70 joints • real 3D`.

### How to read it

1. **Scrub video** — canvas tracks `currentTime` (`activeIdx` = nearest `timestampSeconds`). Dots jump to that frame; trail stays for context.
2. **Rotate Y** to see sagittal lean (forward = forward) vs **rotate X** to see frontal sway. Center axes `X→right / Y↑up` grid helps orientation.
3. **Trail loops** = repeated wrist path (e.g., tendon gliding cycles). Wide vs tight = large vs small ROM.
4. **Depth**: nearer dots overlap farther ones (back-to-front draw). Pale = far, vivid = near.
5. **Coverage check**: truncated videos still render but `scene_subject_partially_out_of_frame` warns pelvis centering is approximate.

> No mock fallback — if `pred_keypoints_3d` absent, panel shows diagnostic, not fake dots. Verify in Modal logs `pred_keypoints_3d [10,70,3]` per response.

---

## 7. File Map for Reviewers

| File | Line/section | What to verify |
|------|--------------|----------------|
| `modal/app.py` | `:104 compute_frame_biomech_and_scene`, `:242 wrist section`, `:324 flags`, `:155 trunk` | Real formulas + MHR70 indices |
| `src/lib/meta/biomech-planner.ts` | `:64 Spark prompt`, `:142 deriveExpectation`, `:178 thresholdBand` | Concepts + expectations + ratings |
| `src/app/api/tools/biomech/run/route.ts` | `:130 resolveMetric`, `:154 insights`, `:186 adherence` | Wrist grading wired, no fake angles |
| `src/app/tools/biomech/page.tsx` | `:493 Provenance`, `:502 ROM cards`, `:551 Motion3DDots` | UI shows provenance + ROM + 3D real-only |
| `src/components/therapist/BiomechOverlay.tsx` | `:99 SKELETON_EDGES [7-62-50][8-41-29]`, `:266 LiveHud`, `:207 InVideoHud` | Forearm→wrist→hand visible + wrist HUD + sparklines |

---

## 8. Future 50 Datapoints (reference)

The previous version of this file cataloged 100 functional insights (#51–#100: BADLs, IADLs, Transfers, RULA/REBA/NIOSH/OWAS, MTM) as *computed from the same tensors* (`pred_keypoints_3d`, `pred_vertices`, SAM 3.1 masks). Those remain valid extension points — see git history for the full table and `How to Plug Functional Scoring` snippet for `compute_frame_biomech_and_scene`.
