import "server-only";
import { createMetaOpenAiClient, getMetaConfig } from "./client";
import { MetaApiError, MetaTimeoutError, MetaRateLimitError } from "./errors";

export type HighlightsEvidence = {
  patientId: string;
  month: string; // YYYY-MM
  soapNotes: Array<{ id: string; session_date?: string; subjective?: string; objective?: string; assessment?: string; plan?: string }>;
  homeProgramFeedback: Array<{ id: string; feedback?: string; client_comment?: string; }>;
  goalReviewLatest: any | null;
  adherence: { completionRate: number; streak: number; trend: number };
  activity: Array<{ id: string; mhr_results?: any; biomech_summary?: any; created_at?: string }>;
  counts: { soapCount: number; subCount: number; mhrCount: number; goalReviewCount: number };
  priorHighlights: any | null;
};

export type HighlightsAgentResult = {
  highlights: Array<{
    slot: number;
    slotLabel: string;
    title: string;
    story: string;
    delta: { quanti: string; quali: string };
    arrow: "↑" | "→" | "↓";
    weight: number;
    evidenceIds: string[];
  }>;
  summary: { trend: string; topDriver: string };
  priorCompare: { lastMonthTrend: string; deltaVsPrior: string };
};

const HIGHLIGHTS_SYSTEM = `You are the Aruga Highlights curator. You ingest quali+quanti for a 30d window + prior month and pick the best data points, at most one per slot:
1 Goal Progress (goals achieved+on_track/total MoM)
2 Top ROM gain (largest ROM Δ° confidence>0.6)
3 Compensation shift (flag on→off / off→on)
4 Adherence (completion % 30d vs prior 30d + streak/trend)
5 Neck / cross-age (neckAngles + forward_head)
6 Program fit (category completion %)
7 Next focus (goal risk × deadline)
Scoring: weight = |Δ|×consistency×confidence (|Δ| MoM change, consistency 3/3=1.0 1/3=0.3, confidence from mhr/goal). Prefer high-signal changes. Never invent numbers — cite mhr:/submission:/goal:/soap: ids that exist in context. Include ONLY slots with real evidence behind them: omit any slot with no signal entirely. Never emit "Not enough info yet" placeholders, weight-0 fillers, or evidenceIds you were not given.
Each highlight: title ≤ 12 words, story ≤ 25 words, delta {quanti (number), quali (keyword from SOAP/client note)}, arrow ↑→↓ (stable→), weight 0-1, evidenceIds (non-empty — every highlight must cite at least one id from context).
Return ONLY JSON matching schema. Slot titles fixed for comparability but data point is highest-weight evidence in category.`;

// Chunking: 7 slots no longer fit one call once evidence grows (reasoning ≈1500 tok +
// 7 slots output overflows 5000 → finish_reason=length, content=null → NO_CONTENT).
// Mirror goal-agent batching: 2 parallel calls (slots 1-4 movement/goals, 5-7
// neck/program/focus), each with a scoped evidence subset. ~half the output per
// call → each fits 5000 with headroom (+7000 json_object retry). Slots are
// evidence-gated: each chunk returns only slots with real evidence behind them
// (no "Not enough info yet" fillers), so the merged set is whatever the month
// actually contains (1-7 highlights). Extra cost ≈ 1 duplicated system prompt (~$0.0005).
const SLOT_LABELS_ALL = ["Goals","Movement","Steady progress","Keep going","Neck & posture","Program fit","Next step"] as const;
const SLOT_GROUPS: Array<{ slots: number[] }> = [{ slots: [1, 2, 3, 4] }, { slots: [5, 6, 7] }];

function systemForSlots(slots: number[]) {
  const labels = slots.map((s) => `${s} ${SLOT_LABELS_ALL[s - 1]}`).join(", ");
  return `${HIGHLIGHTS_SYSTEM}\nScope: consider slots ${slots.join(", ")} ONLY (${labels}). Return only slots with real evidence (up to ${slots.length}, slot numbers from [${slots.join(", ")}]). Omit the rest — no placeholders.`;
}

function soapLines(notes: HighlightsEvidence["soapNotes"], n: number, oLen = 120, aLen = 80) {
  return notes.slice(0, n).map(s=> `soap:${String(s.id).slice(0,8)} date:${s.session_date?.slice(0,10)} objective:${(s.objective||"").slice(0,oLen)} assessment:${(s.assessment||"").slice(0,aLen)}`).join("\n");
}

function mhrLines(activity: HighlightsEvidence["activity"], n: number) {
  return activity.slice(0, n).map((m:any)=> `mhr:${String(m.id).slice(0,8)} conf:${m.biomech_summary?.confidenceOverall ?? m.mhr_results?.summary?.confidenceOverall ?? "?"} summary:${JSON.stringify(m.biomech_summary||m.mhr_results?.summary||{}).slice(0,200)}`).join("\n");
}

function goalsBlock(goalReviewLatest: any, verdicts: number) {
  return goalReviewLatest ? `goal_reviews latest: ${JSON.stringify(goalReviewLatest.summary||{}).slice(0,300)} verdicts:${JSON.stringify((goalReviewLatest.verdicts||[]).slice(0,verdicts).map((v:any)=>v.verdict)).slice(0,300)}` : "(no goal review yet)";
}

function adherenceLine(ev: HighlightsEvidence) {
  return `adherence ${ev.adherence.completionRate}% streak:${ev.adherence.streak} trend:${ev.adherence.trend}% MoM counts SOAP ${ev.counts.soapCount} subs ${ev.counts.subCount} MHR ${ev.counts.mhrCount} goalReviews ${ev.counts.goalReviewCount}`;
}

// Scoped evidence per slot group — each chunk carries only what its slots score on,
// so per-call prompt stays ~half the size of the old single-call prompt.
function buildChunkUser(ev: HighlightsEvidence, slots: number[]) {
  const first = slots[0];
  if (first <= 4) {
    // Slots 1-4: goals + movement + adherence. SOAP/prior trimmed to keywords/MoM context.
    const soap = soapLines(ev.soapNotes, 3, 100, 60);
    const goals = goalsBlock(ev.goalReviewLatest, 5);
    const mhrs = mhrLines(ev.activity, 6);
    const prior = ev.priorHighlights ? `prior month: trend ${JSON.stringify((ev.priorHighlights as any).summary||{}).slice(0,150)} highlights:${JSON.stringify(((ev.priorHighlights as any).highlights||[]).slice(0,2)).slice(0,200)}` : "(no prior month)";
    return `Month ${ev.month} for patient ${ev.patientId} — slots ${slots.join(",")} scope
SOAP quali keywords (last 3):
${soap || "(none)"}
Goals:
${goals}
Movement (MHR, last 6):
${mhrs || "(none)"}
Adherence & counts:
${adherenceLine(ev)}
Prior (MoM context for slot 1):
${prior}
Include only slots ${slots.join(",")} with real evidence; omit the rest — no placeholders.`;
  }
  // Slots 5-7: neck/program/focus. SOAP + program feedback in full, goals for risk×deadline.
  const soap = soapLines(ev.soapNotes, 6);
  const prog = ev.homeProgramFeedback.slice(0, 10).map((s: any)=> `submission:${String(s.id).slice(0,8)} state:${s.feedback || s.state || "?"}${s.client_comment ? ` note:${String(s.client_comment).slice(0,60)}` : ""}`).join("\n");
  const goals = goalsBlock(ev.goalReviewLatest, 5);
  const mhrs = mhrLines(ev.activity, 3);
  const prior = ev.priorHighlights ? `prior month highlights: ${JSON.stringify(((ev.priorHighlights as any).highlights||[]).slice(0,3)).slice(0,300)}` : "(no prior month)";
  return `Month ${ev.month} for patient ${ev.patientId} — slots ${slots.join(",")} scope
SOAP (last 6):
${soap || "(none)"}
Home program feedback:
${prog || "(none)"}
Goals (for next-focus risk×deadline):
${goals}
Movement context (last 3, neck-relevant):
${mhrs || "(none)"}
Adherence & counts:
${adherenceLine(ev)}
Prior:
${prior}
Include only slots ${slots.join(",")} with real evidence; omit the rest — no placeholders.`;
}

function schemaForSlots(slots: number[]): Record<string, unknown> {
  const s: any = JSON.parse(JSON.stringify(highlightsJsonSchema));
  // Evidence-gated: a chunk may return fewer than its slots (or none) when the
  // evidence isn't there — min 0, merge step requires ≥1 highlight overall.
  s.properties.highlights.minItems = 0;
  s.properties.highlights.maxItems = slots.length;
  s.properties.highlights.items.properties.slot = { type: "integer", enum: slots };
  return s;
}

const highlightsJsonSchema = {
  type: "object",
  properties: {
    highlights: {
      type: "array",
      minItems: 7,
      maxItems: 7,
      items: {
        type: "object",
        properties: {
          slot: { type: "integer", minimum: 1, maximum: 7 },
          slotLabel: { type: "string" },
          title: { type: "string" },
          story: { type: "string" },
          delta: {
            type: "object",
            properties: {
              quanti: { type: "string" },
              quali: { type: "string" },
            },
            required: ["quanti", "quali"],
            additionalProperties: false,
          },
          arrow: { type: "string", enum: ["↑", "→", "↓"] },
          weight: { type: "number", minimum: 0, maximum: 1 },
          evidenceIds: { type: "array", items: { type: "string" } },
        },
        required: ["slot", "slotLabel", "title", "story", "delta", "arrow", "weight", "evidenceIds"],
        additionalProperties: false,
      },
    },
    summary: {
      type: "object",
      properties: {
        trend: { type: "string" },
        topDriver: { type: "string" },
      },
      required: ["trend", "topDriver"],
      additionalProperties: false,
    },
    priorCompare: {
      type: "object",
      properties: {
        lastMonthTrend: { type: "string" },
        deltaVsPrior: { type: "string" },
      },
      required: ["lastMonthTrend", "deltaVsPrior"],
      additionalProperties: false,
    },
  },
  required: ["highlights", "summary", "priorCompare"],
  additionalProperties: false,
} as const;

export async function runHighlightsAgent(evidence: HighlightsEvidence): Promise<{ result: HighlightsAgentResult; latencyMs: number; modelId: string }> {
  const config = getMetaConfig();
  if (config.aiMode === "off") {
    throw new MetaApiError("Highlights requires Meta Spark API — AI_MODE is off. Set AI_MODE=live and provide MODEL_API_KEY.", "MISSING_API_KEY", 503);
  }
  const client = createMetaOpenAiClient();
  const start = Date.now();
  const modelId = (process.env.META_SPARK_MODEL || process.env.SPARK_MODEL_ID || config.models.spark || "muse-spark-1.3") as string;
  const effectiveModel = modelId.includes("spark") ? modelId : "muse-spark-1.3";

  const body: Record<string, unknown> = {
    model: effectiveModel,
    temperature: 0.2,
    // 2500 → 5000: 7 slots + evidence with reasoning (≈1400 for small prompts) hits
    // length with 2500 → content=null (NO_CONTENT). Chunked 4+3 below keeps each
    // call at ~half output, so 5000 has headroom per chunk.
    max_tokens: 5000,
  };
  // reasoning/prompt_cache are Responses-API only — removed (chat.completions rejects `reasoning`).

  async function callChunk(slots: number[], maxTokens: number, fmt: any) {
    return client.chat.completions.create({
      ...(body as any),
      messages: [
        { role: "system", content: systemForSlots(slots) },
        { role: "user", content: buildChunkUser(evidence, slots) },
      ],
      response_format: fmt,
      max_tokens: maxTokens,
    } as never, { timeout: 55000, maxRetries: 1 } as never) as any;
  }

  async function runChunk(slots: number[]): Promise<{ result: HighlightsAgentResult; latencyMs: number }> {
    const chunkStart = Date.now();
    const fmt = { type: "json_schema", json_schema: { name: `highlights_slots_${slots.join("_")}`, strict: true, schema: schemaForSlots(slots) } } as any;
    let res = await callChunk(slots, 5000, fmt);
    let latencyMs = Date.now() - chunkStart;
    let choice = res?.choices?.[0] as any;
    // Length retry per chunk with more headroom + lenient json_object (mirrors goal-agent)
    if ((!choice?.message?.content || !String(choice.message.content).trim()) && choice?.finish_reason === "length") {
      console.warn(`[highlights-agent] NO_CONTENT length with 5000 on slots ${slots.join(",")}, retry 7000 json_object`);
      try {
        res = await callChunk(slots, 7000, { type: "json_object" } as any);
        latencyMs = Date.now() - chunkStart;
        choice = res?.choices?.[0];
      } catch {}
    }
    if (!choice?.message) throw new MetaApiError(`Empty response from Muse Spark (highlights slots ${slots.join(",")})`, "EMPTY_SPARK_RESPONSE", 500);
    if (choice.finish_reason === "content_filter") throw new MetaApiError("Muse Spark refused highlights request (content_filter)", "META_REFUSAL", 400);
    const rawAny = choice.message.content as unknown;
    const raw = typeof rawAny === "string" ? rawAny : rawAny ? String(rawAny) : "";
    if (!raw.trim()) throw new MetaApiError(`No content from Muse Spark (highlights slots ${slots.join(",")}) finish_reason=${choice.finish_reason}`, "NO_CONTENT", 500);
    let parsed: unknown;
    try { parsed = JSON.parse(raw); } catch { throw new MetaApiError(`Invalid JSON from Highlights agent (slots ${slots.join(",")}): ${raw.slice(0,400)}`, "INVALID_JSON_OUTPUT", 500); }
    const r = parsed as HighlightsAgentResult;
    if (!Array.isArray(r.highlights) || r.highlights.length > slots.length) {
      throw new MetaApiError(`Highlights agent output failed schema validation (slots ${slots.join(",")}: at most ${slots.length})`, "SCHEMA_VALIDATION_FAILED", 500);
    }
    const got = new Set(r.highlights.map((h) => h.slot));
    if (r.highlights.length !== got.size || slots.some((s) => got.has(s) && !slots.includes(s))) {
      throw new MetaApiError(`Highlights agent output failed schema validation (slots ${slots.join(",")}: duplicate or out-of-scope slot numbers)`, "SCHEMA_VALIDATION_FAILED", 500);
    }
    if (r.highlights.some((h) => !Array.isArray(h.evidenceIds) || h.evidenceIds.length === 0)) {
      throw new MetaApiError(`Highlights agent output failed schema validation (slots ${slots.join(",")}: every highlight must cite evidence)`, "SCHEMA_VALIDATION_FAILED", 500);
    }
    return { result: r, latencyMs };
  }

  try {
    // Parallel slot-group chunks (mirrors goal-agent batching) then merge.
    // Each chunk returns only slots with real evidence, so the merged set is
    // 1-7 highlights depending on what the month actually contains.
    const chunks = await Promise.all(SLOT_GROUPS.map((g) => runChunk(g.slots)));
    const highlights = chunks.flatMap((c) => c.result.highlights).sort((a, b) => a.slot - b.slot);
    if (highlights.length === 0 || highlights.length > 7 || new Set(highlights.map((h) => h.slot)).size !== highlights.length) {
      throw new MetaApiError("Highlights agent output failed schema validation (need 1-7 highlights with unique slots)", "SCHEMA_VALIDATION_FAILED", 500);
    }
    const latencyMs = chunks.reduce((a, c) => a + c.latencyMs, 0);
    // Summary comes from the goals/movement/adherence chunk; priorCompare from the
    // neck/program/focus chunk that carries prior-month evidence.
    return {
      result: { highlights, summary: chunks[0].result.summary, priorCompare: chunks[1].result.priorCompare },
      latencyMs,
      modelId: `${effectiveModel} x2 chunks (slots 1-4, 5-7)`,
    };
  } catch (err: unknown) {
    if (err instanceof MetaApiError) throw err;
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("timeout") || msg.includes("timed out")) throw new MetaTimeoutError(`Highlights timeout: ${msg}`);
    if (msg.includes("429") || msg.toLowerCase().includes("rate")) throw new MetaRateLimitError(`Highlights rate limit: ${msg}`);
    throw new MetaApiError(`Highlights Spark call failed (Requires Meta Spark API): ${msg}`, "SPARK_CALL_FAILED", 500, true);
  }
}
