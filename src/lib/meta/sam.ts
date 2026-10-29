import "server-only";
import { getMetaConfig } from "./client";
import {
  MetaApiError,
  MetaTimeoutError,
  MetaRateLimitError,
  SamParserError,
  UnsupportedMediaError,
} from "./errors";
import { SamResultParsed } from "./schemas";
import {
  buildObjectPrompt,
  parseVideoStream,
  recordsOfKind,
  frameIndexOf,
  decodeMaskToSVGPath,
  ResponsesEvent,
  PromptObject,
} from "@meta-sam/parser";

export interface RunSamParams {
  videoUrl: string;
  objectConcept: string;
  durationSeconds?: number;
  /** Frame rate used to convert frame indices to timestamps. Defaults to 30. */
  fps?: number;
  /** Source video size in pixels; required to normalize pixel coordinates to 0-1. */
  mediaSize?: { width: number; height: number };
}

export interface RunSamPromptParams {
  videoUrl: string;
  /** A single SAM noun phrase OR an encoded object-prompt string. Never both. */
  promptText: string;
  /** Label attached to every returned record (concept or caller-supplied name). */
  label: string;
  durationSeconds?: number;
  fps?: number;
  metadata?: Record<string, string>;
  /** Source video size in pixels; required to normalize pixel coordinates to 0-1. */
  mediaSize?: { width: number; height: number };
}

/**
 * SAM box/mask records are in SOURCE PIXELS (mask paths are in the mask's
 * own cropped raster space). Convert a decoded mask path into normalized
 * source-frame coordinates (0-1 on both axes) so UIs can render it with a
 * `0 0 1 1` viewBox / percentage positioning on any display size.
 */
export function transformMaskPathToNormalized(
  path: string,
  bounds: { left: number; top: number; right: number; bottom: number },
  maskSize: { width: number; height: number },
  mediaSize: { width: number; height: number }
): string {
  const boundsW = Math.max(1, bounds.right - bounds.left);
  const boundsH = Math.max(1, bounds.bottom - bounds.top);
  const fmt = (n: number) => Number(n.toFixed(5));
  return path.replace(
    /([ML])(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)/g,
    (_m, cmd: string, xStr: string, yStr: string) => {
      const x = parseFloat(xStr);
      const y = parseFloat(yStr);
      const nx =
        (bounds.left + ((x + 0.5) / Math.max(1, maskSize.width)) * boundsW) /
        mediaSize.width;
      const ny =
        (bounds.top + ((y + 0.5) / Math.max(1, maskSize.height)) * boundsH) /
        mediaSize.height;
      return `${cmd}${fmt(nx)} ${fmt(ny)}`;
    }
  );
}

export interface RunSamObjectTrackingParams {
  videoUrl: string;
  /** Displayed media size in pixels; required to encode box/point prompts. */
  mediaSize: { width: number; height: number };
  objects: PromptObject[];
  /** Optional human label per object id, used to label returned records. */
  labelsByObjectId?: Record<string, string>;
  durationSeconds?: number;
  fps?: number;
  propagationDirection?: "both" | "forward" | "backward";
}

const MAX_CONCEPT_WORDS = 8;
const COMPOUND_SEPARATORS = /,|;|\band\b|\bplus\b/i;
const IMPERATIVE_START = /^(segment|find|show|track|detect|which|what|please)\b/i;

/**
 * Validates a single SAM text concept. SAM requests accept ONE short noun
 * phrase (e.g. "cup", "person in white"); compound lists such as
 * "dog, cat" must be split into separate requests by the caller.
 */
export function assertSamTextConcept(raw: string): string {
  const concept = raw.trim().toLowerCase().replace(/\s+/g, " ");
  if (!concept) {
    throw new MetaApiError("SAM prompt is empty.", "INVALID_SAM_PROMPT", 400);
  }
  if (COMPOUND_SEPARATORS.test(concept)) {
    throw new MetaApiError(
      `SAM accepts a single concept per request, got "${raw}". Split compound prompts into separate concepts.`,
      "INVALID_SAM_PROMPT",
      400
    );
  }
  if (IMPERATIVE_START.test(concept) || concept.split(" ").length > MAX_CONCEPT_WORDS) {
    throw new MetaApiError(
      "SAM 3.1 accepts only a single concise physical object concept (e.g. 'cup' or 'person in white'), not compound activity instructions.",
      "INVALID_SAM_PROMPT",
      400
    );
  }
  return concept;
}

async function* sseEventsFromStream(
  stream: ReadableStream<Uint8Array>
): AsyncIterable<ResponsesEvent> {
  const reader = stream.getReader();
  const decoder = new TextDecoder("utf-8");
  let buffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith("data: ")) {
          const jsonStr = trimmed.slice(6).trim();
          if (jsonStr === "[DONE]") {
            yield { type: "response.completed" };
            return;
          }
          try {
            const parsed = JSON.parse(jsonStr) as ResponsesEvent;
            yield parsed;
          } catch {
            // Ignore non-json heartbeat lines
          }
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

/**
 * Executes ONE SAM 3.1 video request for ONE prompt and parses its stream.
 * Every call is one full video pass on the Meta API (one billed request):
 * callers wanting several concepts must either pay one request per concept
 * or seed a single object-prompt request via runSamVideoObjectTracking.
 */
export async function runSamVideoPrompt(
  params: RunSamPromptParams
): Promise<{ result: SamResultParsed; latencyMs: number }> {
  const config = getMetaConfig();
  const startTime = Date.now();
  const fps = params.fps && params.fps > 0 ? params.fps : 30;
  const label = params.label;

  try {
    const endpoint = `${config.baseUrl}/responses`;
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.apiKey}`,
        Accept: "text/event-stream",
      },
      body: JSON.stringify({
        model: config.models.sam,
        // Official Responses API shape: ONE user message whose content holds
        // an input_text part + an input_video part. Sending bare
        // video_url/text parts at input[] level fails validation with
        // "`input[0]` did not match any supported type".
        input: [
          {
            type: "message",
            role: "user",
            content: [
              {
                type: "input_text",
                text: params.promptText,
              },
              {
                type: "input_video",
                video_url: params.videoUrl,
              },
            ],
          },
        ],
        stream: true,
        ...(params.metadata ? { metadata: params.metadata } : {}),
      }),
    });

    if (!response.ok) {
      if (response.status === 415) {
        throw new UnsupportedMediaError();
      }
      if (response.status === 429) {
        throw new MetaRateLimitError();
      }
      const errorText = await response.text();
      throw new MetaApiError(
        `SAM 3.1 streaming request failed with status ${response.status}: ${errorText}`,
        "SAM_API_FAILED",
        response.status,
        response.status >= 500
      );
    }

    if (!response.body) {
      throw new MetaApiError("No response body stream received from SAM 3.1", "NO_STREAM_BODY", 500);
    }

    const sseStream = sseEventsFromStream(response.body);
    const parsedStream = parseVideoStream(sseStream);
    const segmentationResult = await parsedStream.finalResult;

    const boxRecords = recordsOfKind(segmentationResult.records, "box");
    const maskRecords = recordsOfKind(segmentationResult.records, "mask");

    const mediaSize =
      params.mediaSize && params.mediaSize.width > 0 && params.mediaSize.height > 0
        ? params.mediaSize
        : undefined;

    const boxes = boxRecords.map((rec) => {
      const fIndex = frameIndexOf(rec) ?? 0;
      // Records are source pixels; normalize to 0-1 when we know the source
      // size. Without it the raw pixels would be misread as percentages and
      // pile up off/near the corner, so callers should always pass mediaSize.
      const box: [number, number, number, number] = mediaSize
        ? [
            rec.top / mediaSize.height,
            rec.left / mediaSize.width,
            rec.bottom / mediaSize.height,
            rec.right / mediaSize.width,
          ]
        : [rec.top, rec.left, rec.bottom, rec.right];
      return {
        frameIndex: fIndex,
        timestampSeconds: fIndex / fps,
        box,
        label,
        objectId: rec.objectId,
        confidence: rec.confidence ?? 0.95,
      };
    });

    const svgPaths = [];
    for (const maskRec of maskRecords) {
      try {
        const fIndex = frameIndexOf(maskRec) ?? 0;
        const rawPath = decodeMaskToSVGPath(maskRec.mask);
        // Mask paths live in the cropped raster's own space (origin at the
        // box's top-left) — rendering them directly puts every mask in the
        // video's upper-left. Translate into normalized frame coordinates.
        const path = mediaSize
          ? transformMaskPathToNormalized(
              rawPath,
              maskRec.bounds,
              { width: maskRec.mask.width, height: maskRec.mask.height },
              mediaSize
            )
          : rawPath;
        svgPaths.push({
          frameIndex: fIndex,
          path,
          objectId: maskRec.objectId,
          label,
        });
      } catch {
        // Individual frame mask decode failure is non-fatal
      }
    }

    const latencyMs = Date.now() - startTime;

    return {
      result: {
        objectConcept: label,
        detectedFramesCount: boxes.length,
        boxes,
        svgPaths,
        durationAnalyzedSeconds:
          params.durationSeconds ||
          (boxes.length > 0 ? boxes[boxes.length - 1].timestampSeconds : 0),
      },
      latencyMs,
    };
  } catch (err: unknown) {
    if (err instanceof MetaApiError) throw err;

    const errorMsg = err instanceof Error ? err.message : String(err);
    if (errorMsg.includes("timeout")) {
      throw new MetaTimeoutError();
    }
    if (errorMsg.includes("parser") || errorMsg.includes("stream")) {
      throw new SamParserError(`SAM 3.1 stream parsing failed: ${errorMsg}`);
    }
    throw new MetaApiError(`SAM 3.1 execution error: ${errorMsg}`, "SAM_ERROR", 500, true);
  }
}

/** Segments a video with a single text concept (one API request). */
export async function runSamVideoSegmentation(
  params: RunSamParams
): Promise<{ result: SamResultParsed; latencyMs: number }> {
  const concept = assertSamTextConcept(params.objectConcept);
  return runSamVideoPrompt({
    videoUrl: params.videoUrl,
    promptText: concept,
    label: concept,
    durationSeconds: params.durationSeconds,
    fps: params.fps,
    mediaSize: params.mediaSize,
    metadata: { include_confidence: "true" },
  });
}

/**
 * Tracks several already-located objects in ONE API request (billed once).
 * Objects are encoded with buildObjectPrompt; a request must not also carry
 * a noun phrase, so text concepts cannot be mixed into this call.
 */
export async function runSamVideoObjectTracking(
  params: RunSamObjectTrackingParams
): Promise<{ result: SamResultParsed; latencyMs: number }> {
  if (params.objects.length === 0) {
    throw new MetaApiError("At least one object is required for SAM object tracking.", "INVALID_SAM_PROMPT", 400);
  }
  const promptText = buildObjectPrompt({
    size: params.mediaSize,
    objects: params.objects,
  });

  const { result, latencyMs } = await runSamVideoPrompt({
    videoUrl: params.videoUrl,
    promptText,
    label: "object-tracking",
    durationSeconds: params.durationSeconds,
    fps: params.fps,
    mediaSize: params.mediaSize,
    metadata: {
      include_confidence: "true",
      propagation_direction: params.propagationDirection ?? "both",
    },
  });

  // Relabel records with caller-supplied per-object labels when provided.
  if (params.labelsByObjectId) {
    const labels = params.labelsByObjectId;
    result.boxes = result.boxes.map((b) => ({
      ...b,
      label: (b.objectId && labels[b.objectId]) || b.label,
    }));
    result.svgPaths = result.svgPaths?.map((p) => ({
      ...p,
      label: (p.objectId && labels[p.objectId]) || p.label,
    }));
  }

  return { result, latencyMs };
}
