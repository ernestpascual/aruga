import "server-only";
import { MetaApiError } from "./errors";
import { SamResultParsed } from "./schemas";
import {
  assertSamTextConcept,
  runSamVideoSegmentation,
  runSamVideoObjectTracking,
  RunSamObjectTrackingParams,
} from "./sam";
import type { PromptObject } from "@meta-sam/parser";

/**
 * SAM 3.1 Engine
 *
 * Manages how multi-target segmentation maps onto Meta API billing:
 *
 * - Text concepts: the API accepts ONE noun phrase per /responses request,
 *   so N concepts = N full video passes (N billed requests). This engine
 *   runs them with bounded concurrency, dedupes repeats, isolates per-concept
 *   failures, merges results into labeled tracks, and suppresses cross-concept
 *   overlaps. It never concatenates concepts into one prompt.
 *
 * - Pre-located objects: boxes/points for many objects are encoded into ONE
 *   object-prompt request (trackObjects), so tracking is billed once
 *   regardless of object count.
 *
 * - Identical (video, prompt) work is cached per engine instance (including
 *   in-flight requests), so re-running the same concept on the same video
 *   does not pay twice within the cache TTL.
 */

export type SamRunner = (params: {
  videoUrl: string;
  objectConcept: string;
  durationSeconds?: number;
  fps?: number;
  mediaSize?: { width: number; height: number };
}) => Promise<{ result: SamResultParsed; latencyMs: number }>;

export type SamObjectRunner = (
  params: RunSamObjectTrackingParams
) => Promise<{ result: SamResultParsed; latencyMs: number }>;

export interface SamEngineOptions {
  /** Max simultaneous SAM requests in segmentConcepts. Default 2. */
  concurrency?: number;
  /** How long a (video, prompt) result stays cached. Default 5 min, 0 disables. */
  cacheTtlMs?: number;
  /** Injectable runners (used by tests). Default to the live Meta runners. */
  conceptRunner?: SamRunner;
  objectRunner?: SamObjectRunner;
}

export interface SamTrack {
  /** Stable engine id: `${label}:${apiObjectId}` (namespaced per concept). */
  trackId: string;
  label: string;
  /** Object id assigned by the SAM API within its own response, if present. */
  objectId?: string;
  frames: number[];
  boxes: SamResultParsed["boxes"];
  svgPaths: NonNullable<SamResultParsed["svgPaths"]>;
  maxConfidence: number;
}

export interface SamConceptFailure {
  concept: string;
  code: string;
  message: string;
}

export interface SamMultiResult {
  tracks: SamTrack[];
  boxes: SamResultParsed["boxes"];
  svgPaths: NonNullable<SamResultParsed["svgPaths"]>;
  failures: SamConceptFailure[];
  /** Number of concepts actually requested (after dedupe). */
  conceptsRequested: string[];
  /** Billed /responses requests attributable to this call (cache hits = 0). */
  billedRequests: number;
  latencyMs: number;
}

export interface SegmentConceptsParams {
  videoUrl: string;
  concepts: string[];
  durationSeconds?: number;
  fps?: number;
  /** Source video size in pixels; required to normalize SAM pixel coords to 0-1. */
  mediaSize?: { width: number; height: number };
  /** Throw on first concept failure instead of collecting failures. */
  failFast?: boolean;
  /**
   * Cross-concept overlap suppression: when boxes from different labels
   * overlap at or above this IoU on the same frame, keep the higher
   * confidence one. Default 0.9; set 0 to disable.
   */
  overlapIouThreshold?: number;
}

interface CacheEntry {
  promise: Promise<{ result: SamResultParsed; latencyMs: number }>;
  expiresAt: number;
}

/** Normalizes and dedupes concept phrases, preserving first-seen order. */
export function normalizeConcepts(concepts: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of concepts) {
    const concept = assertSamTextConcept(raw);
    if (!seen.has(concept)) {
      seen.add(concept);
      out.push(concept);
    }
  }
  return out;
}

/** IoU for [ymin, xmin, ymax, xmax] boxes (any consistent unit). */
export function boxIou(
  a: readonly [number, number, number, number],
  b: readonly [number, number, number, number]
): number {
  const y1 = Math.max(a[0], b[0]);
  const x1 = Math.max(a[1], b[1]);
  const y2 = Math.min(a[2], b[2]);
  const x2 = Math.min(a[3], b[3]);
  const inter = Math.max(0, y2 - y1) * Math.max(0, x2 - x1);
  const areaA = Math.max(0, a[2] - a[0]) * Math.max(0, a[3] - a[1]);
  const areaB = Math.max(0, b[2] - b[0]) * Math.max(0, b[3] - b[1]);
  const union = areaA + areaB - inter;
  return union > 0 ? inter / union : 0;
}

type BoxT = SamResultParsed["boxes"][number];
type PathT = NonNullable<SamResultParsed["svgPaths"]>[number];

/**
 * Drops lower-confidence boxes when different labels claim the same region
 * on the same frame, and drops mask paths belonging to suppressed boxes.
 */
export function resolveCrossConceptOverlaps(
  boxes: BoxT[],
  svgPaths: PathT[],
  iouThreshold: number
): { boxes: BoxT[]; svgPaths: PathT[] } {
  if (iouThreshold <= 0) return { boxes, svgPaths };

  const suppressed = new Set<BoxT>();
  const byFrame = new Map<number, BoxT[]>();
  for (const box of boxes) {
    const list = byFrame.get(box.frameIndex) ?? [];
    list.push(box);
    byFrame.set(box.frameIndex, list);
  }

  for (const frameBoxes of byFrame.values()) {
    for (let i = 0; i < frameBoxes.length; i++) {
      for (let j = i + 1; j < frameBoxes.length; j++) {
        const a = frameBoxes[i];
        const b = frameBoxes[j];
        if (a.label === b.label) continue;
        if (boxIou(a.box, b.box) < iouThreshold) continue;
        const loser = (a.confidence ?? 0) >= (b.confidence ?? 0) ? b : a;
        suppressed.add(loser);
      }
    }
  }

  if (suppressed.size === 0) return { boxes, svgPaths };

  const suppressedKeys = new Set(
    [...suppressed].map((b) => `${b.label}:${b.objectId ?? ""}:${b.frameIndex}`)
  );
  return {
    boxes: boxes.filter((b) => !suppressed.has(b)),
    svgPaths: svgPaths.filter(
      (p) => !suppressedKeys.has(`${p.label ?? ""}:${p.objectId ?? ""}:${p.frameIndex}`)
    ),
  };
}

/** Groups flat boxes/paths into per-object tracks namespaced by label. */
export function buildTracks(boxes: BoxT[], svgPaths: PathT[]): SamTrack[] {
  const tracks = new Map<string, SamTrack>();
  const keyOf = (label: string, objectId: string | undefined, frameIndex: number, idx: number) =>
    objectId ? `${label}:${objectId}` : `${label}:frame-${frameIndex}-${idx}`;

  boxes.forEach((box, idx) => {
    const trackId = keyOf(box.label, box.objectId, box.frameIndex, idx);
    let track = tracks.get(trackId);
    if (!track) {
      track = {
        trackId,
        label: box.label,
        objectId: box.objectId,
        frames: [],
        boxes: [],
        svgPaths: [],
        maxConfidence: 0,
      };
      tracks.set(trackId, track);
    }
    track.boxes.push(box);
    if (!track.frames.includes(box.frameIndex)) track.frames.push(box.frameIndex);
    track.maxConfidence = Math.max(track.maxConfidence, box.confidence ?? 0);
  });

  svgPaths.forEach((path, idx) => {
    const trackId = keyOf(path.label ?? "", path.objectId, path.frameIndex, idx);
    const track = tracks.get(trackId);
    if (track) track.svgPaths.push(path);
  });

  for (const track of tracks.values()) {
    track.frames.sort((a, b) => a - b);
    track.boxes.sort((a, b) => a.frameIndex - b.frameIndex);
  }
  return [...tracks.values()];
}

async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.max(1, Math.min(limit, items.length)) }, async () => {
    while (next < items.length) {
      const index = next++;
      results[index] = await fn(items[index], index);
    }
  });
  await Promise.all(workers);
  return results;
}

export class Sam3Engine {
  private readonly concurrency: number;
  private readonly cacheTtlMs: number;
  private readonly conceptRunner: SamRunner;
  private readonly objectRunner: SamObjectRunner;
  private readonly cache = new Map<string, CacheEntry>();
  private requestsMade = 0;
  private cacheHits = 0;

  constructor(options: SamEngineOptions = {}) {
    this.concurrency = Math.max(1, options.concurrency ?? 2);
    this.cacheTtlMs = options.cacheTtlMs ?? 5 * 60_000;
    this.conceptRunner = options.conceptRunner ?? runSamVideoSegmentation;
    this.objectRunner = options.objectRunner ?? runSamVideoObjectTracking;
  }

  getStats() {
    return { requestsMade: this.requestsMade, cacheHits: this.cacheHits, cacheSize: this.cache.size };
  }

  clearCache() {
    this.cache.clear();
  }

  private runConceptCached(params: {
    videoUrl: string;
    objectConcept: string;
    durationSeconds?: number;
    fps?: number;
    mediaSize?: { width: number; height: number };
  }): { promise: Promise<{ result: SamResultParsed; latencyMs: number }>; billed: boolean } {
    if (this.cacheTtlMs <= 0) {
      this.requestsMade++;
      return { promise: this.conceptRunner(params), billed: true };
    }
    const key = [
      params.videoUrl,
      params.objectConcept,
      params.fps ?? 30,
      params.durationSeconds ?? "",
      params.mediaSize ? `${params.mediaSize.width}x${params.mediaSize.height}` : "",
    ].join("|");
    const now = Date.now();
    const existing = this.cache.get(key);
    if (existing && existing.expiresAt > now) {
      this.cacheHits++;
      return { promise: existing.promise, billed: false };
    }
    this.requestsMade++;
    const promise = this.conceptRunner(params);
    const entry: CacheEntry = { promise, expiresAt: now + this.cacheTtlMs };
    this.cache.set(key, entry);
    // Never cache failures; evict so a retry can re-bill and possibly succeed.
    promise.catch(() => {
      if (this.cache.get(key) === entry) this.cache.delete(key);
    });
    return { promise, billed: true };
  }

  /**
   * Segments several text concepts in one video. Each distinct concept is
   * one billed API request (run with bounded concurrency); identical repeats
   * are deduped and served from cache when possible.
   */
  async segmentConcepts(params: SegmentConceptsParams): Promise<SamMultiResult> {
    const start = Date.now();
    const concepts = normalizeConcepts(params.concepts);
    if (concepts.length === 0) {
      throw new MetaApiError("At least one SAM concept is required.", "INVALID_SAM_PROMPT", 400);
    }

    let billedRequests = 0;
    const failures: SamConceptFailure[] = [];
    const perConcept: Array<{ result: SamResultParsed } | null> = new Array(concepts.length).fill(null);

    await mapWithConcurrency(concepts, this.concurrency, async (concept, index) => {
      const { promise, billed } = this.runConceptCached({
        videoUrl: params.videoUrl,
        objectConcept: concept,
        durationSeconds: params.durationSeconds,
        fps: params.fps,
        mediaSize: params.mediaSize,
      });
      if (billed) billedRequests++;
      try {
        const { result } = await promise;
        perConcept[index] = { result };
      } catch (err) {
        if (params.failFast) throw err;
        failures.push({
          concept,
          code: err instanceof MetaApiError ? err.code : "SAM_ERROR",
          message: err instanceof Error ? err.message : String(err),
        });
      }
    });

    let boxes: BoxT[] = [];
    let svgPaths: PathT[] = [];
    for (const entry of perConcept) {
      if (!entry) continue;
      boxes.push(...entry.result.boxes);
      svgPaths.push(...(entry.result.svgPaths ?? []));
    }
    boxes.sort((a, b) => a.frameIndex - b.frameIndex);

    ({ boxes, svgPaths } = resolveCrossConceptOverlaps(
      boxes,
      svgPaths,
      params.overlapIouThreshold ?? 0.9
    ));

    return {
      tracks: buildTracks(boxes, svgPaths),
      boxes,
      svgPaths,
      failures,
      conceptsRequested: concepts,
      billedRequests,
      latencyMs: Date.now() - start,
    };
  }

  /**
   * Tracks pre-located objects (boxes/points) in ONE billed API request,
   * regardless of how many objects are included. Use this after locating
   * objects once (e.g. from a concept pass on a keyframe) instead of paying
   * one full video pass per concept.
   */
  async trackObjects(
    params: RunSamObjectTrackingParams & { labels?: Array<{ id: number | string; label: string }> }
  ): Promise<{ result: SamResultParsed; latencyMs: number; billedRequests: 1 }> {
    const labelsByObjectId: Record<string, string> = { ...(params.labelsByObjectId ?? {}) };
    for (const entry of params.labels ?? []) labelsByObjectId[String(entry.id)] = entry.label;

    this.requestsMade++;
    const { result, latencyMs } = await this.objectRunner({
      ...params,
      labelsByObjectId: Object.keys(labelsByObjectId).length ? labelsByObjectId : undefined,
    });
    return { result, latencyMs, billedRequests: 1 };
  }
}

/** Shared default engine (module-level cache/concurrency for the app). */
export const sam3Engine = new Sam3Engine();

export type { PromptObject };
