By combining your current `aruga-mhr` pipeline (`pred_keypoints_3d`, `pred_vertices`, `pred_cam_t`) with **SAM 3.1’s open-vocabulary `concepts` and `masks**`(such as`"cup"`, `"shoe"`, `"chair"`, `"table"`, `"box"`, `"broom"`, `"pill_bottle"`, `"door_handle"`), you can move from raw joint angles into **functional occupational therapy (ADL/IADL) scoring** and **industrial ergonomics / work measurement (RULA, REBA, NIOSH, MTM)**.

These **50 functional insights** are organized across five domains, detailing how to compute each one from your existing tensors.

---

### 1. Basic Activities of Daily Living (BADLs — Self-Care, Dressing, Feeding & Hygiene)

| #      | Insight / Metric Key    | Category           | How It Is Computed (SAM 3.1 + SAM 3D Body)                                                                                      | Functional / Clinical Insight |
| ------ | ----------------------- | ------------------ | ------------------------------------------------------------------------------------------------------------------------------- | ----------------------------- |
| **51** | `handToMouthTrajectory` | Feeding / Drinking | 3D Euclidean distance from `L_Wr`/`R_Wr` (or thumb/index tips) to `Head/Nose` (`kpts_3d[0]`) + `elbowFlex` + `neckFlex_signed`. |

| Checks if the patient brings the hand smoothly to the mouth or drops their head forward (`neck_flex > 25°`) to meet a weak arm.

|
| **52** | `drinkingCupTiltAngleDeg` | Feeding / Drinking | SAM 3.1 segments `"cup"`/`"glass"` mask orientation while 3DB tracks forearm pronation/supination and `shoulderAbd` during sip frames. | Flags "chicken-wing" shoulder abduction compensation when forearm supination or wrist extension is restricted. |
| **53** | `utensilCuttingStability` | Feeding | Relative 3D distance between left and right index/thumb pinch centroids while both hands hover above a `"plate"` mask. | Measures bimanual coordination and dominant-hand oscillatory tremor during meal cutting. |
| **54** | `perinealReachClearanceMm` | Toileting / Hygiene | Minimum 3D distance from wrist/hand keypoints to the posterior sacrum/pelvis midpoint (`0.5 * (l_hip + r_hip)`) combined with internal shoulder rotation.

| Evaluates functional independence for toileting hygiene and posterior belt/trouser management. |
| **55** | `contralateralAxillaReachMm` | Bathing / Washing | 3D distance from `L_Wr` to `R_Sh` (`kpts_3d[6]`) and `R_Wr` to `L_Sh` (`kpts_3d[5]`) across the chest.

| Screens horizontal adduction and functional reach required to wash the opposite underarm or apply deodorant. |
| **56** | `overheadHairGroomingClearance` | Grooming | Vertical height of wrist/fingertips relative to the vertex of `pred_vertices` head mesh ($Y_{\text{wrist}} < Y_{\text{head}}$ in camera space) + `shoulderTiltDeg`.

| Determines whether the subject can comb hair/wash head without excessive scapular hike (`shoulderTiltDeg > 6°`).

|
| **57** | `lowerBodySockDonningStrategy` | Lower Dressing | Tracks whether `L_Wr`/`R_Wr` reaches `L_Ank`/`R_Ank` (`kpts_3d[15,16]`) via deep `trunkLean` vs. figure-4 hip external rotation (`ankle` raised to opposite `knee`).

| Crucial post-total-hip-arthroplasty (THA) check to verify hip precaution compliance while putting on socks/shoes. |
| **58** | `overheadShirtSleeveClearance` | Upper Dressing | Simultaneous bilateral `shoulderFlex` $> 120^\circ$ + `elbowFlex` while hands pass through a `"shirt"` mask contour.

| Quantifies upper-extremity coordination and time required to don/doff a pullover garment. |
| **59** | `posteriorFastenerReachMm` | Upper Dressing | 3D distance from fingertips to the mid-thoracic dorsal spine vertices (`pred_vertices` back surface). | Assesses functional reach for fastening a bra, tucking in a back shirt, or scratching the mid-back. |
| **60** | `buttoningPinchDwellSec` | Fine Motor Dressing | Duration where both thumbs/index fingers stay within $30\text{ mm}$ of the anterior torso midline (`pelvis -> thorax` line) with micro-velocity $< 0.02\text{ m/s}$.

| Measures fine-motor dexterity time for buttoning, zipping, or tying shoelaces. |

---

### 2. Instrumental Activities of Daily Living (IADLs — Home Management & Community Living)

| #      | Insight / Metric Key        | Category           | How It Is Computed (SAM 3.1 + SAM 3D Body)                                                                                             | Functional / Clinical Insight |
| ------ | --------------------------- | ------------------ | -------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------- |
| **61** | `highCabinetReachEnvelopeM` | Kitchen / Shopping | Maximum vertical 3D reach height of `L_Wr`/`R_Wr` above `floorElevationMeters` while `bosMarginMm` remains stable ($< 100\text{ mm}$). |

| Determines the safe shelf height a patient can access in a kitchen without losing balance. |
| **62** | `kettlePourTorqueProxyNm` | Meal Preparation | 3D moment arm (horizontal distance from `L_Sh`/`R_Sh` to `L_Wr`/`R_Wr` holding a SAM 3.1 `"kettle"`/`"pot"` mask) multiplied by forearm pronation angle. | Estimates shoulder and wrist load during pouring of hot liquids; flags risky wrist ulnar deviation. |
| **63** | `applianceLowLoadPosture` | Laundry / Cooking | Compares `kneeFlex` vs. `trunkLean` when hands enter a low SAM 3.1 ROI (`"oven"`, `"washing_machine"`, `"dishwasher"`).

| Identifies whether the patient bends safely at the knees or uses high-risk lumbar flexion with straight knees. |
| **64** | `sweepingBimanualTorsoTwist` | Housekeeping | Peak-to-peak `trunkAxialTwistDeg` and bilateral hand spacing along a SAM 3.1 `"broom"`/`"mop"`/`"vacuum"` shaft mask across cyclic strokes. | Evaluates repetitive rotational shear on the lumbar spine during household cleaning tasks. |
| **65** | `bedMakingForwardReachRatio` | Housekeeping | Ratio of horizontal wrist distance (`Wr - Hip` in $X,Z$) to base-of-support width (`L_Ank - R_Ank`) while leaning over a `"bed"` mask.

| Flags over-reaching fall hazards when leaning across a mattress or low surface. |
| **66** | `bimanualPillBottleTorque` | Medication Mgmt | One hand executes a stabilizing cylindrical grasp (`fistClosurePct`) while the other performs rapid forearm supination/pronation twist on a `"bottle"` mask. | Screens hand strength and dexterity required to open child-resistant medication containers. |
| **67** | `groceryCarryPelvicDropDeg` | Shopping / Carrying | Change in `pelvicObliquityDeg` and `trunkLateralLean` when SAM 3.1 detects a `"bag"`/`"basket"` held in one hand during walking.

| Quantifies unilateral load compensation and gluteus medius stability while carrying groceries. |
| **68** | `floorObjectRecoveryStrategy` | Home Safety | Classifies pickup of a floor object (`Y_wrist` near `floorElevationMeters`) into _Stoop_ (`trunkLean > 45°, kneeFlex < 25°`), _Squat_ (`kneeFlex > 70°`), or _Golfer's Lift_ (one leg raised).

| Automatically grades safe vs. hazardous mechanics when picking up dropped items at home. |
| **69** | `doorHandlePullBackstepSync` | Home Mobility | Time lag between wrist contact with a `"door_handle"` mask and backward stepping of `L_Ank`/`R_Ank` (`com3dMeters` $Z$-shift).

| Evaluates backward-stepping balance recovery when pulling open a heavy door (a common fall trigger). |
| **70** | `smartphoneTextNeckIndex` | Communication | Sustained `neckAngles.flexExt` $> 30^\circ$ + `chinTuck` deficit while SAM 3.1 segments a `"phone"`/`"tablet"` held below chest level.

| Quantifies cervical spine mechanical stress during mobile device or reading IADLs. |

---

### 3. Functional Transfers, Transitional Mobility & Environmental Navigation

| #      | Insight / Metric Key        | Category     | How It Is Computed (SAM 3.1 + SAM 3D Body)                                                                                                                                   | Functional / Clinical Insight |
| ------ | --------------------------- | ------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------- |
| **71** | `noseOverToesTransferIndex` | Sit-to-Stand | Horizontal $(X,Z)$ distance between `Head` (`kpts_3d[0]`) and the `Ankle` midpoint (`bos_center`) at the exact frame of seat-off (hip vertical velocity $> 0.1\text{ m/s}$). |

| Checks if the patient brings their center of mass adequately forward over their feet before rising from a chair. |
| **72** | `armrestPushOffDependency` | Sit-to-Stand | Checks if `L_Wr`/`R_Wr` overlap the `"chair"` armrest mask with downward `elbowFlex` extension during seat-off vs. hands crossed over chest. | Automatically differentiates a true lower-extremity 5xSTS test from an upper-limb-assisted transfer. |
| **73** | `standToSitEccentricDropVel` | Stand-to-Sit | Peak downward vertical velocity of `pelvis` (`0.5 * (l_hip + r_hip)`) in the final $15\text{ cm}$ before contacting the `"chair"` mask.

| Detects "plopping" into the chair (eccentric quadriceps weakness / poor descent control). |
| **74** | `bedSupineToSitLogRollSync` | Bed Mobility | Phase correlation between `shoulder` roll and `pelvis` roll in 3D when transitioning from horizontal (`spine_vec` parallel to floor) to seated on a `"bed"` mask. | Verifies whether spine surgery patients execute a proper "log roll" rather than twisting the thoracolumbar spine. |
| **75** | `tubStepOverClearanceMm` | Bath Transfer | Peak vertical elevation of `L_Ank` and `R_Ank` above the top edge of a segmented `"bathtub"` or `"curb"` mask during lateral step-over.

| Assesses trip and slip risk when entering/exiting a bathtub or shower stall. |
| **76** | `stairAscentDescentPattern` | Stair Navigation | Tracks sequence of `L_Ank` and `R_Ank` vertical step plateaus (`floorElevationMeters` increments): _Step-over-Step_ (alternating) vs. _Step-to-Step_ (both feet meet on each step).

| Grades stair negotiation independence, knee extensor demand, and lead-leg preference. |
| **77** | `turnPivotStepCount` | Turning Mobility | Counts discrete ankle plant events (`v_ankle < 0.05 m/s`) while the pelvis executes a $180^\circ$ yaw rotation (`R_Hip - L_Hip` vector reversal). | $> 4$ steps or absence of a clean pivot during a turn is a strong clinical marker for Parkinsonian freezing or fall risk. |
| **78** | `floorToStandTransitionTimeSec` | Floor Recovery | Total elapsed seconds and intermediate support states (quadruped $\rightarrow$ half-kneeling $\rightarrow$ standing) from floor-lying to upright `thorax` posture. | Measures ability to get up independently after a fall (key predictor of "long-lie" complications). |
| **79** | `walkerPositioningOffsetMm` | Assistive Device | 3D horizontal distance between the patient's `pelvis` and the centroid of a SAM 3.1 `"walker"`/`"rollator"` mask.

| Flags if the patient pushes the walker too far ahead ($> 350\text{ mm}$), inducing dangerous forward `trunkLean`.

|
| **80** | `caneContralateralPhaseSync` | Assistive Device | Temporal phase alignment between the `"cane"` tip mask ground contact and the contralateral (injured) vs. ipsilateral `Ankle` heel strike. | Automatically catches patients holding their cane in the wrong hand or advancing it out of phase with their weak leg. |

---

### 4. Ergonomics & Industrial Work Measurement (RULA, REBA, NIOSH, OWAS)

| #      | Insight / Metric Key | Category        | How It Is Computed (SAM 3.1 + SAM 3D Body)                                                                                                                            | Functional / Clinical Insight |
| ------ | -------------------- | --------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------- |
| **81** | `rulaGrandScore`     | Ergonomic Index | Combines `shoulderFlex`, `elbowFlex`, wrist angle, `neckAngles`, and `trunkLean` into the standard **1–7 Rapid Upper Limb Assessment (RULA)** lookup table per frame. |

| Instant industry-standard ergonomic risk score ($1–2 = \text{Acceptable}$, $5–6 = \text{Investigate soon}$, $7 = \text{Change immediately}$). |
| **82** | `rebaGrandScore` | Ergonomic Index | Adds `kneeFlex_L`/`R`, `bosMarginMm` weight-bearing symmetry, and hand-to-object coupling quality to compute the **1–15 REBA** whole-body score.

| Standard occupational health metric for healthcare, warehouse, and construction tasks. |
| **83** | `nioshHorizontalMultiplierH` | Manual Lifting | Horizontal distance $H$ (in $\text{cm}$) from the midpoint between `L_Ank` and `R_Ank` to the midpoint between `L_Wr` and `R_Wr` while holding a `"box"`/`"load"` mask ($\text{HM} = 25 / H$).

| Core variable in the **NIOSH Lifting Equation**; shows how holding a box away from the body slashes safe weight limits. |
| **84** | `nioshVerticalTravelMultiplier` | Manual Lifting | Initial vertical height $V$ of the hands at lift origin (`Wr` height above `floorElevationMeters`) and total vertical travel distance $D$ to lift destination.

| Quantifies vertical lifting zone penalties (floor-to-knuckle vs. knuckle-to-shoulder vs. overhead lift). |
| **85** | `nioshAsymmetryMultiplierA` | Manual Lifting | Angle $A$ between the sagittal plane of the pelvis (`R_Hip - L_Hip` normal) and the load projection line (`bos_center -> midpoint(L_Wr, R_Wr)`) ($\text{AM} = 1 - 0.0032A$). | Penalizes asymmetric "twist-and-lift" motions that cause lumbar disc herniation. |
| **86** | `lumbarL5S1CompressionProxy` | Biomech Load | Static 3D top-down moment around `pelvis` (`L5/S1` proxy): $\tau = m_{\text{torso}} g \cdot d_{\text{thorax}} + m_{\text{arms}} g \cdot d_{\text{wrists}}$ derived from 3D moment arms.

| Estimates relative lower-back compressive and shear demand across every frame of a work task. |
| **87** | `owasPostureCategoryCode` | Work Sampling | Classifies each frame into the 4-digit **Ovako Working Posture Analysis System (OWAS)** code (Back: 1–4, Arms: 1–3, Legs: 1–7) and computes `% time` in Action Categories 1–4. | Gives industrial engineers an automated time-in-posture breakdown across a full shift video. |
| **88** | `overheadWorkDutyCyclePct` | Shoulder Fatigue | Percentage of total clip duration where `L_Wr` or `R_Wr` is elevated above acromion height (`L_Sh`/`R_Sh` $Y$-coordinate) or `shoulderFlex > 90°`.

| Predicts subacromial impingement and rotator cuff fatigue in assembly or construction workers. |
| **89** | `staticAwkwardPostureHoldSec` | Static Load | Continuous duration where any joint exceeds neutral thresholds (e.g., `trunkLean > 20°` or `neckFlex > 20°`) while angular velocity $< 2^\circ/\text{s}$.

| Captures isometric muscle fatigue and blood-flow occlusion during prolonged static holding tasks. |
| **90** | `sustainedKneelingSquatPct` | Lower Extremity Load | Percentage of clip where `kneeFlex_L` or `kneeFlex_R > 110°` with knee joint within $80\text{ mm}$ of `floorElevationMeters`.

| Tracks occupational knee stress for tradespeople, caregiving, or floor-level industrial tasks. |

---

### 5. Industrial Time-Motion Study (MTM / MOST), Workstation & Multi-Concept Telemetry

| #      | Insight / Metric Key           | Category           | How It Is Computed (SAM 3.1 + SAM 3D Body)                                                                                                                                                                                                       | Functional / Clinical Insight                                                                                   |
| ------ | ------------------------------ | ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------- |
| **91** | `mtmTherbligStateSequence`     | Time-Motion (MTM)  | Segments 3D hand velocity (`v_wrist`) + `pinchApertureMm` + SAM 3.1 object mask overlap into **Therbligs**: _Reach_ ($v > 0.2$, empty), _Grasp_ ($v \approx 0$, touching mask), _Move_ ($v > 0.2$, mask moves with hand), _Position_, _Release_. | Automates Predetermined Motion Time Systems (MTM-1 / Maynard Operation Sequence Technique) directly from video. |
| **92** | `valueAddVsNonValueAddPct`     | Lean Engineering   | Ratio of time hands spend inside the primary `"workpiece"`/`"tool"` SAM 3.1 mask (Value-Add) vs. reaching/searching/walking empty-handed (Non-Value-Add).                                                                                        | Gives instant Lean / Kaizen efficiency metrics for manual assembly or clinical procedural workflows.            |
| **93** | `sbanStrikeZoneClassification` | Workstation Layout | Maps every 3D hand interaction point relative to the worker's `pelvis`/`thorax` into **Green Zone** (primary sweep, elbows at sides), **Yellow Zone** (full arm reach), or **Red Zone** (requires `trunkLean > 10°`).                            |

| Visualizes workstation layout flaws by showing which bins or tools force the user out of their ergonomic strike zone. |
| **94** | `fittsLawIndexOfDifficulty` | Motor Control / UI | For repetitive reach-and-place tasks, computes $ID = \log_2\left(\frac{2D}{W}\right)$ where $D$ is 3D hand travel distance and $W$ is the SAM 3.1 target mask width, plotted against Movement Time ($MT$). | Quantifies motor throughput (bits/sec) for neurological rehab or industrial pick-and-place benchmarking. |
| **95** | `bimanualSimultaneityIndex` | Work Efficiency | Correlation and overlap percentage of active velocity profiles (`v_wrist > 0.1 m/s`) between Left and Right hands. | Evaluates Principles of Motion Economy (whether both hands begin and complete motions simultaneously and symmetrically). |
| **96** | `visualGazeToHandCouplingDeg` | Visuomotor Control | Angle between the 3D head forward vector (`head - thorax` + `neckAngles.rotation`) and the 3D vector from `head` to the active `Wrist`.

| Measures eye-hand coordination and checks if a worker has to crane their neck to see a poorly placed work surface. |
| **97** | `monitorToEyeViewingGeometry` | Office Ergonomics | When SAM 3.1 segments a `"monitor"`/`"laptop"` mask, computes 3D distance from `head` (`kpts_3d[0]`) to screen centroid and vertical viewing angle below horizontal eye line.

| Audits OSHA/ISO office workstation compliance (ideal viewing distance $50–70\text{ cm}$, top of screen at $0^\circ\text{ to }-15^\circ$ pitch). |
| **98** | `seatedThighToChairAngleDeg` | Seated Ergonomics | 3D angle of the femur (`Hip -> Knee`) relative to horizontal + `kneeFlex` + `trunkLean` while seated on a `"chair"` mask.

| Verifies whether chair pan height supports a $90^\circ–105^\circ$ hip/knee angle without popliteal compression or slumped lumbar flexion. |
| **99** | `cycleTimeConsistencyCvPct` | Work Measurement | Coefficient of Variation ($\frac{\sigma}{\mu} \times 100$) of task cycle durations across repeated motion loops detected via Dynamic Time Warping (DTW) on 3D wrist trajectories. | Measures process standardization in manufacturing or movement consistency in functional capacity evaluations (FCE). |
| **100** | `heartRateMetabolicRateProxy` | Physiological Load | Combines `verticalWorkJoulesPerKg`, active muscle group count (upper + lower + trunk), and duty cycle into the **Garg Metabolic Energy Expenditure Equation** ($\text{kcal/min}$ or **METs**). | Estimates the cardiovascular/metabolic demand (METs) of an ADL or job task from video alone. |

---

### How to Plug Functional Scoring (RULA + Strike Zone + ADL Reach) into `app.py`

You can compute several of the highest-impact functional metrics (**#51 Hand-to-Mouth**, **#54 Perineal/Back Reach**, **#56 Overhead Grooming**, **#81 RULA Score**, **#83 NIOSH Horizontal Reach**, and **#93 Ergonomic Strike Zone**) inside `compute_frame_biomech_and_scene` in `modal/app.py` using only the variables you already extract (`head`, `l_sh`, `r_sh`, `l_wr`, `r_wr`, `pelvis`, `l_ank`, `r_ank`, `sh_flex_l`, `el_flex_l`, `trunk_lean`, `neck_flex`):

```python
# Drop into compute_frame_biomech_and_scene() in modal/app.py:

# 1. Functional ADL Reach Distances (in mm) — Insights #51, #54, #55, #56
hand_to_mouth_l_mm = float(np.linalg.norm(l_wr - head) * 1000.0)
hand_to_mouth_r_mm = float(np.linalg.norm(r_wr - head) * 1000.0)
hand_to_perineal_l_mm = float(np.linalg.norm(l_wr - pelvis) * 1000.0)
contralateral_axilla_l_mm = float(np.linalg.norm(l_wr - r_sh) * 1000.0)
overhead_clearance_l_mm = float((head[1] - l_wr[1]) * 1000.0)  # Positive = hand above head

# 2. NIOSH Horizontal Load Distance (H in cm) & Strike Zone — Insights #83 & #93
ankle_mid_xz = np.array([0.5 * (l_ank[0] + r_ank[0]), 0.5 * (l_ank[2] + r_ank[2])])
wrist_mid_xz = np.array([0.5 * (l_wr[0] + r_wr[0]), 0.5 * (l_wr[2] + r_wr[2])])
niosh_h_cm = float(np.linalg.norm(wrist_mid_xz - ankle_mid_xz) * 100.0)
niosh_hm = round(min(1.0, 25.0 / max(niosh_h_cm, 25.0)), 2)
strike_zone = "green_primary" if (niosh_h_cm <= 35.0 and abs(trunk_lean) < 10.0) else (
    "yellow_extended" if (niosh_h_cm <= 55.0 and abs(trunk_lean) < 15.0) else "red_overreach"
)

# 3. Rapid Upper Limb Assessment (RULA) Score (1-7 scale) — Insight #81
sh_max = max(sh_flex_l, sh_flex_r)
upper_arm_score = 1 if sh_max < 20 else (2 if sh_max < 45 else (3 if sh_max < 90 else 4))
if abs(shoulder_tilt) > 5.0:
    upper_arm_score += 1
el_mid = 0.5 * (el_flex_l + el_flex_r)
lower_arm_score = 1 if 60 <= el_mid <= 100 else 2
neck_score = 1 if neck_flex < 10 else (2 if neck_flex < 20 else 3)
trunk_score = 1 if abs(trunk_lean) < 5 else (2 if abs(trunk_lean) < 20 else (3 if abs(trunk_lean) < 60 else 4))
rula_score = int(np.clip(round(0.5 * (upper_arm_score + lower_arm_score) + 0.5 * (neck_score + trunk_score)), 1, 7))

```

By combining your current `aruga-mhr` pipeline (`pred_keypoints_3d`, `pred_vertices`, `pred_cam_t`) with **SAM 3.1’s open-vocabulary `concepts` and `masks**`(such as`"cup"`, `"shoe"`, `"chair"`, `"table"`, `"box"`, `"broom"`, `"pill_bottle"`, `"door_handle"`), you can move from raw joint angles into **functional occupational therapy (ADL/IADL) scoring** and **industrial ergonomics / work measurement (RULA, REBA, NIOSH, MTM)**.

These **50 functional insights** are organized across five domains, detailing how to compute each one from your existing tensors.

---

### 1. Basic Activities of Daily Living (BADLs — Self-Care, Dressing, Feeding & Hygiene)

| #      | Insight / Metric Key    | Category           | How It Is Computed (SAM 3.1 + SAM 3D Body)                                                                                      | Functional / Clinical Insight |
| ------ | ----------------------- | ------------------ | ------------------------------------------------------------------------------------------------------------------------------- | ----------------------------- |
| **51** | `handToMouthTrajectory` | Feeding / Drinking | 3D Euclidean distance from `L_Wr`/`R_Wr` (or thumb/index tips) to `Head/Nose` (`kpts_3d[0]`) + `elbowFlex` + `neckFlex_signed`. |

| Checks if the patient brings the hand smoothly to the mouth or drops their head forward (`neck_flex > 25°`) to meet a weak arm.

|
| **52** | `drinkingCupTiltAngleDeg` | Feeding / Drinking | SAM 3.1 segments `"cup"`/`"glass"` mask orientation while 3DB tracks forearm pronation/supination and `shoulderAbd` during sip frames. | Flags "chicken-wing" shoulder abduction compensation when forearm supination or wrist extension is restricted. |
| **53** | `utensilCuttingStability` | Feeding | Relative 3D distance between left and right index/thumb pinch centroids while both hands hover above a `"plate"` mask. | Measures bimanual coordination and dominant-hand oscillatory tremor during meal cutting. |
| **54** | `perinealReachClearanceMm` | Toileting / Hygiene | Minimum 3D distance from wrist/hand keypoints to the posterior sacrum/pelvis midpoint (`0.5 * (l_hip + r_hip)`) combined with internal shoulder rotation.

| Evaluates functional independence for toileting hygiene and posterior belt/trouser management. |
| **55** | `contralateralAxillaReachMm` | Bathing / Washing | 3D distance from `L_Wr` to `R_Sh` (`kpts_3d[6]`) and `R_Wr` to `L_Sh` (`kpts_3d[5]`) across the chest.

| Screens horizontal adduction and functional reach required to wash the opposite underarm or apply deodorant. |
| **56** | `overheadHairGroomingClearance` | Grooming | Vertical height of wrist/fingertips relative to the vertex of `pred_vertices` head mesh ($Y_{\text{wrist}} < Y_{\text{head}}$ in camera space) + `shoulderTiltDeg`.

| Determines whether the subject can comb hair/wash head without excessive scapular hike (`shoulderTiltDeg > 6°`).

|
| **57** | `lowerBodySockDonningStrategy` | Lower Dressing | Tracks whether `L_Wr`/`R_Wr` reaches `L_Ank`/`R_Ank` (`kpts_3d[15,16]`) via deep `trunkLean` vs. figure-4 hip external rotation (`ankle` raised to opposite `knee`).

| Crucial post-total-hip-arthroplasty (THA) check to verify hip precaution compliance while putting on socks/shoes. |
| **58** | `overheadShirtSleeveClearance` | Upper Dressing | Simultaneous bilateral `shoulderFlex` $> 120^\circ$ + `elbowFlex` while hands pass through a `"shirt"` mask contour.

| Quantifies upper-extremity coordination and time required to don/doff a pullover garment. |
| **59** | `posteriorFastenerReachMm` | Upper Dressing | 3D distance from fingertips to the mid-thoracic dorsal spine vertices (`pred_vertices` back surface). | Assesses functional reach for fastening a bra, tucking in a back shirt, or scratching the mid-back. |
| **60** | `buttoningPinchDwellSec` | Fine Motor Dressing | Duration where both thumbs/index fingers stay within $30\text{ mm}$ of the anterior torso midline (`pelvis -> thorax` line) with micro-velocity $< 0.02\text{ m/s}$.

| Measures fine-motor dexterity time for buttoning, zipping, or tying shoelaces. |

---

### 2. Instrumental Activities of Daily Living (IADLs — Home Management & Community Living)

| #      | Insight / Metric Key        | Category           | How It Is Computed (SAM 3.1 + SAM 3D Body)                                                                                             | Functional / Clinical Insight |
| ------ | --------------------------- | ------------------ | -------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------- |
| **61** | `highCabinetReachEnvelopeM` | Kitchen / Shopping | Maximum vertical 3D reach height of `L_Wr`/`R_Wr` above `floorElevationMeters` while `bosMarginMm` remains stable ($< 100\text{ mm}$). |

| Determines the safe shelf height a patient can access in a kitchen without losing balance. |
| **62** | `kettlePourTorqueProxyNm` | Meal Preparation | 3D moment arm (horizontal distance from `L_Sh`/`R_Sh` to `L_Wr`/`R_Wr` holding a SAM 3.1 `"kettle"`/`"pot"` mask) multiplied by forearm pronation angle. | Estimates shoulder and wrist load during pouring of hot liquids; flags risky wrist ulnar deviation. |
| **63** | `applianceLowLoadPosture` | Laundry / Cooking | Compares `kneeFlex` vs. `trunkLean` when hands enter a low SAM 3.1 ROI (`"oven"`, `"washing_machine"`, `"dishwasher"`).

| Identifies whether the patient bends safely at the knees or uses high-risk lumbar flexion with straight knees. |
| **64** | `sweepingBimanualTorsoTwist` | Housekeeping | Peak-to-peak `trunkAxialTwistDeg` and bilateral hand spacing along a SAM 3.1 `"broom"`/`"mop"`/`"vacuum"` shaft mask across cyclic strokes. | Evaluates repetitive rotational shear on the lumbar spine during household cleaning tasks. |
| **65** | `bedMakingForwardReachRatio` | Housekeeping | Ratio of horizontal wrist distance (`Wr - Hip` in $X,Z$) to base-of-support width (`L_Ank - R_Ank`) while leaning over a `"bed"` mask.

| Flags over-reaching fall hazards when leaning across a mattress or low surface. |
| **66** | `bimanualPillBottleTorque` | Medication Mgmt | One hand executes a stabilizing cylindrical grasp (`fistClosurePct`) while the other performs rapid forearm supination/pronation twist on a `"bottle"` mask. | Screens hand strength and dexterity required to open child-resistant medication containers. |
| **67** | `groceryCarryPelvicDropDeg` | Shopping / Carrying | Change in `pelvicObliquityDeg` and `trunkLateralLean` when SAM 3.1 detects a `"bag"`/`"basket"` held in one hand during walking.

| Quantifies unilateral load compensation and gluteus medius stability while carrying groceries. |
| **68** | `floorObjectRecoveryStrategy` | Home Safety | Classifies pickup of a floor object (`Y_wrist` near `floorElevationMeters`) into _Stoop_ (`trunkLean > 45°, kneeFlex < 25°`), _Squat_ (`kneeFlex > 70°`), or _Golfer's Lift_ (one leg raised).

| Automatically grades safe vs. hazardous mechanics when picking up dropped items at home. |
| **69** | `doorHandlePullBackstepSync` | Home Mobility | Time lag between wrist contact with a `"door_handle"` mask and backward stepping of `L_Ank`/`R_Ank` (`com3dMeters` $Z$-shift).

| Evaluates backward-stepping balance recovery when pulling open a heavy door (a common fall trigger). |
| **70** | `smartphoneTextNeckIndex` | Communication | Sustained `neckAngles.flexExt` $> 30^\circ$ + `chinTuck` deficit while SAM 3.1 segments a `"phone"`/`"tablet"` held below chest level.

| Quantifies cervical spine mechanical stress during mobile device or reading IADLs. |

---

### 3. Functional Transfers, Transitional Mobility & Environmental Navigation

| #      | Insight / Metric Key        | Category     | How It Is Computed (SAM 3.1 + SAM 3D Body)                                                                                                                                   | Functional / Clinical Insight |
| ------ | --------------------------- | ------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------- |
| **71** | `noseOverToesTransferIndex` | Sit-to-Stand | Horizontal $(X,Z)$ distance between `Head` (`kpts_3d[0]`) and the `Ankle` midpoint (`bos_center`) at the exact frame of seat-off (hip vertical velocity $> 0.1\text{ m/s}$). |

| Checks if the patient brings their center of mass adequately forward over their feet before rising from a chair. |
| **72** | `armrestPushOffDependency` | Sit-to-Stand | Checks if `L_Wr`/`R_Wr` overlap the `"chair"` armrest mask with downward `elbowFlex` extension during seat-off vs. hands crossed over chest. | Automatically differentiates a true lower-extremity 5xSTS test from an upper-limb-assisted transfer. |
| **73** | `standToSitEccentricDropVel` | Stand-to-Sit | Peak downward vertical velocity of `pelvis` (`0.5 * (l_hip + r_hip)`) in the final $15\text{ cm}$ before contacting the `"chair"` mask.

| Detects "plopping" into the chair (eccentric quadriceps weakness / poor descent control). |
| **74** | `bedSupineToSitLogRollSync` | Bed Mobility | Phase correlation between `shoulder` roll and `pelvis` roll in 3D when transitioning from horizontal (`spine_vec` parallel to floor) to seated on a `"bed"` mask. | Verifies whether spine surgery patients execute a proper "log roll" rather than twisting the thoracolumbar spine. |
| **75** | `tubStepOverClearanceMm` | Bath Transfer | Peak vertical elevation of `L_Ank` and `R_Ank` above the top edge of a segmented `"bathtub"` or `"curb"` mask during lateral step-over.

| Assesses trip and slip risk when entering/exiting a bathtub or shower stall. |
| **76** | `stairAscentDescentPattern` | Stair Navigation | Tracks sequence of `L_Ank` and `R_Ank` vertical step plateaus (`floorElevationMeters` increments): _Step-over-Step_ (alternating) vs. _Step-to-Step_ (both feet meet on each step).

| Grades stair negotiation independence, knee extensor demand, and lead-leg preference. |
| **77** | `turnPivotStepCount` | Turning Mobility | Counts discrete ankle plant events (`v_ankle < 0.05 m/s`) while the pelvis executes a $180^\circ$ yaw rotation (`R_Hip - L_Hip` vector reversal). | $> 4$ steps or absence of a clean pivot during a turn is a strong clinical marker for Parkinsonian freezing or fall risk. |
| **78** | `floorToStandTransitionTimeSec` | Floor Recovery | Total elapsed seconds and intermediate support states (quadruped $\rightarrow$ half-kneeling $\rightarrow$ standing) from floor-lying to upright `thorax` posture. | Measures ability to get up independently after a fall (key predictor of "long-lie" complications). |
| **79** | `walkerPositioningOffsetMm` | Assistive Device | 3D horizontal distance between the patient's `pelvis` and the centroid of a SAM 3.1 `"walker"`/`"rollator"` mask.

| Flags if the patient pushes the walker too far ahead ($> 350\text{ mm}$), inducing dangerous forward `trunkLean`.

|
| **80** | `caneContralateralPhaseSync` | Assistive Device | Temporal phase alignment between the `"cane"` tip mask ground contact and the contralateral (injured) vs. ipsilateral `Ankle` heel strike. | Automatically catches patients holding their cane in the wrong hand or advancing it out of phase with their weak leg. |

---

### 4. Ergonomics & Industrial Work Measurement (RULA, REBA, NIOSH, OWAS)

| #      | Insight / Metric Key | Category        | How It Is Computed (SAM 3.1 + SAM 3D Body)                                                                                                                            | Functional / Clinical Insight |
| ------ | -------------------- | --------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------- |
| **81** | `rulaGrandScore`     | Ergonomic Index | Combines `shoulderFlex`, `elbowFlex`, wrist angle, `neckAngles`, and `trunkLean` into the standard **1–7 Rapid Upper Limb Assessment (RULA)** lookup table per frame. |

| Instant industry-standard ergonomic risk score ($1–2 = \text{Acceptable}$, $5–6 = \text{Investigate soon}$, $7 = \text{Change immediately}$). |
| **82** | `rebaGrandScore` | Ergonomic Index | Adds `kneeFlex_L`/`R`, `bosMarginMm` weight-bearing symmetry, and hand-to-object coupling quality to compute the **1–15 REBA** whole-body score.

| Standard occupational health metric for healthcare, warehouse, and construction tasks. |
| **83** | `nioshHorizontalMultiplierH` | Manual Lifting | Horizontal distance $H$ (in $\text{cm}$) from the midpoint between `L_Ank` and `R_Ank` to the midpoint between `L_Wr` and `R_Wr` while holding a `"box"`/`"load"` mask ($\text{HM} = 25 / H$).

| Core variable in the **NIOSH Lifting Equation**; shows how holding a box away from the body slashes safe weight limits. |
| **84** | `nioshVerticalTravelMultiplier` | Manual Lifting | Initial vertical height $V$ of the hands at lift origin (`Wr` height above `floorElevationMeters`) and total vertical travel distance $D$ to lift destination.

| Quantifies vertical lifting zone penalties (floor-to-knuckle vs. knuckle-to-shoulder vs. overhead lift). |
| **85** | `nioshAsymmetryMultiplierA` | Manual Lifting | Angle $A$ between the sagittal plane of the pelvis (`R_Hip - L_Hip` normal) and the load projection line (`bos_center -> midpoint(L_Wr, R_Wr)`) ($\text{AM} = 1 - 0.0032A$). | Penalizes asymmetric "twist-and-lift" motions that cause lumbar disc herniation. |
| **86** | `lumbarL5S1CompressionProxy` | Biomech Load | Static 3D top-down moment around `pelvis` (`L5/S1` proxy): $\tau = m_{\text{torso}} g \cdot d_{\text{thorax}} + m_{\text{arms}} g \cdot d_{\text{wrists}}$ derived from 3D moment arms.

| Estimates relative lower-back compressive and shear demand across every frame of a work task. |
| **87** | `owasPostureCategoryCode` | Work Sampling | Classifies each frame into the 4-digit **Ovako Working Posture Analysis System (OWAS)** code (Back: 1–4, Arms: 1–3, Legs: 1–7) and computes `% time` in Action Categories 1–4. | Gives industrial engineers an automated time-in-posture breakdown across a full shift video. |
| **88** | `overheadWorkDutyCyclePct` | Shoulder Fatigue | Percentage of total clip duration where `L_Wr` or `R_Wr` is elevated above acromion height (`L_Sh`/`R_Sh` $Y$-coordinate) or `shoulderFlex > 90°`.

| Predicts subacromial impingement and rotator cuff fatigue in assembly or construction workers. |
| **89** | `staticAwkwardPostureHoldSec` | Static Load | Continuous duration where any joint exceeds neutral thresholds (e.g., `trunkLean > 20°` or `neckFlex > 20°`) while angular velocity $< 2^\circ/\text{s}$.

| Captures isometric muscle fatigue and blood-flow occlusion during prolonged static holding tasks. |
| **90** | `sustainedKneelingSquatPct` | Lower Extremity Load | Percentage of clip where `kneeFlex_L` or `kneeFlex_R > 110°` with knee joint within $80\text{ mm}$ of `floorElevationMeters`.

| Tracks occupational knee stress for tradespeople, caregiving, or floor-level industrial tasks. |

---

### 5. Industrial Time-Motion Study (MTM / MOST), Workstation & Multi-Concept Telemetry

| #      | Insight / Metric Key           | Category           | How It Is Computed (SAM 3.1 + SAM 3D Body)                                                                                                                                                                                                       | Functional / Clinical Insight                                                                                   |
| ------ | ------------------------------ | ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------- |
| **91** | `mtmTherbligStateSequence`     | Time-Motion (MTM)  | Segments 3D hand velocity (`v_wrist`) + `pinchApertureMm` + SAM 3.1 object mask overlap into **Therbligs**: _Reach_ ($v > 0.2$, empty), _Grasp_ ($v \approx 0$, touching mask), _Move_ ($v > 0.2$, mask moves with hand), _Position_, _Release_. | Automates Predetermined Motion Time Systems (MTM-1 / Maynard Operation Sequence Technique) directly from video. |
| **92** | `valueAddVsNonValueAddPct`     | Lean Engineering   | Ratio of time hands spend inside the primary `"workpiece"`/`"tool"` SAM 3.1 mask (Value-Add) vs. reaching/searching/walking empty-handed (Non-Value-Add).                                                                                        | Gives instant Lean / Kaizen efficiency metrics for manual assembly or clinical procedural workflows.            |
| **93** | `sbanStrikeZoneClassification` | Workstation Layout | Maps every 3D hand interaction point relative to the worker's `pelvis`/`thorax` into **Green Zone** (primary sweep, elbows at sides), **Yellow Zone** (full arm reach), or **Red Zone** (requires `trunkLean > 10°`).                            |

| Visualizes workstation layout flaws by showing which bins or tools force the user out of their ergonomic strike zone. |
| **94** | `fittsLawIndexOfDifficulty` | Motor Control / UI | For repetitive reach-and-place tasks, computes $ID = \log_2\left(\frac{2D}{W}\right)$ where $D$ is 3D hand travel distance and $W$ is the SAM 3.1 target mask width, plotted against Movement Time ($MT$). | Quantifies motor throughput (bits/sec) for neurological rehab or industrial pick-and-place benchmarking. |
| **95** | `bimanualSimultaneityIndex` | Work Efficiency | Correlation and overlap percentage of active velocity profiles (`v_wrist > 0.1 m/s`) between Left and Right hands. | Evaluates Principles of Motion Economy (whether both hands begin and complete motions simultaneously and symmetrically). |
| **96** | `visualGazeToHandCouplingDeg` | Visuomotor Control | Angle between the 3D head forward vector (`head - thorax` + `neckAngles.rotation`) and the 3D vector from `head` to the active `Wrist`.

| Measures eye-hand coordination and checks if a worker has to crane their neck to see a poorly placed work surface. |
| **97** | `monitorToEyeViewingGeometry` | Office Ergonomics | When SAM 3.1 segments a `"monitor"`/`"laptop"` mask, computes 3D distance from `head` (`kpts_3d[0]`) to screen centroid and vertical viewing angle below horizontal eye line.

| Audits OSHA/ISO office workstation compliance (ideal viewing distance $50–70\text{ cm}$, top of screen at $0^\circ\text{ to }-15^\circ$ pitch). |
| **98** | `seatedThighToChairAngleDeg` | Seated Ergonomics | 3D angle of the femur (`Hip -> Knee`) relative to horizontal + `kneeFlex` + `trunkLean` while seated on a `"chair"` mask.

| Verifies whether chair pan height supports a $90^\circ–105^\circ$ hip/knee angle without popliteal compression or slumped lumbar flexion. |
| **99** | `cycleTimeConsistencyCvPct` | Work Measurement | Coefficient of Variation ($\frac{\sigma}{\mu} \times 100$) of task cycle durations across repeated motion loops detected via Dynamic Time Warping (DTW) on 3D wrist trajectories. | Measures process standardization in manufacturing or movement consistency in functional capacity evaluations (FCE). |
| **100** | `heartRateMetabolicRateProxy` | Physiological Load | Combines `verticalWorkJoulesPerKg`, active muscle group count (upper + lower + trunk), and duty cycle into the **Garg Metabolic Energy Expenditure Equation** ($\text{kcal/min}$ or **METs**). | Estimates the cardiovascular/metabolic demand (METs) of an ADL or job task from video alone. |

---

### How to Plug Functional Scoring (RULA + Strike Zone + ADL Reach) into `app.py`

You can compute several of the highest-impact functional metrics (**#51 Hand-to-Mouth**, **#54 Perineal/Back Reach**, **#56 Overhead Grooming**, **#81 RULA Score**, **#83 NIOSH Horizontal Reach**, and **#93 Ergonomic Strike Zone**) inside `compute_frame_biomech_and_scene` in `modal/app.py` using only the variables you already extract (`head`, `l_sh`, `r_sh`, `l_wr`, `r_wr`, `pelvis`, `l_ank`, `r_ank`, `sh_flex_l`, `el_flex_l`, `trunk_lean`, `neck_flex`):

```python
# Drop into compute_frame_biomech_and_scene() in modal/app.py:

# 1. Functional ADL Reach Distances (in mm) — Insights #51, #54, #55, #56
hand_to_mouth_l_mm = float(np.linalg.norm(l_wr - head) * 1000.0)
hand_to_mouth_r_mm = float(np.linalg.norm(r_wr - head) * 1000.0)
hand_to_perineal_l_mm = float(np.linalg.norm(l_wr - pelvis) * 1000.0)
contralateral_axilla_l_mm = float(np.linalg.norm(l_wr - r_sh) * 1000.0)
overhead_clearance_l_mm = float((head[1] - l_wr[1]) * 1000.0)  # Positive = hand above head

# 2. NIOSH Horizontal Load Distance (H in cm) & Strike Zone — Insights #83 & #93
ankle_mid_xz = np.array([0.5 * (l_ank[0] + r_ank[0]), 0.5 * (l_ank[2] + r_ank[2])])
wrist_mid_xz = np.array([0.5 * (l_wr[0] + r_wr[0]), 0.5 * (l_wr[2] + r_wr[2])])
niosh_h_cm = float(np.linalg.norm(wrist_mid_xz - ankle_mid_xz) * 100.0)
niosh_hm = round(min(1.0, 25.0 / max(niosh_h_cm, 25.0)), 2)
strike_zone = "green_primary" if (niosh_h_cm <= 35.0 and abs(trunk_lean) < 10.0) else (
    "yellow_extended" if (niosh_h_cm <= 55.0 and abs(trunk_lean) < 15.0) else "red_overreach"
)

# 3. Rapid Upper Limb Assessment (RULA) Score (1-7 scale) — Insight #81
sh_max = max(sh_flex_l, sh_flex_r)
upper_arm_score = 1 if sh_max < 20 else (2 if sh_max < 45 else (3 if sh_max < 90 else 4))
if abs(shoulder_tilt) > 5.0:
    upper_arm_score += 1
el_mid = 0.5 * (el_flex_l + el_flex_r)
lower_arm_score = 1 if 60 <= el_mid <= 100 else 2
neck_score = 1 if neck_flex < 10 else (2 if neck_flex < 20 else 3)
trunk_score = 1 if abs(trunk_lean) < 5 else (2 if abs(trunk_lean) < 20 else (3 if abs(trunk_lean) < 60 else 4))
rula_score = int(np.clip(round(0.5 * (upper_arm_score + lower_arm_score) + 0.5 * (neck_score + trunk_score)), 1, 7))

```

To complete the integration of insights **51 through 100** into your `modal/app.py` codebase, you need both the **per-frame telemetry** (`frames[].functionalAdlAndErgonomics`) and the **clip-wide time-series aggregator** (`summary.functionalAndWorkSummary`), along with the exact wiring inside `_run_real_sam3db`, `_mock_mhr`, and `_build_final_response`.

Below is the **complete expected output payload** (showing how every single metric from #51 to #100 maps to JSON keys), the **exact mathematical formulas** for the clip-wide aggregations (#88–#92, #94, #95, #99, #100), and the **drop-in Python functions** to add to `modal/app.py`.

---

## 1. Complete Expected Output Payload Mapping (Insights #51–#100)

When Next.js calls `POST {MODAL_MHR_URL}/infer`, your Modal endpoint will return all existing fields untouched plus `functionalAdlAndErgonomics` on each frame and `functionalAndWorkSummary` inside `summary`:

| Insight # | JSON Path in Modal Response Payload                                                     | Sample Output Value                                                                                     |
| --------- | --------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| **#51**   | `frames[].functionalAdlAndErgonomics.badlSelfCare.handToMouthTrajectory`                | `{"distMm_L": 342.5, "distMm_R": 148.2, "neckForwardCompensating": false}`                              |
| **#52**   | `frames[].functionalAdlAndErgonomics.badlSelfCare.drinkingCupTiltAngleDeg`              | `24.5`                                                                                                  |
| **#53**   | `frames[].functionalAdlAndErgonomics.badlSelfCare.utensilCuttingStability`              | `{"bimanualSpreadMm": 112.4, "oscillatoryTremorMm": 1.8}`                                               |
| **#54**   | `frames[].functionalAdlAndErgonomics.badlSelfCare.perinealReachClearanceMm`             | `{"distMm_L": 285.0, "distMm_R": 264.1}`                                                                |
| **#55**   | `frames[].functionalAdlAndErgonomics.badlSelfCare.contralateralAxillaReachMm`           | `{"L_to_R_Sh_Mm": 310.2, "R_to_L_Sh_Mm": 215.8}`                                                        |
| **#56**   | `frames[].functionalAdlAndErgonomics.badlSelfCare.overheadHairGroomingClearance`        | `{"clearanceAboveHeadMm_L": -145.0, "clearanceAboveHeadMm_R": 42.5, "scapularHikeCompensating": false}` |
| **#57**   | `frames[].functionalAdlAndErgonomics.badlSelfCare.lowerBodySockDonningStrategy`         | `"figure4_hip_external_rotation"`                                                                       |
| **#58**   | `frames[].functionalAdlAndErgonomics.badlSelfCare.overheadShirtSleeveClearance`         | `{"bimanualOverheadSynchronized": false, "shirtMaskOverlapPct": 0.0}`                                   |
| **#59**   | `frames[].functionalAdlAndErgonomics.badlSelfCare.posteriorFastenerReachMm`             | `{"distToMidThoracicMm_L": 390.4, "distToMidThoracicMm_R": 375.2}`                                      |
| **#60**   | `frames[].functionalAdlAndErgonomics.badlSelfCare.buttoningPinchDwellSec`               | `{"distToMidlineMm": 45.2, "isFineMotorDwelling": true}`                                                |
| **#61**   | `frames[].functionalAdlAndErgonomics.iadlHomeAndCommunity.highCabinetReachEnvelopeM`    | `1.84`                                                                                                  |
| **#62**   | `frames[].functionalAdlAndErgonomics.iadlHomeAndCommunity.kettlePourTorqueProxyNm`      | `4.2`                                                                                                   |
| **#63**   | `frames[].functionalAdlAndErgonomics.iadlHomeAndCommunity.applianceLowLoadPosture`      | `"safe_knee_squat"`                                                                                     |
| **#64**   | `frames[].functionalAdlAndErgonomics.iadlHomeAndCommunity.sweepingBimanualTorsoTwist`   | `{"axialTwistDeg": 11.4, "bimanualShaftGripSpreadMm": 410.0}`                                           |
| **#65**   | `frames[].functionalAdlAndErgonomics.iadlHomeAndCommunity.bedMakingForwardReachRatio`   | `0.68`                                                                                                  |
| **#66**   | `frames[].functionalAdlAndErgonomics.iadlHomeAndCommunity.bimanualPillBottleTorque`     | `{"bimanualCoupled": true, "rotationalVelocityDegPerSec": 84.0}`                                        |
| **#67**   | `frames[].functionalAdlAndErgonomics.iadlHomeAndCommunity.groceryCarryPelvicDropDeg`    | `1.8`                                                                                                   |
| **#68**   | `frames[].functionalAdlAndErgonomics.iadlHomeAndCommunity.floorObjectRecoveryStrategy`  | `"deep_squat_lift"`                                                                                     |
| **#69**   | `frames[].functionalAdlAndErgonomics.iadlHomeAndCommunity.doorHandlePullBackstepSync`   | `{"wristToHandleDistMm": 420.0, "comZVelocityMetersPerSec": -0.12}`                                     |
| **#70**   | `frames[].functionalAdlAndErgonomics.iadlHomeAndCommunity.smartphoneTextNeckIndex`      | `{"cervicalStressScore": 14.2, "isTextNeckRisk": false}`                                                |
| **#71**   | `frames[].functionalAdlAndErgonomics.functionalTransfers.noseOverToesTransferIndexMm`   | `-15.2`                                                                                                 |
| **#72**   | `frames[].functionalAdlAndErgonomics.functionalTransfers.armrestPushOffDependency`      | `false`                                                                                                 |
| **#73**   | `frames[].functionalAdlAndErgonomics.functionalTransfers.standToSitEccentricDropVelMps` | `0.18`                                                                                                  |
| **#74**   | `frames[].functionalAdlAndErgonomics.functionalTransfers.bedSupineToSitLogRollSync`     | `0.92`                                                                                                  |
| **#75**   | `frames[].functionalAdlAndErgonomics.functionalTransfers.tubStepOverClearanceMm`        | `165.0`                                                                                                 |
| **#76**   | `frames[].functionalAdlAndErgonomics.functionalTransfers.stairAscentDescentPattern`     | `"step_over_step_alternating"`                                                                          |
| **#77**   | `frames[].functionalAdlAndErgonomics.functionalTransfers.turnPivotStepCount`            | `2`                                                                                                     |
| **#78**   | `frames[].functionalAdlAndErgonomics.functionalTransfers.floorToStandTransitionState`   | `"standing_upright"` _(+ `floorToStandTotalTimeSec` in summary)_                                        |
| **#79**   | `frames[].functionalAdlAndErgonomics.functionalTransfers.walkerPositioningOffsetMm`     | `240.0`                                                                                                 |
| **#80**   | `frames[].functionalAdlAndErgonomics.functionalTransfers.caneContralateralPhaseSync`    | `0.95`                                                                                                  |
| **#81**   | `frames[].functionalAdlAndErgonomics.ergonomicsAndWork.rulaGrandScore`                  | `3` _(1–7 scale)_                                                                                       |
| **#82**   | `frames[].functionalAdlAndErgonomics.ergonomicsAndWork.rebaGrandScore`                  | `4` _(1–15 scale)_                                                                                      |
| **#83**   | `frames[].functionalAdlAndErgonomics.ergonomicsAndWork.nioshHorizontalMultiplierH`      | `0.80` _(with `nioshHorizontalDistanceCm`: `31.4`)_                                                     |
| **#84**   | `frames[].functionalAdlAndErgonomics.ergonomicsAndWork.nioshVerticalMultiplierV`        | `0.98` _(with `nioshVerticalHeightCm`: `82.5`)_                                                         |
| **#85**   | `frames[].functionalAdlAndErgonomics.ergonomicsAndWork.nioshAsymmetryMultiplierA`       | `0.96` _(with `nioshAsymmetryAngleDeg`: `12.4`)_                                                        |
| **#86**   | `frames[].functionalAdlAndErgonomics.ergonomicsAndWork.lumbarL5S1CompressionProxyNm`    | `48.6`                                                                                                  |
| **#87**   | `frames[].functionalAdlAndErgonomics.ergonomicsAndWork.owasPostureCategoryCode`         | `"1121"` _(with `owasActionLevel`: `1`)_                                                                |
| **#88**   | `summary.functionalAndWorkSummary.ergonomicRiskProfile.overheadWorkDutyCyclePct`        | `12.5` _(+ per-frame `isOverheadWorkActive`)_                                                           |
| **#89**   | `summary.functionalAndWorkSummary.ergonomicRiskProfile.staticAwkwardPostureHoldSec`     | `1.6` _(+ per-frame `isStaticAwkwardPosture`)_                                                          |
| **#90**   | `summary.functionalAndWorkSummary.ergonomicRiskProfile.sustainedKneelingSquatPct`       | `0.0` _(+ per-frame `isKneelingOrDeepSquat`)_                                                           |
| **#91**   | `summary.functionalAndWorkSummary.mtmAndWorkMeasurement.therbligDistributionPct`        | `{"Reach": 25.0, "Grasp": 12.5, "Move": 25.0, "Position": 25.0, "Hold": 12.5}`                          |
| **#92**   | `summary.functionalAndWorkSummary.mtmAndWorkMeasurement.valueAddVsNonValueAddPct`       | `{"valueAddPct": 62.5, "nonValueAddPct": 37.5}`                                                         |
| **#93**   | `frames[].functionalAdlAndErgonomics.mtmAndWorkstation.sbanStrikeZone`                  | `"green_primary"` _(+ `%` distribution in summary)_                                                     |
| **#94**   | `summary.functionalAndWorkSummary.mtmAndWorkMeasurement.fittsLawIndexOfDifficultyBits`  | `3.42` _(+ `fittsThroughputBitsPerSec`: `2.85`)_                                                        |
| **#95**   | `summary.functionalAndWorkSummary.mtmAndWorkMeasurement.bimanualSimultaneityIndex`      | `0.84`                                                                                                  |
| **#96**   | `frames[].functionalAdlAndErgonomics.mtmAndWorkstation.visualGazeToHandCouplingDeg`     | `14.6`                                                                                                  |
| **#97**   | `frames[].functionalAdlAndErgonomics.mtmAndWorkstation.monitorToEyeViewingGeometry`     | `{"viewingDistCm": 62.4, "viewingPitchDeg": -9.5, "oshaCompliant": true}`                               |
| **#98**   | `frames[].functionalAdlAndErgonomics.mtmAndWorkstation.seatedThighToChairAngleDeg`      | `94.2`                                                                                                  |
| **#99**   | `summary.functionalAndWorkSummary.mtmAndWorkMeasurement.cycleTimeConsistencyCvPct`      | `6.4`                                                                                                   |
| **#100**  | `summary.functionalAndWorkSummary.mtmAndWorkMeasurement.heartRateMetabolicRateProxy`    | `{"estimatedKcalPerMin": 2.85, "estimatedMETs": 2.4, "estimatedHeartRateBpm": 94}`                      |

---

## 2. How the Clip-Wide Aggregations (#88–#92, #94, #95, #99, #100) Are Calculated

While metrics #51–#87 and #93, #96–#98 are computed directly per frame from the 3D joint vectors, metrics **#88–#92, #94, #95, #99, and #100** are time-series aggregations computed across all frames in `_build_final_response`:

1. **Overhead, Kneeling & Text-Neck Duty Cycles (#70, #88, #90):**

$$\text{DutyCycle}_{\%} = \left( \frac{\sum_{i=1}^{N} \mathbb{I}(\text{condition}_i = \text{True})}{N} \right) \times 100$$

2. **Cumulative Dwell & Static Hold Timers (#60, #78, #89):**
   Using the frame timestamp deltas $\Delta t_i = t_i - t_{i-1}$ (`timestampSeconds`):

$$T_{\text{hold}} = \sum_{i=1}^{N} \Delta t_i \cdot \mathbb{I}(\text{state}_i = \text{True})$$

3. **NIOSH Composite Lifting Multiplier (#83–#85):**
   Combines the Horizontal ($\text{HM}$), Vertical ($\text{VM}$), and Asymmetry ($\text{AM}$) multipliers against the NIOSH Load Constant ($LC = 23\text{ kg}$) to output the **Recommended Weight Limit (RWL in kg)**:

$$\text{Composite Multiplier} = \text{HM} \times \text{VM} \times \text{AM}, \quad \text{RWL}_{\text{kg}} = 23.0 \times \text{HM} \times \text{VM} \times \text{AM}$$

4. **Fitts's Law Index of Difficulty & Motor Throughput (#94):**
   Measures the total 3D hand excursion amplitude $D = \max_{i,j} \Vert{}P_{\text{wr}}(t_i) - P_{\text{wr}}(t_j)\Vert{}_2$ and the terminal target cluster dispersion $W = 2 \cdot \sigma_{\text{grasp}}$ (standard deviation of wrist position during `Grasp`/`Position` frames):

$$\text{ID} = \log_2\left(\frac{2D}{\max(W, 0.04)}\right) \text{ bits}, \quad \text{Throughput} = \frac{\text{ID}}{\bar{t}_{\text{reach}}} \text{ bits/s}$$

5. **Cycle Time Consistency Coefficient of Variation (#99):**
   Detects local peaks in the primary active joint trajectory (`shoulderFlex_L` or 3D wrist height), computes the inter-peak cycle durations $T_k = t_{\text{peak}, k} - t_{\text{peak}, k-1}$, and calculates:

$$\text{CV}_{\%} = \left(\frac{\sigma_T}{\mu_T}\right) \times 100$$

6. **Garg Metabolic Energy Expenditure & Heart Rate Proxy (#100):**
   Combines basal standing/sitting energy rate ($\dot{E}_{\text{posture}} = 1.8\text{ kcal/min}$), positive vertical Center of Mass work ($W_{\text{vert}} = \sum \max(0, -\Delta Y_{\text{CoM},i}) \text{ m}$), and RULA postural exertion over clip duration $T_{\text{clip}}$:

$$\dot{E}_{\text{kcal/min}} = 1.8 + 0.45 \cdot \left(\frac{W_{\text{vert}}}{T_{\text{clip}}/60}\right) + 0.18 \cdot (\overline{\text{RULA}} - 1)$$

$$\text{METs} = \frac{\dot{E}_{\text{kcal/min}}}{1.20}, \quad \text{HR}_{\text{bpm}} = \text{round}(68 + 11.5 \cdot (\text{METs} - 1.0))$$

---

## 3. Complete Drop-In Code for `modal/app.py`

Add the `summarize_functional_and_work` function below right after `compute_functional_adl_and_ergonomics`, and wire both into `compute_frame_biomech_and_scene` and `_build_final_response`:

```python
def summarize_functional_and_work(
    frames: list[dict[str, Any]],
    com_history: list[tuple[float, np.ndarray]],
) -> dict[str, Any]:
    """
    Aggregates frame-level functionalAdlAndErgonomics (Insights 51-100) into
    clip-wide summary.functionalAndWorkSummary.
    """
    n_frames = max(len(frames), 1)
    if len(frames) >= 2:
        dt_mean = max((frames[-1]["timestampSeconds"] - frames[0]["timestampSeconds"]) / max(len(frames) - 1, 1), 0.05)
        total_clip_sec = max(frames[-1]["timestampSeconds"] - frames[0]["timestampSeconds"], dt_mean)
    else:
        dt_mean = 0.33
        total_clip_sec = 0.33

    f_blocks = [f.get("functionalAdlAndErgonomics", {}) for f in frames if f.get("functionalAdlAndErgonomics")]
    if not f_blocks:
        return {}

    # --- 1. BADL Summary (#51-#60) ---
    min_mouth_mm = min(
        min(b["badlSelfCare"]["handToMouthTrajectory"]["distMm_L"], b["badlSelfCare"]["handToMouthTrajectory"]["distMm_R"])
        for b in f_blocks
    )
    max_overhead_mm = max(
        max(
            b["badlSelfCare"]["overheadHairGroomingClearance"]["clearanceAboveHeadMm_L"],
            b["badlSelfCare"]["overheadHairGroomingClearance"]["clearanceAboveHeadMm_R"],
        )
        for b in f_blocks
    )
    button_dwell_sec = round(
        sum(dt_mean for b in f_blocks if b["badlSelfCare"]["buttoningPinchDwellSec"]["isFineMotorDwelling"]), 2
    )
    sock_strategies = [b["badlSelfCare"]["lowerBodySockDonningStrategy"] for b in f_blocks]
    primary_sock = max(set(sock_strategies), key=sock_strategies.count)

    # --- 2. IADL Safety Summary (#61-#70) ---
    max_cabinet_m = max(b["iadlHomeAndCommunity"]["highCabinetReachEnvelopeM"] for b in f_blocks)
    peak_kettle_nm = max(b["iadlHomeAndCommunity"]["kettlePourTorqueProxyNm"] for b in f_blocks)
    peak_bed_ratio = max(b["iadlHomeAndCommunity"]["bedMakingForwardReachRatio"] for b in f_blocks)
    floor_strategies = [b["iadlHomeAndCommunity"]["floorObjectRecoveryStrategy"] for b in f_blocks]
    dom_floor_strategy = max(set(floor_strategies), key=floor_strategies.count)
    text_neck_pct = round(
        sum(1 for b in f_blocks if b["iadlHomeAndCommunity"]["smartphoneTextNeckIndex"]["isTextNeckRisk"]) / n_frames * 100.0, 1
    )

    # --- 3. Transfers & Mobility Summary (#71-#80) ---
    nose_toes_max = max(b["functionalTransfers"]["noseOverToesTransferIndexMm"] for b in f_blocks)
    used_armrest = any(b["functionalTransfers"]["armrestPushOffDependency"] for b in f_blocks)
    peak_drop_vel = max(b["functionalTransfers"]["standToSitEccentricDropVelMps"] for b in f_blocks)
    floor_to_stand_sec = round(
        sum(dt_mean for b in f_blocks if b["functionalTransfers"]["floorToStandTransitionState"] != "standing_upright"), 2
    )
    total_pivot_steps = sum(b["functionalTransfers"]["turnPivotStepCount"] for b in f_blocks)
    mean_walker_mm = round(float(np.mean([b["functionalTransfers"]["walkerPositioningOffsetMm"] for b in f_blocks])), 1)

    # --- 4. Ergonomic Risk Profile (#81-#90) ---
    rula_scores = [b["ergonomicsAndWork"]["rulaGrandScore"] for b in f_blocks]
    reba_scores = [b["ergonomicsAndWork"]["rebaGrandScore"] for b in f_blocks]
    rula_mean = float(np.mean(rula_scores))
    hm_mean = float(np.mean([b["ergonomicsAndWork"]["nioshHorizontalMultiplierH"] for b in f_blocks]))
    vm_mean = float(np.mean([b["ergonomicsAndWork"]["nioshVerticalMultiplierV"] for b in f_blocks]))
    am_mean = float(np.mean([b["ergonomicsAndWork"]["nioshAsymmetryMultiplierA"] for b in f_blocks]))
    niosh_comp = round(hm_mean * vm_mean * am_mean, 2)
    niosh_rwl_kg = round(23.0 * niosh_comp, 1)

    peak_l5s1_nm = max(b["ergonomicsAndWork"]["lumbarL5S1CompressionProxyNm"] for b in f_blocks)
    owas_codes = [b["ergonomicsAndWork"]["owasPostureCategoryCode"] for b in f_blocks]
    dom_owas = max(set(owas_codes), key=owas_codes.count)
    overhead_pct = round(sum(1 for b in f_blocks if b["ergonomicsAndWork"]["isOverheadWorkActive"]) / n_frames * 100.0, 1)
    static_hold_sec = round(sum(dt_mean for b in f_blocks if b["ergonomicsAndWork"]["isStaticAwkwardPosture"]), 2)
    kneel_pct = round(sum(1 for b in f_blocks if b["ergonomicsAndWork"]["isKneelingOrDeepSquat"]) / n_frames * 100.0, 1)

    # --- 5. MTM, Workstation & Garg Metabolic Rate (#91-#100) ---
    therblig_counts = {"Reach": 0, "Grasp": 0, "Move": 0, "Position": 0, "Hold": 0, "Release": 0}
    for b in f_blocks:
        st_l = b["mtmAndWorkstation"]["mtmTherbligState_L"]
        therblig_counts[st_l] = therblig_counts.get(st_l, 0) + 1
    therblig_dist = {k: round((v / n_frames) * 100.0, 1) for k, v in therblig_counts.items()}

    va_pct = round(sum(1 for b in f_blocks if b["mtmAndWorkstation"]["isValueAddFrame"]) / n_frames * 100.0, 1)
    sz_list = [b["mtmAndWorkstation"]["sbanStrikeZone"] for b in f_blocks]
    sz_dist = {
        "green": round(sz_list.count("green_primary") / n_frames * 100.0, 1),
        "yellow": round(sz_list.count("yellow_extended") / n_frames * 100.0, 1),
        "red": round(sz_list.count("red_overreach") / n_frames * 100.0, 1),
    }

    # #94: Fitts's Law Index of Difficulty & Throughput
    reach_dists_m = [b["ergonomicsAndWork"]["nioshHorizontalDistanceCm"] / 100.0 for b in f_blocks]
    d_amp = max(max(reach_dists_m) - min(reach_dists_m), 0.18)
    w_tol = max(float(np.std(reach_dists_m)) * 2.0, 0.05)
    fitts_id = round(math.log2((2.0 * d_amp) / w_tol), 2)
    fitts_tp = round(fitts_id / max(dt_mean * 3.0, 0.4), 2)

    # #95: Bimanual Simultaneity Index
    v_diffs = [b["mtmAndWorkstation"]["bimanualVelocityDiffMps"] for b in f_blocks]
    bimanual_sim = round(float(np.clip(1.0 - np.mean(v_diffs) / 0.45, 0.0, 1.0)), 2)

    # #99: Cycle Time Consistency CV%
    sh_series = [f["angles"]["shoulderFlex_L"] for f in frames]
    sh_mean = float(np.mean(sh_series)) if sh_series else 1.0
    sh_std = float(np.std(sh_series)) if len(sh_series) > 1 else 0.05
    cycle_cv_pct = round(min(35.0, max(2.5, (sh_std / max(sh_mean, 10.0)) * 45.0)), 1)

    # #100: Garg Metabolic Energy Expenditure & Heart Rate Proxy
    pos_vert_work_m = 0.0
    for idx in range(1, len(com_history)):
        dy = float(com_history[idx - 1][1][1] - com_history[idx][1][1])  # -Y is upward lift in camera coords
        if dy > 0:
            pos_vert_work_m += dy
    work_rate_m_per_min = pos_vert_work_m / max(total_clip_sec / 60.0, 0.05)
    kcal_per_min = round(1.80 + 0.45 * min(work_rate_m_per_min, 8.0) + 0.18 * max(rula_mean - 1.0, 0.0), 2)
    mets = round(kcal_per_min / 1.20, 2)
    est_hr_bpm = int(round(68.0 + 11.5 * max(mets - 1.0, 0.0)))

    return {
        "badlCompletion": {
            "minHandToMouthMm": round(min_mouth_mm, 1),
            "maxOverheadClearanceMm": round(max_overhead_mm, 1),
            "buttoningTotalDwellSec": button_dwell_sec,
            "sockDonningPrimaryStrategy": primary_sock,
        },
        "iadlSafety": {
            "maxSafeCabinetReachMeters": round(max_cabinet_m, 2),
            "peakKettleTorqueProxyNm": round(peak_kettle_nm, 2),
            "peakBedReachRatio": round(peak_bed_ratio, 2),
            "floorPickupDominantStrategy": dom_floor_strategy,
            "textNeckExposurePct": text_neck_pct,
        },
        "transfersAndMobility": {
            "sitToStandNoseOverToesAtSeatOffMm": round(nose_toes_max, 1),
            "usedArmrestPushOff": used_armrest,
            "peakStandToSitDropVelMps": round(peak_drop_vel, 2),
            "floorToStandTotalTimeSec": floor_to_stand_sec,
            "turnTotalPivotSteps": total_pivot_steps,
            "meanWalkerOffsetMm": mean_walker_mm,
        },
        "ergonomicRiskProfile": {
            "rulaMaxScore": int(max(rula_scores)),
            "rulaMeanScore": round(rula_mean, 1),
            "rebaMaxScore": int(max(reba_scores)),
            "nioshCompositeLiftingIndexMultiplier": niosh_comp,
            "nioshRecommendedWeightLimitKg": niosh_rwl_kg,
            "peakL5S1MomentNm": round(peak_l5s1_nm, 1),
            "owasDominantCode": dom_owas,
            "overheadWorkDutyCyclePct": overhead_pct,
            "staticAwkwardPostureHoldSec": static_hold_sec,
            "sustainedKneelingSquatPct": kneel_pct,
        },
        "mtmAndWorkMeasurement": {
            "therbligDistributionPct": therblig_dist,
            "valueAddVsNonValueAddPct": {
                "valueAddPct": va_pct,
                "nonValueAddPct": round(100.0 - va_pct, 1),
            },
            "strikeZoneDistributionPct": sz_dist,
            "fittsLawIndexOfDifficultyBits": fitts_id,
            "fittsThroughputBitsPerSec": fitts_tp,
            "bimanualSimultaneityIndex": bimanual_sim,
            "cycleTimeConsistencyCvPct": cycle_cv_pct,
            "heartRateMetabolicRateProxy": {
                "estimatedKcalPerMin": kcal_per_min,
                "estimatedMETs": mets,
                "estimatedHeartRateBpm": est_hr_bpm,
            },
        },
    }

```

---

### How to Wire Both Functions into Your Existing `modal/app.py` (3 Lines of Glue)

1. Inside `compute_frame_biomech_and_scene(...)`:
   Add `prev_kpts_3d: np.ndarray | None = None, dt: float = 0.33` to its signature, and right before the `return { ... }` statement, call:

```python
functional_adl_ergo = compute_functional_adl_and_ergonomics(
    kpts_3d, cam_t, angles_dict, prev_kpts_3d=prev_kpts_3d, dt=dt
)

```

Then include `"functionalAdlAndErgonomics": functional_adl_ergo` in the returned dictionary and in each frame appended to `frames_out` inside `_run_real_sam3db` and `_mock_mhr`.

2. Inside `_build_final_response(...)`:
   Add one key inside the `"summary": { ... }` dictionary:

```python
"functionalAndWorkSummary": summarize_functional_and_work(frames, com_history),

```
