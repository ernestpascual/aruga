import { describe, it, expect } from "vitest";
import { buildBiomechExport, parseBiomechImport, mergeBiomechArtifact } from "../src/lib/demo/biomech-payload";

const RESULT = {
  plan: { source: "spark", rationale: "track the cup lift" },
  concepts: ["person", "cup"],
  sam: { boxes: [{ box: [0, 0, 1, 1], label: "person" }], svgPaths: [], tracks: [], latencyMs: 10 },
  mhr: { frames: [{ frameIndex: 0, pred_keypoints_3d: [[0, 0, 0]] }], summary: { confidenceOverall: 0.9 } },
  insights: [{ id: "a", label: "A", rating: "Good", score: 90, explanation: "ok" }],
  adherence: { pct: 90, label: "Strong adherence" },
};

describe("biomech payload export/import", () => {
  it("round-trips the shared export format", () => {
    const payload = buildBiomechExport({
      result: RESULT,
      activity: { title: "Cup lift", instructions: "Lift it", ageBand: "adult" },
      submissionId: "sub-1",
      stepSubmissionId: "step-1",
    });
    expect(payload.exportedFrom).toBe("aruga-biomech-analysis");
    const parsed = parseBiomechImport(JSON.parse(JSON.stringify(payload)));
    expect(parsed.result.concepts).toEqual(["person", "cup"]);
    expect(parsed.activity?.title).toBe("Cup lift");
  });

  it("accepts a raw agent result and a tools/replay export", () => {
    expect(parseBiomechImport(RESULT).result).toBe(RESULT);
    const replay = parseBiomechImport({ activityTitle: "Replayed", result: RESULT });
    expect(replay.activity?.title).toBe("Replayed");
  });

  it("accepts a DB saved payload (mhr_result)", () => {
    const parsed = parseBiomechImport({ saved: { mhr_result: RESULT } });
    expect((parsed.result.mhr as any).summary.confidenceOverall).toBe(0.9);
  });

  it("rejects files without an analysis", () => {
    expect(() => parseBiomechImport({ hello: "world" })).toThrow(/No biomech analysis/);
    expect(() => parseBiomechImport(null)).toThrow();
  });

  it("merges artifact frames/masks over a slim result without dropping insights", () => {
    const slim = { concepts: ["person"], sam: { boxCount: 3 }, mhr: { frames: [{ frameIndex: 0 }], summary: {} }, insights: RESULT.insights };
    const merged = mergeBiomechArtifact(slim as any, { frames: RESULT.mhr.frames, sam: { boxes: RESULT.sam.boxes, svgPaths: [], tracks: [] } });
    expect((merged.mhr.frames[0] as any).pred_keypoints_3d).toBeDefined();
    expect(merged.sam.boxes).toHaveLength(1);
    expect(merged.sam.boxCount).toBe(3);
    expect(merged.insights).toHaveLength(1);
  });
});
