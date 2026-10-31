# Meta AI Integration Guide: Aruga
**Document Version:** 2.0  
**Updated for Commit:** `e5a7bd6` (feaures 50%)  
**Models Supported:** `muse-spark-1.3`, `sam-3.1`  
**Base URL:** `https://api.meta.ai/v1`  

---

## 1. Overview and Architecture

Aruga integrates **Meta AI** to assist licensed occupational, physical, and speech therapists in clinical routine prescription, kinematic video tracking, multi-box SOAP documentation, and accessible family communication.

All AI interactions adhere to strict **human-in-the-loop clinical governance**: AI outputs are strictly treated as tentative drafts that clinicians must review, confirm, or modify before being made visible to patients.

```
Therapist Instructions ---> [Muse Spark 1.3] ---> Structured Ordered Steps (Preview & Accept)
Client Video Upload  ---> [Muse Spark 1.3] ---> Tentative Observable Actions (Confirmed/Rejected)
                     ---> [SAM 3.1 Stream]  ---> Object Bounding Boxes & SVG Masks (@meta-sam/parser)
Confirmed Evidence   ---> [Muse Spark 1.3] ---> Multi-Box SOAP Notes (Subjective, Objective, Assessment, Plan)
Clinical SOAP Notes  ---> [Muse Spark 1.3] ---> Plain-English Family Summary (Cached in PostgreSQL DB)
```

---

## 2. API Endpoints & Configuration

- **Developer Portal**: `https://dev.meta.ai`
- **Inference Base URL**: `https://api.meta.ai/v1`
- **Supported Models**:
  - `muse-spark-1.3-contributor` (Clinical text reasoning, program drafting, observation drafting)
  - `sam-3.1` (Temporal streaming video object segmentation)

### Environment Configuration
```env
MODEL_API_KEY=your-meta-api-key
META_API_BASE_URL=https://api.meta.ai/v1
AI_MODE=mock # 'off' | 'live' | 'mock'
```

### Operational Modes:
- **`live`**: Dispatches requests directly to `https://api.meta.ai/v1`. Validates target host against `api.meta.ai`.
- **`mock`**: Operates on clinically validated adult, pediatric, and geriatric rehabilitation fixtures.
- **`off`**: Meta AI features are disabled, with clear informational notices for clinicians. Manual authoring and video review remain fully available.

---

## 3. Server-Only Architecture

All Meta AI API interactions are encapsulated in server-only modules under `src/lib/meta/`:
- `client.ts`: Host validation and authenticated HTTP clients.
- `spark.ts`: Structured JSON-schema responses using `muse-spark-1.3`.
- `sam.ts`: Streaming Responses API parser using `@meta-sam/parser`.
- `sam-engines/index.ts`: 7 clinical & environmental keyword engines (700 keywords total).
- `prompts.ts`: Clinical safety prompts enforcing ethical and medical boundaries.
- `schemas.ts`: Zod validation schemas for structured output.
- `errors.ts`: Typed error hierarchy (`MetaApiError`, `MetaTimeoutError`, `MetaRateLimitError`, `MetaRefusalError`, `SamParserError`).

---

## 4. Muse Spark 1.3 Implementations

### A. Program Drafting (`draftHomeProgram`)
- Restructures informal clinician shorthand into sequential exercise steps with target repetitions and duration.
- **Safety Boundary**: Never hallucinates clinical diagnoses or unsupported precautions. Ambiguities are flagged explicitly in a `warnings` array.

### B. Video Observation (`analyzeStepVideo`)
- Emits tentative descriptions of **observable visual actions** (e.g. reaching toward object, cylindrical grasp, lifting object 3 inches vertically).
- Includes approximate timestamps within the clip duration.
- Identifies at most one concrete object concept (e.g. `cup`, `block`, `spoon`) for SAM visual segmentation.

### C. Feedback Drafting (`draftTherapistFeedback`)
- Synthesizes rough clinician notes and **only explicitly confirmed observations**.
- Emits multi-box SOAP feedback:
  - **Subjective**: Patient fatigue, comfort, and verbal statements.
  - **Objective**: Repetitions, hold duration, and kinematic measurements.
  - **Assessment**: Neuromuscular control and compensatory movements.
  - **Plan**: Pacing, resistance adjustments, and next session goals.

### D. Plain-English Client Summary Engine (`/api/ai/soap-summary`)
- Synthesizes complex clinical SOAP notes into a warm, 2–3 sentence takeaway written at a 6th-grade reading level.
- Designed specifically for patients, parents of pediatric clients, and caregivers of older adults.
- **Database Caching Layer**:
  - The API checks PostgreSQL (`soap_notes.client_summary` or `submission_reviews.client_summary`) first.
  - If cached, returns `{ summary, cached: true, source: "database_cache" }` in `<15 ms` with **zero AI inference credits consumed**.
  - If empty, invokes Muse Spark, generates the summary, and immediately persists it back to the database.

---

## 5. SAM 3.1 Streaming Video Segmentation

### Multi-Engine Clinical Keywords (7 Engines, 700 Keywords)
Aruga includes 7 pre-validated clinical and environmental keyword engines:
1. **Pediatric Care Engine** (100 keywords): Fine-motor play tools (crayons, pegboards, bubbles, pop tubes, therapy putty).
2. **Adolescent Care Engine** (100 keywords): Academic & executive function tools (mechanical pencil, geometry compass, locker lock, binder clips).
3. **Adult Rehabilitation Engine** (100 keywords): Stroke & neuro-rehab items (cylindrical cup, weighted fork, therapeutic washcloth, key turner).
4. **Old People (55+) Engine** (100 keywords): Fall prevention & joint mobility items (long-handled shoehorn, button hook, pill organizer, walker grip).
5. **Everyday Home Items Engine** (100 keywords): Toothbrush, television remote, house key, hairbrush, nail clipper.
6. **Everyday School Items Engine** (100 keywords): Safety scissors, glue stick, lunchbox latch, highlighter, eraser cap.
7. **Kitchen Items Engine** (100 keywords): Measuring spoon, spatula, soup ladle, jar opener, vegetable peeler.

*Full taxonomy available in [SAM Engine Keywords Guide](SAM_ENGINE_KEYWORDS.md).*

### Streaming Protocol & Parser:
1. Video URL and object concept (e.g. `"cup"`) are dispatched to `https://api.meta.ai/v1/responses` with `stream: true`.
2. The SSE response stream is consumed using `@meta-sam/parser`:
   ```ts
   import { parseVideoStream, recordsOfKind, decodeMaskToSVGPath } from "@meta-sam/parser";

   const parsedStream = parseVideoStream(sseEventsStream);
   const result = await parsedStream.finalResult;
   const boxRecords = recordsOfKind(result.records, "box");
   const maskRecords = recordsOfKind(result.records, "mask");
   ```
3. Normalized coordinates `[ymin, xmin, ymax, xmax]` and decoded SVG mask paths (`decodeMaskToSVGPath`) are synchronized to video playback in `SamOverlay.tsx`.

### Multi-Target Engine Guards:
- **Single Noun Enforcement**: Rejects compound prompts (`INVALID_SAM_PROMPT`).
- **Concept Deduplication**: Case-insensitive prompt deduplication ensures billing occurs at most once per distinct physical concept.
- **Frame Memory Cache**: Re-segmentation of the same video and concept is served from local frame cache without redundant API calls.
- **Overlap Suppression**: Lower-confidence bounding boxes that overlap with higher-confidence primary targets on the same frame are suppressed to avoid visual clutter.
