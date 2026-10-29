# Meta AI Integration Guide: Aruga

## 1. Overview and Architecture

Aruga integrates **Meta AI** directly using official Meta API endpoints to assist licensed therapists with two critical tasks:
1. **Program Drafting & Instruction Clarification**: Powered by **Muse Spark 1.3** (`muse-spark-1.3`).
2. **Tabletop Object Tracking & Video Observation**: Powered by **SAM 3.1** (`sam-3.1`) and Muse Spark 1.3.

All AI interactions adhere to strict clinician oversight: AI results are always tentative draft suggestions that therapists must preview, confirm, or reject before any content is published to a client.

```
Therapist Instructions ---> [Muse Spark 1.3] ---> Structured Ordered Steps (Preview & Accept)
Client Video Upload  ---> [Muse Spark 1.3] ---> Tentative Observable Actions (Confirmed/Rejected)
                     ---> [SAM 3.1 Stream]  ---> Object Bounding Boxes & SVG Masks (@meta-sam/parser)
Confirmed Evidence   ---> [Muse Spark 1.3] ---> Draft Step Notes & Overall Feedback (Clinician Review)
```

---

## 2. API Endpoints & Configuration

- **Developer Documentation**: `https://dev.meta.ai`
- **Official Inference Base URL**: `https://api.meta.ai/v1`
- **Models**:
  - `muse-spark-1.2-contributor` (default for chat)
  - `muse-spark-1.3-contributor`
  - `muse-wonder-1.0`
  - `sam-3.1`

### Environment Configuration
```env
MODEL_API_KEY=your-meta-api-key
META_API_BASE_URL=https://api.meta.ai/v1
AI_MODE=mock # 'off' | 'live' | 'mock'
```

### AI Modes:
- **`live`**: Directly sends requests to `https://api.meta.ai/v1`. Validates base host against `api.meta.ai`.
- **`mock`**: Operates on clinically realistic adult tabletop fixtures. Displays a persistent `[Mock AI Fixture]` badge in the interface.
- **`off`**: Meta AI features are disabled, with clear informational notices for clinicians. Manual authoring and video review remain fully available.

*Note: The platform never silently falls back from live to mock.*

---

## 3. Server-Only Architecture

All API calls to Meta are strictly encapsulated in server-only modules:
- `src/lib/meta/client.ts`: Host validation and authenticated HTTP clients.
- `src/lib/meta/spark.ts`: Structured JSON-schema responses using `muse-spark-1.3`.
- `src/lib/meta/sam.ts`: Streaming Responses API parser using `@meta-sam/parser`.
- `src/lib/meta/prompts.ts`: Clinical safety prompts enforcing ethical boundaries.
- `src/lib/meta/schemas.ts`: Zod validation schemas for structured output.
- `src/lib/meta/errors.ts`: Typed error hierarchy (`MetaApiError`, `MetaTimeoutError`, `MetaRateLimitError`, `MetaRefusalError`, `SamParserError`).
- `src/lib/meta-ai.ts`: High-level application service interface.
- `src/types/meta.ts`: Browser-safe shared TypeScript contracts.

---

## 4. Muse Spark 1.3 Implementation

### A. Program Drafting (`draftHomeProgram`)
- Accepts therapist rough notes and optional discipline label.
- Restructures compound instructions into sequential steps with clear pacing.
- **Safety constraint**: Never invents new clinical diagnoses, medication advice, or ungrounded precautions. Ambiguities are flagged explicitly in a `warnings` array.
- Requires therapist preview and explicit acceptance before updating the editor.

### B. Video Observation (`analyzeStepVideo`)
- Reviews uploaded video via Meta Responses media format.
- Generates tentative descriptions of **observable visual actions** (e.g., reaching toward object, cylindrical grasp, lifting object 3 inches).
- Includes approximate timestamps within the clip duration.
- Identifies at most one concrete object concept (e.g. `cup`, `block`, `spoon`) for SAM visual segmentation.
- Notes environmental limitations (camera angle, lighting, occlusion).

### C. Feedback Drafting (`draftTherapistFeedback`)
- Synthesizes rough clinician notes and **only explicitly confirmed observations**.
- Recommends draft step notes and empathetic overall feedback.
- Leaves content editable; remains completely private to the therapist until published atomically.

---

## 5. SAM 3.1 Streaming Video Segmentation

SAM 3.1 tracks discrete physical objects across video frames.

### Streaming Protocol & Parser:
1. Video URL and object concept (e.g. `"cup"`) are sent to `https://api.meta.ai/v1/responses` with `stream: true`.
2. The SSE response stream is consumed using `@meta-sam/parser`:
   ```ts
   import { parseVideoStream, recordsOfKind, frameIndexOf, decodeMaskToSVGPath } from "@meta-sam/parser";

   const parsedStream = parseVideoStream(sseEventsStream);
   const result = await parsedStream.finalResult;
   const boxRecords = recordsOfKind(result.records, "box");
   const maskRecords = recordsOfKind(result.records, "mask");
   ```
3. Normalized coordinates `[ymin, xmin, ymax, xmax]` and decoded SVG mask paths (`decodeMaskToSVGPath`) are synchronized to the `<video>` element's playback timestamp in `SamOverlay.tsx`.

### Multi-Target Management (SAM 3 Engine, `src/lib/meta/sam-engine.ts`):
- The Meta API accepts **one noun phrase per `/responses` request** — compound prompts like `"dog, cat"` are rejected (`INVALID_SAM_PROMPT`), never concatenated.
- `segmentStepVideoMulti` / `Sam3Engine.segmentConcepts`: N distinct concepts = N billed requests, run with bounded concurrency (default 2), deduped case-insensitively, cached per `(video, concept)` for 5 minutes, with per-concept failure isolation, cross-concept overlap suppression (IoU ≥ 0.9), and labeled per-object tracks (`trackId = label:objectId`). The result reports `billedRequests` explicitly.
- `Sam3Engine.trackObjects`: pre-located objects (boxes/points via `buildObjectPrompt`) are tracked in **one** billed request regardless of object count. Use this when objects are already located instead of paying one video pass per concept.

---

## 6. Safety & Human Oversight Guarantees

1. **No Autonomous Clinical Decisions**: Aruga does not generate diagnoses or clinical scores.
2. **Untrusted Video Content**: Speech or text inside media is treated strictly as untrusted data, never as system prompt commands.
3. **Dual Client Consent**: Separate consents are collected for therapist sharing and optional Meta AI analysis.
4. **Demonstration Prototype**: Configured for consenting adult tabletop rehabilitation demonstrations. Pediatric onboarding is disabled in this hosted Meta AI deployment.
