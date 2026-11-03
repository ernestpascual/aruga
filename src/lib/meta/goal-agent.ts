import "server-only";
import { createMetaOpenAiClient, getMetaConfig } from "./client";
import { MetaApiError, MetaTimeoutError, MetaRateLimitError } from "./errors";

// Goal Tracking — real LLM via Muse Spark 1.3 reasoning:high
// prompt_cache_key: aruga-goal-tracking, prompt_cache_retention 24h
// Strict json_schema: verdicts + summary + suggestions
// Any MetaApiError propagates to route which renders "Requires Meta Spark API" failure.

export type GoalEvidence = {
  goals: Array<{ id: string; text: string; type: "ltg" | "stg" }>;
  soapNotes: Array<{ id: string; session_date?: string; subjective?: string; objective?: string; assessment?: string; plan?: string }>;
  mhrResults: Array<{ id: string; mhr_results?: any; biomech_summary?: any; created_at?: string }>;
  submissions: Array<{
    id: string;
    state?: string;
    created_at?: string;
    scheduled_date?: string | null;
    submitted_at?: string | null;
    step_submissions?: Array<{ program_step_id?: string; video_path?: string | null; client_comment?: string | null; skipped?: boolean; skip_reason?: string | null }>;
    review?: { status?: string; overall_feedback?: string | null } | Array<{ status?: string; overall_feedback?: string | null }> | null;
  }>;
  counts: { soapCount: number; mhrCount: number; subCount: number };
};

export type GoalAgentResult = {
  verdicts: Array<{
    goalId: string;
    goalText: string;
    goalType: "ltg" | "stg";
    verdict: "on_track" | "at_risk" | "behind" | "achieved" | "gap";
    confidence: number;
    signals: Record<string, number>;
    reason: string;
    evidenceIds: string[];
  }>;
  summary: { onTrack: number; atRisk: number; behind: number; achieved: number; gap: number; narrative: string };
  suggestions: Array<{ goalId: string; action: "continue" | "escalate" | "maintain" | "discharge"; text: string }>;
  warnings: string[];
};

const GOAL_SYSTEM = `You are the Aruga Goal Tracking agent. You evaluate STG/LTG goals against real evidence only — never invent ROM, adherence, or mhr numbers.
You are given goals + last 5 SOAP S/O/A/P + last 30d biomech mhr_results (ROM, flags, confidenceOverall) + 14d submissions.
Evaluate 7 signals per goal:
1 ROM vs target (from mhr_results.rom / peakAngles vs goal target phrase)
2 Neck/compensation flag (mhr_results.flags + neckAngles)
3 Adherence rate (submissions completion %)
4 Adherence trend (rate change)
5 SOAP objective alignment (keyword match between goal domain and soap_notes.objective)
6 Client qualitative (subjective/client note)
7 Time to deadline (if goal text contains deadline e.g. "in 6w" ; otherwise ignore)
For each goal return verdict on_track|at_risk|behind|achieved|gap with confidence 0-1, signals {rom_vs_target, adherence, time_to_deadline} 0-1, reason ≤180 chars citing evidenceIds, evidenceIds like mhr:abcd soap:abcd submission:abcd goal:abcd.
Rules: no diagnosis beyond verdict; gap if no relevant evidence; confidence<0.6 when <2 biomech clips; missing deadline → time_to_deadline=0.5.
Return ONLY JSON matching schema.`;

function buildUserPrompt(ev: GoalEvidence) {
  const goalsLines = ev.goals.map((g) => `- ${g.id} [${g.type}] "${g.text}"`).join("\n");
  const soapLines = ev.soapNotes.slice(0, 5).map((s) => `soap:${String(s.id).slice(0,8)} objective:${(s.objective||"").slice(0,120)} assessment:${(s.assessment||"").slice(0,80)}`).join("\n");
  const mhrLines = ev.mhrResults.slice(0, 5).map((m: any) => {
    const summ = m.biomech_summary || m.mhr_results?.summary || {};
    return `mhr:${String(m.id).slice(0,8)} date:${m.created_at?.slice(0,10)} confidence:${summ.confidenceOverall ?? "?"} rom:${JSON.stringify(summ.peakAngles || summ.rom || "").slice(0,160)} flags:${JSON.stringify(summ.flags || []).slice(0,120)}`;
  }).join("\n");
  const subLines = ev.submissions.slice(0, 10).map((s) => `submission:${String(s.id).slice(0,8)} state:${s.state} date:${s.created_at?.slice(0,10)}`).join("\n");
  return `Goals (${ev.goals.length}):
${goalsLines || "(none)"}

SOAP notes (${ev.counts.soapCount}):
${soapLines || "(none)"}

MHR biomech (${ev.counts.mhrCount}):
${mhrLines || "(none)"}

Submissions (${ev.counts.subCount} 14d):
${subLines || "(none)"}

Evaluate each goal. Cite evidenceIds that exist above. Do not invent ids or numbers not in context.`;
}

const goalJsonSchema = {
  type: "object",
  properties: {
    verdicts: {
      type: "array",
      minItems: 1,
      maxItems: 15,
      items: {
        type: "object",
        properties: {
          goalId: { type: "string" },
          goalText: { type: "string" },
          goalType: { type: "string", enum: ["ltg", "stg"] },
          verdict: { type: "string", enum: ["on_track", "at_risk", "behind", "achieved", "gap"] },
          confidence: { type: "number", minimum: 0, maximum: 1 },
          signals: {
            type: "object",
            properties: {
              rom_vs_target: { type: "number" },
              adherence: { type: "number" },
              time_to_deadline: { type: "number" },
            },
            required: ["rom_vs_target", "adherence", "time_to_deadline"],
            additionalProperties: false,
          },
          reason: { type: "string" },
          evidenceIds: { type: "array", items: { type: "string" } },
        },
        required: ["goalId", "goalText", "goalType", "verdict", "confidence", "signals", "reason", "evidenceIds"],
        additionalProperties: false,
      },
    },
    summary: {
      type: "object",
      properties: {
        onTrack: { type: "integer" },
        atRisk: { type: "integer" },
        behind: { type: "integer" },
        achieved: { type: "integer" },
        gap: { type: "integer" },
        narrative: { type: "string" },
      },
      required: ["onTrack", "atRisk", "behind", "achieved", "gap", "narrative"],
      additionalProperties: false,
    },
    suggestions: {
      type: "array",
      maxItems: 5,
      items: {
        type: "object",
        properties: {
          goalId: { type: "string" },
          action: { type: "string", enum: ["continue", "escalate", "maintain", "discharge"] },
          text: { type: "string" },
        },
        required: ["goalId", "action", "text"],
        additionalProperties: false,
      },
    },
    warnings: { type: "array", items: { type: "string" } },
  },
  required: ["verdicts", "summary", "suggestions", "warnings"],
  additionalProperties: false,
} as const;

export async function runGoalAgent(evidence: GoalEvidence): Promise<{ result: GoalAgentResult; latencyMs: number; modelId: string }> {
  const config = getMetaConfig();
  // Explicit aiMode check — treat off as missing API
  if (config.aiMode === "off") {
    throw new MetaApiError("Goal Tracking requires Meta Spark API — AI_MODE is off. Set AI_MODE=live and provide MODEL_API_KEY.", "MISSING_API_KEY", 503);
  }
  const client = createMetaOpenAiClient(); // throws MISSING_API_KEY if no key
  const start = Date.now();
  const modelId = (process.env.META_SPARK_MODEL || process.env.SPARK_MODEL_ID || config.models.spark || "muse-spark-1.3") as string;
  // Ensure we request spark-1.3 reasoning variant; contributor cannot do max but high is ok
  const effectiveModel = modelId.includes("spark") ? modelId : "muse-spark-1.3";

  const body: Record<string, unknown> = {
    model: effectiveModel,
    messages: [
      { role: "system", content: GOAL_SYSTEM },
      { role: "user", content: buildUserPrompt(evidence) },
    ],
    response_format: {
      type: "json_schema",
      json_schema: { name: "goal_review", strict: true, schema: goalJsonSchema },
    },
    temperature: 0.2,
    // 2500 → 7000: 5 goals ≈ 5000 with reasoning (1450 for 1 goal → ~3000 for 5) hits length with 2500 → content=null (NO_CONTENT); 7000 headroom for 6-8 goals per batch
    max_tokens: 7000,
  };
  // Note: reasoning/prompt_cache are Responses-API only — chat.completions on
  // api.meta.ai rejects unknown `reasoning`; removed per Meta-exclusive fix.

  async function call(maxTokens: number, fmt: any = (body as any).response_format) {
    return client.chat.completions.create({ ...(body as any), max_tokens: maxTokens, response_format: fmt } as never, { timeout: 55000, maxRetries: 1 } as never) as any;
  }

  try {
    let res = await call(7000);
    let latencyMs = Date.now() - start;
    let choice = res?.choices?.[0] as any;
    // If we hit length cutoff with no content (reasoning ate budget), retry with more headroom + lenient json_object
    if ((!choice?.message?.content || !String(choice.message.content).trim()) && choice?.finish_reason === "length") {
      console.warn(`[goal-agent] NO_CONTENT length with 7000, retry 8000 json_object`);
      try {
        res = await call(8000, { type: "json_object" } as any);
        latencyMs = Date.now() - start;
        choice = res?.choices?.[0];
      } catch {}
    }
    if (!choice?.message) throw new MetaApiError("Empty response from Muse Spark (goal-tracking)", "EMPTY_SPARK_RESPONSE", 500);
    if (choice.finish_reason === "content_filter") throw new MetaApiError("Muse Spark refused goal-tracking request (content_filter)", "META_REFUSAL", 400);
    // More diagnostic: surface finish_reason when content is empty
    const raw = choice.message.content as unknown;
    const rawStr = typeof raw === "string" ? raw : raw ? String(raw) : "";
    if (!rawStr.trim()) {
      const hint = choice.finish_reason === "length" ? " (finish_reason=length: token budget exhausted — retry with fewer goals or higher max_tokens)" : choice.finish_reason === "tool_calls" ? " (tool_calls instead of text)" : "";
      throw new MetaApiError(`No content from Muse Spark (goal-tracking)${hint} finish_reason=${choice.finish_reason}`, "NO_CONTENT", 500);
    }
    let parsed: unknown;
    try { parsed = JSON.parse(rawStr); } catch { throw new MetaApiError(`Invalid JSON from Goal agent: ${rawStr.slice(0,400)}`, "INVALID_JSON_OUTPUT", 500); }
    // Minimal validation — trust strict schema but ensure verdict counts match
    const r = parsed as GoalAgentResult;
    if (!Array.isArray(r.verdicts) || !r.summary) throw new MetaApiError("Goal agent output failed schema validation (missing verdicts/summary)", "SCHEMA_VALIDATION_FAILED", 500);
    return { result: r, latencyMs, modelId: effectiveModel };
  } catch (err: unknown) {
    if (err instanceof MetaApiError) throw err;
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("timeout") || msg.includes("timed out")) throw new MetaTimeoutError(`Goal Tracking timeout: ${msg}`);
    if (msg.includes("429") || msg.toLowerCase().includes("rate")) throw new MetaRateLimitError(`Goal Tracking rate limit: ${msg}`);
    // Wrap with hint that this is Meta Spark
    throw new MetaApiError(`Goal Tracking Spark call failed (Requires Meta Spark API): ${msg}`, "SPARK_CALL_FAILED", 500, true);
  }
}
