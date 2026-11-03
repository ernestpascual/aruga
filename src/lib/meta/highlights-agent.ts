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
Scoring: weight = |Δ|×consistency×confidence (|Δ| MoM change, consistency 3/3=1.0 1/3=0.3, confidence from mhr/goal). Prefer high-signal changes. Never invent numbers — cite mhr:/submission:/goal:/soap: ids that exist in context. Include ONLY slots with real evidence behind them; if evidence is thin, include the closest-match slot with the strongest available signal. Never emit "Not enough info yet" placeholders or weight-0 fillers.
Each highlight: title ≤ 12 words, story ≤ 25 words, delta {quanti (number), quali (keyword from SOAP/client note)}, arrow ↑→↓ (stable→), weight 0-1, evidenceIds (cite at least one real id from context per highlight).
Return ONLY JSON matching schema. Slot titles fixed for comparability but data point is highest-weight evidence in category.`;

// Chunking: 7 slots no longer fit one call once evidence grows (reasoning ≈1500 tok +
// 7 slots output overflows 5000 → finish_reason=length, content=null → NO_CONTENT).
// Mirror goal-agent batching: 2 parallel calls (slots 1-4 movement/goals, 5-7
// neck/program/focus), each with a scoped evidence subset. ~half the output per
// call → each fits 5000 with headroom (+7000 json_object retry). Schema floors
// (2 for slots 1-4, 1 for slots 5-7) guarantee 3–7 highlights total — never 0,
// never forced 7. Extra cost ≈ 1 duplicated system prompt (~$0.0005).
const SLOT_LABELS_ALL = ["Goals","Movement","Steady progress","Keep going","Neck & posture","Program fit","Next step"] as const;
const SLOT_GROUPS: Array<{ slots: number[] }> = [{ slots: [1, 2, 3, 4] }, { slots: [5, 6, 7] }];

function systemForSlots(slots: number[]) {
  const labels = slots.map((s) => `${s} ${SLOT_LABELS_ALL[s - 1]}`).join(", ");
  const min = slots.length - 2;
  return `${HIGHLIGHTS_SYSTEM}\nScope: consider slots ${slots.join(", ")} ONLY (${labels}). Return ${min}–${slots.length} highlights with slot numbers from [${slots.join(", ")}]. Include only slots with real evidence; if evidence is thin, include the closest-match slot with the strongest available signal. Omit the rest — no placeholders.`;
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
Return 2–4 highlights from slots ${slots.join(",")}, only where real evidence exists; if thin, include the closest match. Never invent ids.`;
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
Return 1–3 highlights from slots ${slots.join(",")}, only where real evidence exists; if thin, include the closest match. Never invent ids.`;
}

function schemaForSlots(slots: number[]): Record<string, unknown> {
  const s: any = JSON.parse(JSON.stringify(highlightsJsonSchema));
  // Floor per chunk (slots 1-4 → min 2, slots 5-7 → min 1) guarantees 3–7 total.
  // min/max shape (not enum) matches the previously working schema.
  s.properties.highlights.minItems = Math.max(1, slots.length - 2);
  s.properties.highlights.maxItems = slots.length;
  s.properties.highlights.items.properties.slot = { type: "integer", minimum: slots[0], maximum: slots[slots.length - 1] };
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
    // 2500 → 7000: slots 1-4 output + reasoning overflow 5000 → finish_reason=length
    // mid-JSON (truncated, non-empty → INVALID_JSON_OUTPUT). Chunked 4+3 below keeps
    // each call at ~half the old output, and runChunk retries truncation at 8000.
    max_tokens: 7000,
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
    const contentOf = (c: any): string => {
      const m = c?.message?.content as unknown;
      return typeof m === "string" ? m : m ? String(m) : "";
    };
    const parseable = (s: string): boolean => { try { JSON.parse(s); return true; } catch { return false; } };
    let res = await callChunk(slots, 7000, fmt);
    let latencyMs = Date.now() - chunkStart;
    let choice = res?.choices?.[0] as any;
    let raw = contentOf(choice);
    // Length retry: empty output OR truncated mid-JSON output with finish_reason=length
    // gets more headroom + lenient json_object (mirrors goal-agent). The old check
    // only retried empty content, so truncated JSON fell through to INVALID_JSON_OUTPUT.
    if ((!raw.trim() || !parseable(raw)) && choice?.finish_reason === "length") {
      console.warn(`[highlights-agent] truncated/empty with 7000 on slots ${slots.join(",")}, retry 8000 json_object`);
      try {
        const retryRes = await callChunk(slots, 8000, { type: "json_object" } as any);
        const retryChoice = retryRes?.choices?.[0] as any;
        const retryRaw = contentOf(retryChoice);
        if (retryRaw.trim() && parseable(retryRaw)) {
          res = retryRes;
          latencyMs = Date.now() - chunkStart;
          choice = retryChoice;
          raw = retryRaw;
        }
      } catch {}
    }
    if (!choice?.message) throw new MetaApiError(`Empty response from Muse Spark (highlights slots ${slots.join(",")})`, "EMPTY_SPARK_RESPONSE", 500);
    if (choice.finish_reason === "content_filter") throw new MetaApiError("Muse Spark refused highlights request (content_filter)", "META_REFUSAL", 400);
    if (!raw.trim()) throw new MetaApiError(`No content from Muse Spark (highlights slots ${slots.join(",")}) finish_reason=${choice.finish_reason}`, "NO_CONTENT", 500);
    let parsed: unknown;
    try { parsed = JSON.parse(raw); } catch { throw new MetaApiError(`Invalid JSON from Highlights agent (slots ${slots.join(",")}): ${raw.slice(0,400)}`, "INVALID_JSON_OUTPUT", 500); }
    const r = parsed as HighlightsAgentResult;
    if (!Array.isArray(r.highlights)) {
      throw new MetaApiError(`Highlights agent output failed schema validation (slots ${slots.join(",")}: highlights is not an array)`, "SCHEMA_VALIDATION_FAILED", 500);
    }
    // Repair instead of rejecting: keep in-scope slots only (first wins on
    // duplicates), patch missing display fields with safe defaults. Strict
    // json_schema already enforces shape; this covers the lenient retry path.
    // A chunk that yields nothing usable still counts as a chunk failure below.
    const seen = new Set<number>();
    const repaired: HighlightsAgentResult["highlights"] = [];
    for (const h of r.highlights as any[]) {
      const slot = typeof h?.slot === "number" ? h.slot : Number(h?.slot);
      if (!Number.isInteger(slot) || !slots.includes(slot) || seen.has(slot)) continue;
      seen.add(slot);
      repaired.push({
        slot,
        slotLabel: typeof h?.slotLabel === "string" && h.slotLabel ? h.slotLabel : SLOT_LABELS_ALL[slot - 1] || `Slot ${slot}`,
        title: typeof h?.title === "string" && h.title ? h.title.slice(0, 120) : "Monthly update",
        story: typeof h?.story === "string" && h.story ? h.story.slice(0, 200) : "Progress this month.",
        delta: {
          quanti: typeof h?.delta?.quanti === "string" ? h.delta.quanti : "—",
          quali: typeof h?.delta?.quali === "string" ? h.delta.quali : "",
        },
        arrow: h?.arrow === "↑" || h?.arrow === "↓" ? h.arrow : "→",
        weight: typeof h?.weight === "number" && h.weight >= 0 && h.weight <= 1 ? h.weight : 0.3,
        evidenceIds: Array.isArray(h?.evidenceIds) ? h.evidenceIds.map(String) : [],
      });
    }
    r.highlights = repaired;
    const summary = r.summary && typeof r.summary.trend === "string"
      ? r.summary
      : { trend: "mixed", topDriver: "Monthly review" };
    const priorCompare = r.priorCompare && typeof r.priorCompare.lastMonthTrend === "string"
      ? r.priorCompare
      : { lastMonthTrend: "—", deltaVsPrior: "no prior comparison" };
    return { result: { ...r, summary, priorCompare }, latencyMs };
  }

  try {
    // Parallel slot-group chunks (mirrors goal-agent batching) then merge.
    // Schema floors (2 + 1) guarantee 3–7 highlights when both chunks succeed.
    // A failed chunk doesn't fail the run: merge whatever succeeded so the UI
    // shows real highlights instead of the "call failed" placeholder state.
    const settled = await Promise.allSettled(SLOT_GROUPS.map((g) => runChunk(g.slots)));
    const fulfilled = settled
      .map((s, i) => ({ s, i }))
      .filter((x): x is { s: PromiseFulfilledResult<{ result: HighlightsAgentResult; latencyMs: number }>; i: number } => x.s.status === "fulfilled")
      .map((x) => ({ ...x.s.value, groupIndex: x.i }));
    for (const [idx, s] of settled.entries()) {
      if (s.status === "rejected") {
        console.warn(`[highlights-agent] chunk slots ${SLOT_GROUPS[idx].slots.join(",")} failed, continuing with ${fulfilled.length} chunk(s): ${String((s.reason as Error)?.message || s.reason).slice(0, 200)}`);
      }
    }
    const highlights = fulfilled
      .flatMap((c) => c.result.highlights)
      .sort((a, b) => a.slot - b.slot);
    const deduped = [...new Map(highlights.map((h) => [h.slot, h])).values()].sort((a, b) => a.slot - b.slot);
    if (deduped.length === 0) {
      const firstErr = (settled.find((s) => s.status === "rejected") as PromiseRejectedResult | undefined)?.reason;
      if (firstErr instanceof MetaApiError) throw firstErr;
      throw new MetaApiError(`No highlights produced by any chunk${firstErr ? `: ${String((firstErr as Error)?.message || firstErr).slice(0, 200)}` : ""}`, "NO_CONTENT", 500);
    }
    const latencyMs = fulfilled.reduce((a, c) => a + c.latencyMs, 0);
    // Summary prefers the goals/movement/adherence chunk; priorCompare prefers the
    // neck/program/focus chunk that carries prior-month evidence; fall back across.
    const chunkA = fulfilled.find((c) => c.groupIndex === 0)?.result;
    const chunkB = fulfilled.find((c) => c.groupIndex === 1)?.result;
    const summary = chunkA?.summary || chunkB?.summary || { trend: "mixed", topDriver: "Monthly review" };
    const priorCompare = chunkB?.priorCompare || chunkA?.priorCompare || { lastMonthTrend: "—", deltaVsPrior: "no prior comparison" };
    return {
      result: { highlights: deduped, summary, priorCompare },
      latencyMs,
      modelId: `${effectiveModel} x${fulfilled.length} chunk(s) (slots 1-4, 5-7)`,
    };
  } catch (err: unknown) {
    if (err instanceof MetaApiError) throw err;
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("timeout") || msg.includes("timed out")) throw new MetaTimeoutError(`Highlights timeout: ${msg}`);
    if (msg.includes("429") || msg.toLowerCase().includes("rate")) throw new MetaRateLimitError(`Highlights rate limit: ${msg}`);
    throw new MetaApiError(`Highlights Spark call failed (Requires Meta Spark API): ${msg}`, "SPARK_CALL_FAILED", 500, true);
  }
}
