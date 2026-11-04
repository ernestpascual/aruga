// Shared export/import format for a finished Biomechanic Agent analysis.
// One JSON file carries EVERYTHING (concepts, SAM boxes/masks, full 3D frames,
// insights, adherence, activity context) so it can be:
//  - downloaded after an analysis and loaded again later without re-running
//  - dropped into public/demo/analysis/latest.json to seed /demo/homeprogram
//  - exported from /tools/replay and imported in the demo or review modal

export type BiomechExport = {
  exportedFrom: "aruga-biomech-analysis";
  version: 1;
  exportedAt: string;
  submissionId?: string | null;
  stepSubmissionId?: string | null;
  activity: { title: string; instructions: string; therapistNeed: string; ageBand: string };
  result: Record<string, unknown>;
};

export function buildBiomechExport(input: {
  result: Record<string, unknown>;
  activity: { title?: string; instructions?: string; therapistNeed?: string; ageBand?: string };
  submissionId?: string | null;
  stepSubmissionId?: string | null;
}): BiomechExport {
  return {
    exportedFrom: "aruga-biomech-analysis",
    version: 1,
    exportedAt: new Date().toISOString(),
    submissionId: input.submissionId ?? null,
    stepSubmissionId: input.stepSubmissionId ?? null,
    activity: {
      title: input.activity.title || "",
      instructions: input.activity.instructions || "",
      therapistNeed: input.activity.therapistNeed || "",
      ageBand: input.activity.ageBand || "adult",
    },
    result: input.result,
  };
}

export function downloadBiomechJson(payload: unknown, filename: string) {
  const blob = new Blob([JSON.stringify(payload)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function biomechExportFilename(stepSubmissionId?: string | null) {
  return `biomech-analysis-${stepSubmissionId ? stepSubmissionId.slice(0, 8) : "export"}.json`;
}

function isAnalysisResult(v: unknown): v is Record<string, unknown> {
  if (!v || typeof v !== "object") return false;
  const r = v as Record<string, unknown>;
  return Boolean(r.mhr || r.sam || Array.isArray(r.concepts) || Array.isArray(r.insights));
}

/**
 * Accepts any of the shapes we produce:
 *  - BiomechExport wrapper ({ result, activity, ... })
 *  - /tools/replay export ({ result, activityTitle, ... })
 *  - DB saved payload ({ mhr_result | saved.mhr_result, artifactUrl? }) — slim row,
 *    note: slim rows have no full 3D/masks unless merged with the artifact first
 *  - raw agent result ({ plan, concepts, sam, mhr, insights, ... })
 */
export function parseBiomechImport(data: unknown): { result: Record<string, unknown>; activity?: BiomechExport["activity"] } {
  if (!data || typeof data !== "object") throw new Error("That file is not a JSON object.");
  const d = data as Record<string, any>;

  if (isAnalysisResult(d.result)) {
    const activity = d.activity
      ? {
          title: String(d.activity.title || d.activityTitle || ""),
          instructions: String(d.activity.instructions || ""),
          therapistNeed: String(d.activity.therapistNeed || ""),
          ageBand: String(d.activity.ageBand || "adult"),
        }
      : d.activityTitle
        ? { title: String(d.activityTitle), instructions: "", therapistNeed: "", ageBand: "adult" }
        : undefined;
    return { result: d.result, activity };
  }
  if (isAnalysisResult(d.mhr_result)) return { result: d.mhr_result };
  if (d.saved && isAnalysisResult(d.saved.mhr_result)) return { result: d.saved.mhr_result };
  if (isAnalysisResult(d)) return { result: d };
  throw new Error("No biomech analysis found in that file — expected a downloaded analysis JSON (it should contain mhr / sam / concepts).");
}

/** Merge a Storage artifact ({frames, sam:{boxes,svgPaths,tracks}}) over a slim result. */
export function mergeBiomechArtifact(result: Record<string, any>, art: any): Record<string, any> {
  if (!art || typeof art !== "object") return result;
  return {
    ...result,
    sam: {
      ...(result.sam || {}),
      boxes: art?.sam?.boxes ?? result.sam?.boxes,
      svgPaths: art?.sam?.svgPaths ?? result.sam?.svgPaths,
      tracks: art?.sam?.tracks ?? result.sam?.tracks,
    },
    mhr: result.mhr ? { ...result.mhr, frames: art?.frames ?? result.mhr?.frames } : result.mhr,
  };
}
