import { NextRequest, NextResponse } from "next/server";
import { runGoalAgent } from "@/lib/meta/goal-agent";
import { runHighlightsAgent } from "@/lib/meta/highlights-agent";
import { MetaApiError } from "@/lib/meta/errors";
import { buildDemoGoalEvidence, buildDemoHighlightsEvidence } from "@/lib/demo/dummy-insights";

export const maxDuration = 60;

/**
 * POST /api/demo/insights — judge demo for Goal Tracking + Monthly Highlights.
 * Body: { mode: "goals" | "highlights", goalsText?: string, month?: string }
 * Runs the REAL agents on dummy (sample) evidence. No Supabase required —
 * only MODEL_API_KEY + AI_MODE=live. Nothing is persisted.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const mode = body?.mode as string | undefined;
    if (mode !== "goals" && mode !== "highlights") {
      return NextResponse.json({ error: 'mode must be "goals" or "highlights"' }, { status: 400 });
    }

    if (mode === "goals") {
      const evidence = buildDemoGoalEvidence(typeof body?.goalsText === "string" ? body.goalsText : undefined);
      if (evidence.goals.length === 0) {
        return NextResponse.json({ error: "Add at least one goal (one per line, prefix LTG: or STG:).", code: "NO_GOALS" }, { status: 422 });
      }
      // Chunked inside the route layer is handled by the agent caller pattern:
      // run in batches of 5 goals to stay within token budget, merge results.
      const CHUNK = 5;
      async function runBatched(ev: typeof evidence) {
        if (ev.goals.length <= CHUNK) return runGoalAgent(ev);
        const chunks: Array<typeof ev.goals> = [];
        for (let i = 0; i < ev.goals.length; i += CHUNK) chunks.push(ev.goals.slice(i, i + CHUNK));
        const results = await Promise.all(chunks.map((g) => runGoalAgent({ ...ev, goals: g })));
        return {
          result: {
            verdicts: results.flatMap((r) => r.result.verdicts),
            summary: {
              onTrack: results.reduce((a, r) => a + (r.result.summary.onTrack || 0), 0),
              atRisk: results.reduce((a, r) => a + (r.result.summary.atRisk || 0), 0),
              behind: results.reduce((a, r) => a + (r.result.summary.behind || 0), 0),
              achieved: results.reduce((a, r) => a + (r.result.summary.achieved || 0), 0),
              gap: results.reduce((a, r) => a + (r.result.summary.gap || 0), 0),
              narrative: results.map((r) => r.result.summary.narrative).join(" "),
            },
            suggestions: results.flatMap((r) => r.result.suggestions).slice(0, 5),
            warnings: [...new Set(results.flatMap((r) => r.result.warnings || []))],
          },
          latencyMs: results.reduce((a, r) => a + r.latencyMs, 0),
          modelId: results[0].modelId + ` x${results.length} batches`,
        };
      }
      const out = await runBatched(evidence);
      return NextResponse.json({ mode, ...out, counts: evidence.counts, demo: true });
    }

    const evidence = buildDemoHighlightsEvidence(typeof body?.month === "string" ? body.month : undefined);
    const out = await runHighlightsAgent(evidence);
    return NextResponse.json({ mode, ...out, counts: evidence.counts, demo: true });
  } catch (e: unknown) {
    if (e instanceof MetaApiError) {
      return NextResponse.json({ error: e.message, code: e.code }, { status: e.statusCode || 500 });
    }
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
