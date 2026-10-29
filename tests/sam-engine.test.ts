import { describe, it, expect, vi } from "vitest";
import {
  Sam3Engine,
  normalizeConcepts,
  boxIou,
  resolveCrossConceptOverlaps,
} from "../src/lib/meta/sam-engine";
import { MetaApiError } from "../src/lib/meta/errors";
import type { RunSamObjectTrackingParams } from "../src/lib/meta/sam";
import type { SamResultParsed } from "../src/lib/meta/schemas";

function fakeResult(label: string, objectId = "0", confidence = 0.9): SamResultParsed {
  return {
    objectConcept: label,
    detectedFramesCount: 1,
    boxes: [
      {
        frameIndex: 0,
        timestampSeconds: 0,
        box: [0, 0, 10, 10] as [number, number, number, number],
        label,
        objectId,
        confidence,
      },
    ],
    svgPaths: [{ frameIndex: 0, path: "M0 0Z", objectId, label }],
    durationAnalyzedSeconds: 1,
  };
}

describe("Sam3Engine concept handling", () => {
  it("rejects compound prompts instead of concatenating them", () => {
    expect(() => normalizeConcepts(["dog, cat"])).toThrowError(/single concept/);
    expect(() => normalizeConcepts(["segment the dog"])).toThrowError(MetaApiError);
  });

  it("dedupes concepts case-insensitively and bills once per distinct concept", async () => {
    const runner = vi.fn(async ({ objectConcept }: { objectConcept: string }) => ({
      result: fakeResult(objectConcept),
      latencyMs: 1,
    }));
    const engine = new Sam3Engine({ conceptRunner: runner, cacheTtlMs: 0 });

    const out = await engine.segmentConcepts({
      videoUrl: "v.mp4",
      concepts: ["dog", "Dog", "cat"],
      overlapIouThreshold: 0,
    });

    expect(runner).toHaveBeenCalledTimes(2);
    expect(out.conceptsRequested).toEqual(["dog", "cat"]);
    expect(out.billedRequests).toBe(2);
    expect(out.tracks.map((t) => t.trackId).sort()).toEqual(["cat:0", "dog:0"]);
  });

  it("serves repeated (video, concept) work from cache without re-billing", async () => {
    const runner = vi.fn(async ({ objectConcept }: { objectConcept: string }) => ({
      result: fakeResult(objectConcept),
      latencyMs: 1,
    }));
    const engine = new Sam3Engine({ conceptRunner: runner });

    await engine.segmentConcepts({ videoUrl: "v.mp4", concepts: ["dog"] });
    const second = await engine.segmentConcepts({ videoUrl: "v.mp4", concepts: ["dog"] });

    expect(runner).toHaveBeenCalledTimes(1);
    expect(second.billedRequests).toBe(0);
    expect(engine.getStats()).toMatchObject({ requestsMade: 1, cacheHits: 1 });
  });

  it("bounds concurrency and isolates per-concept failures", async () => {
    let active = 0;
    let maxActive = 0;
    const runner = vi.fn(async ({ objectConcept }: { objectConcept: string }) => {
      active++;
      maxActive = Math.max(maxActive, active);
      await new Promise((r) => setTimeout(r, 5));
      active--;
      if (objectConcept === "cat") throw new MetaApiError("boom", "SAM_API_FAILED", 500);
      return { result: fakeResult(objectConcept), latencyMs: 1 };
    });
    const engine = new Sam3Engine({ conceptRunner: runner, concurrency: 2, cacheTtlMs: 0 });

    const out = await engine.segmentConcepts({
      videoUrl: "v.mp4",
      concepts: ["dog", "cat", "person in white", "person in blue"],
      overlapIouThreshold: 0,
    });

    expect(maxActive).toBeLessThanOrEqual(2);
    expect(out.failures).toEqual([{ concept: "cat", code: "SAM_API_FAILED", message: "boom" }]);
    expect(out.tracks).toHaveLength(3);
    expect(out.billedRequests).toBe(4);
  });

  it("suppresses lower-confidence cross-concept overlaps on the same frame", async () => {
    const runner = vi.fn(async ({ objectConcept }: { objectConcept: string }) => ({
      result: fakeResult(objectConcept, "0", objectConcept === "person in white" ? 0.95 : 0.6),
      latencyMs: 1,
    }));
    const engine = new Sam3Engine({ conceptRunner: runner, cacheTtlMs: 0 });

    const out = await engine.segmentConcepts({
      videoUrl: "v.mp4",
      concepts: ["person in white", "person in blue"],
    });

    expect(out.boxes).toHaveLength(1);
    expect(out.boxes[0].label).toBe("person in white");
    expect(out.svgPaths).toHaveLength(1);
  });
});

describe("Sam3Engine object tracking", () => {
  it("tracks many pre-located objects in exactly one billed request", async () => {
    const objectRunner = vi.fn(
      async (params: RunSamObjectTrackingParams) => {
        void params;
        return { result: fakeResult("cup", "1"), latencyMs: 3 };
      }
    );
    const engine = new Sam3Engine({ objectRunner, conceptRunner: vi.fn() });

    const out = await engine.trackObjects({
      videoUrl: "v.mp4",
      mediaSize: { width: 640, height: 480 },
      objects: [
        { id: 1, prompts: [{ frame: 0, box: { left: 0, top: 0, right: 10, bottom: 10 } }] },
        { id: 2, prompts: [{ frame: 0, box: { left: 20, top: 20, right: 30, bottom: 30 } }] },
      ],
      labels: [{ id: 1, label: "cup" }],
    });

    expect(objectRunner).toHaveBeenCalledTimes(1);
    expect(out.billedRequests).toBe(1);
    const call = objectRunner.mock.calls[0]?.[0] as { labelsByObjectId?: Record<string, string> };
    expect(call.labelsByObjectId).toEqual({ "1": "cup" });
  });
});

describe("segmentStepVideoMulti facade (mock mode)", () => {
  it("merges per-concept mock results with labels and tracks", async () => {
    const { segmentStepVideoMulti } = await import("../src/lib/meta-ai");
    const out = await segmentStepVideoMulti({
      stepSubmissionId: "sub-1",
      videoUrl: "/demo/cup.mp4",
      objectConcepts: ["cup", "Cup", "block"],
    });
    expect(out.objectConcepts).toEqual(["cup", "block"]);
    expect(out.tracks).toHaveLength(2);
    expect(out.boxes.every((b) => ["cup", "block"].includes(b.label))).toBe(true);
    expect(out.billedRequests).toBe(0);
  });
});

describe("boxIou / overlap helpers", () => {
  it("computes IoU", () => {
    expect(boxIou([0, 0, 10, 10], [0, 0, 10, 10])).toBe(1);
    expect(boxIou([0, 0, 10, 10], [20, 20, 30, 30])).toBe(0);
  });

  it("does not suppress same-label overlaps", () => {
    const boxes = [
      { frameIndex: 0, timestampSeconds: 0, box: [0, 0, 10, 10] as [number, number, number, number], label: "dog", objectId: "0", confidence: 0.9 },
      { frameIndex: 0, timestampSeconds: 0, box: [0, 0, 10, 10] as [number, number, number, number], label: "dog", objectId: "1", confidence: 0.8 },
    ];
    const out = resolveCrossConceptOverlaps(boxes, [], 0.9);
    expect(out.boxes).toHaveLength(2);
  });
});
