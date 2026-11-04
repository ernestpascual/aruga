import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const maxDuration = 30;

/**
 * GET /api/tools/replay — list saved biomech analyses for the Replay tool.
 * Authenticated-tool data source: reads biomech_jobs (slim rows) + mints
 * signed URLs for the step video and the heavy 3D artifact so the client
 * can replay without re-running, and export the payload for the codebase.
 */
export async function GET(req: NextRequest) {
  try {
    const admin = createAdminClient();
    if (!admin) return NextResponse.json({ error: "Supabase not configured" }, { status: 500 });

    const { data: jobs, error } = await admin
      .from("biomech_jobs")
      .select("id, submission_id, step_submission_id, intent, concepts, status, mhr_result, timing_ms, created_at, updated_at")
      .eq("status", "completed")
      .order("updated_at", { ascending: false })
      .limit(50);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!jobs || jobs.length === 0) return NextResponse.json({ jobs: [] });

    const stepIds = [...new Set(jobs.map((j: any) => j.step_submission_id).filter(Boolean))];
    const { data: stepSubs } = await admin
      .from("step_submissions")
      .select("id, program_step_id, video_path, media_meta")
      .in("id", stepIds);
    const stepById = new Map((stepSubs || []).map((s: any) => [s.id, s]));

    const progStepIds = [...new Set((stepSubs || []).map((s: any) => s.program_step_id).filter(Boolean))];
    let stepTitleById = new Map<string, { title?: string; instructions?: string }>();
    if (progStepIds.length) {
      const { data: progSteps } = await admin.from("program_steps").select("id, title, instructions").in("id", progStepIds);
      stepTitleById = new Map((progSteps || []).map((s: any) => [s.id, { title: s.title, instructions: s.instructions }]));
    }

    const out = await Promise.all(
      jobs.map(async (j: any) => {
        const step = stepById.get(j.step_submission_id);
        const result = (j.mhr_result as any) || {};
        // Video: prefer stored storagePath, fall back to raw video_path when it is a storage path
        let videoUrl: string | null = null;
        try {
          const sp =
            (step?.media_meta as any)?.storagePath ||
            (step?.media_meta as any)?.storage_path ||
            (typeof step?.video_path === "string" && /^(submissions|playground)\//.test(step.video_path) ? step.video_path : null);
          if (sp) {
            const { data: signed } = await admin.storage.from("program-videos").createSignedUrl(sp, 600);
            videoUrl = signed?.signedUrl || null;
          } else if (typeof step?.video_path === "string" && (step.video_path.startsWith("http") || step.video_path.startsWith("/"))) {
            videoUrl = step.video_path;
          }
        } catch {}
        // Heavy 3D artifact link (same pattern as biomech/save GET)
        let artifactUrl: string | null = null;
        try {
          const art = result?.artifact;
          if (art?.bucket && art?.path) {
            const { data: signed } = await admin.storage.from(art.bucket).createSignedUrl(art.path, 600);
            artifactUrl = signed?.signedUrl || null;
          }
        } catch {}
        const progStep = step ? stepTitleById.get(step.program_step_id) : undefined;
        return {
          id: j.id,
          submissionId: j.submission_id,
          stepSubmissionId: j.step_submission_id,
          intent: j.intent,
          concepts: j.concepts,
          timingMs: j.timing_ms,
          createdAt: j.created_at,
          updatedAt: j.updated_at,
          activityTitle: result?.activity?.title || progStep?.title || "Saved analysis",
          stepTitle: progStep?.title || null,
          videoUrl,
          artifactUrl,
          result,
        };
      })
    );

    return NextResponse.json({ jobs: out });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
