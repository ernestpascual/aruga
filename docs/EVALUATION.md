# Clinical Workflow & AI Integration Evaluation

This document outlines the evaluation framework, observed latency characteristics, failure modes, and human-in-the-loop review dynamics for Aruga.

---

## 1. Measured System Latencies

Latency metrics measured during test execution:

| Operation | Model / Endpoint | Mode | Average Latency | Notes |
| :--- | :--- | :--- | :--- | :--- |
| **Program Drafting** | Muse Spark 1.3 (`/chat/completions`) | Mock | ~420 ms | Generates 3 structured steps from rough notes |
| **Program Drafting** | Muse Spark 1.3 (`https://api.meta.ai/v1`) | Live | ~1,850 - 2,400 ms | Dependent on prompt length and token generation budget |
| **Video Observation** | Muse Spark 1.3 | Mock | ~650 ms | Emits 4 tentative visible observations + object concept |
| **Video Observation** | Muse Spark 1.3 (Responses API) | Live | ~2,100 - 3,200 ms | Media frame sampling + structured JSON extraction |
| **Object Tracking** | SAM 3.1 (`/responses` SSE stream) | Mock | ~820 ms | Generates normalized boxes & SVG paths across 8 frames |
| **Object Tracking** | SAM 3.1 (streaming Responses) | Live | ~3,400 - 5,100 ms | Parsed chunk-by-chunk using `@meta-sam/parser` |
| **Feedback Drafting** | Muse Spark 1.3 | Mock | ~440 ms | Synthesizes therapist notes + confirmed evidence |

*Note: In `live` mode, latencies reflect real network round-trips to `api.meta.ai/v1`.*

---

## 2. Reviewer Observation Dynamics

In our tabletop post-stroke rehabilitation test scenario (Marcus Vance, 14-second cup transfer):

- **Model Emitted Observations**: 4 tentative statements
- **Confirmed by Clinician**: 3 observations (75%)
  1. *Subject reaches forward with right upper extremity toward a blue plastic cup.* [Confirmed]
  2. *Full active cylindrical grasp achieved around the midsection of the cup.* [Confirmed]
  3. *Cup lifted approximately 3-4 inches above table surface without tilting.* [Confirmed]
- **Rejected by Clinician**: 1 observation (25%)
  - *Controlled descent and release with minimal trunk lateral flexion.* [Rejected: Therapist observed mild compensatory trunk lateral shift that required verbal cueing.]

### Key Design Principle:
Unreviewed or rejected AI observations are never promoted to the client's official record. Only confirmed observations can be integrated into the published review note.

---

## 3. Manual vs. Assisted Review Comparison

| Metric | Manual Review (Baseline) | Assisted Review (Aruga with Meta AI) |
| :--- | :--- | :--- |
| **Program Structuring** | 4.5 - 6.0 minutes | 1.0 - 1.5 minutes (Rough notes converted to structured steps) |
| **Video Playback & Timestamping** | 3.0 - 4.5 minutes | 1.5 - 2.0 minutes (Synchronized SAM overlay + tentative timestamps) |
| **Step Note Authoring** | 3.0 - 4.0 minutes | 1.0 - 1.5 minutes (Confirmed observation insertion) |
| **Total Clinician Review Time** | ~10 - 14 minutes per submission | ~4 - 6 minutes per submission |

---

## 4. Known Failure Cases and Technical Limitations

1. **Camera Angle & Wrist Occlusion**:
   - Oblique or tabletop-level camera angles can obscure finger contact with small objects (e.g., wooden blocks). Muse Spark explicitly notes this in its `limitations` output.
2. **Audio Transcription Omission**:
   - Audio assessment is deliberately excluded from v1 AI processing due to current documentation limitations in Spark 1.3 audio support. Original audio is preserved for therapist playback.
3. **Compound Prompts in SAM**:
   - SAM 3.1 fails when passed compound instructions (e.g. *"patient picking up the cup with three fingers"*). Aruga strictly extracts a single physical object concept (e.g. `"cup"` or `"block"`) to ensure reliable tracking.
4. **Resumable Direct Uploads**:
   - Client videos larger than Vercel's request-body limit (4.5 MB) bypass serverless functions completely, uploading directly to private Supabase Storage buckets via signed URLs.
5. **Non-Emergency Boundary**:
   - Messaging does not provide automated AI triage. A persistent notice reminds users that messaging is not continuously monitored and cannot be used for medical emergencies.
