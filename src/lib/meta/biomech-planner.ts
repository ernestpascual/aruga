import "server-only";
import { getMetaConfig, createMetaOpenAiClient } from "./client";
import { BIOMECH_KEYWORDS, isBiomechKeyword, BiomechKeyword } from "./biomech-prompt";

// Fallback heuristic when Spark unavailable — maps activity text → expected metrics → concepts
const HEURISTIC_MAP: Array<{ re: RegExp; concepts: BiomechKeyword[]; rationale: string }> = [
  { re: /cup|drink|mouth|spoon|fork|eat|feed/i, concepts: ["person","shoulder","elbow","wrist","hand"], rationale: "UE reach-to-mouth activity — shoulder/elbow/hand for hand-to-mouth ROM" },
  { re: /trunk|lean|balance|sit|stand|sway|com|bos/i, concepts: ["person","trunk","hip","knee joint"], rationale: "Postural control — trunk/hip/knee for balance and BoS analysis" },
  { re: /shoulder|overhead|reach|lift|hair|groom/i, concepts: ["person","shoulder","elbow","trunk"], rationale: "Overhead/UE reach — shoulder/elbow + trunk compensation check" },
  { re: /neck|head|cervical|chin|forward head/i, concepts: ["person","neck","cervical spine","thoracic spine","trunk"], rationale: "Cervical/forward-head activity — neck spine + trunk alignment" },
  { re: /hand|finger|thumb|pincer|grasp|peg|pinch/i, concepts: ["person","hand","finger","thumb","wrist"], rationale: "Fine hand/pincer activity — hand-finger-thumb kinematics" },
  { re: /hip|knee|ankle|foot|walk|gait|squat|lunge|step/i, concepts: ["person","hip","knee joint","ankle joint","foot"], rationale: "LE/gait activity — hip-knee-ankle-foot chain" },
  { re: /bend|flexion|extension|trunk lean|pelvis/i, concepts: ["person","trunk","hip","shoulder"], rationale: "Flexion/extension — trunk/hip/shoulder ROM" },
];

export interface PlannerInput {
  prescribedTitle: string;
  prescribedInstructions: string;
  ageBand?: string;
  therapistNeed?: string;
}

export interface PlannerOutput {
  concepts: BiomechKeyword[];
  rationale: string;
  source: "spark" | "heuristic";
  latencyMs?: number;
}

// Step 0 output: what the task requires before any tracking decision is made.
// Produced by analyzeBiomechTask; consumed by the draft planner and shown in UI
// as "what the agent understood" for therapist review.
export interface BiomechTarget {
  metric: string;
  direction: string;
  expectedRange: string;
  why: string;
}

export interface BiomechAnalysis {
  movementAnalysis: string;
  targets: BiomechTarget[];
  watchFor: string[];
  candidateConcepts: string[];
}

// Step 2 output: the finalized SAM 3.1 tracking list. `concepts` is the exact
// array forwarded to sam3Engine.segmentConcepts — the final SAM prompt.
export interface FinalizedPlan {
  concepts: BiomechKeyword[];
  dropped: Array<{ concept: string; reason: string }>;
  perConceptUse: Array<{ concept: string; use: string }>;
  rationale: string;
  source: "spark" | "heuristic";
  latencyMs?: number;
}

/** Deterministic concept hygiene: lock-list only, person first, deduped, clamped to 8. */
export function sanitizeConcepts(concepts: string[]): BiomechKeyword[] {
  let out = (concepts || []).map((s) => String(s).trim()).filter(Boolean) as string[];
  out = out.filter((c) => isBiomechKeyword(c));
  if (!out.includes("person")) out.unshift("person");
  return Array.from(new Set(out)).slice(0, 8) as BiomechKeyword[];
}

function heuristicPlan(input: PlannerInput): PlannerOutput {
  const haystack = `${input.prescribedTitle} ${input.prescribedInstructions} ${input.therapistNeed||""}`;
  // Collect matching heuristic concepts
  const matched: BiomechKeyword[] = [];
  const rationales: string[] = [];
  for (const m of HEURISTIC_MAP) {
    if (m.re.test(haystack)) {
      for (const c of m.concepts) if (!matched.includes(c)) matched.push(c);
      rationales.push(m.rationale);
    }
  }
  // Ensure person always first, clamp to 2-8
  if (!matched.includes("person")) matched.unshift("person");
  const concepts = matched.slice(0, 8) as BiomechKeyword[];
  // Fallback if nothing matched
  if (concepts.length <= 2) {
    return { concepts: ["person","shoulder","elbow","trunk"], rationale: "General functional movement — UE + trunk compensation screen (no specific keywords matched).", source: "heuristic" };
  }
  return {
    concepts: concepts as BiomechKeyword[],
    rationale: rationales.slice(0,2).join(" + ") || "Activity-informed planner — selected joints most informative for prescribed task.",
    source: "heuristic"
  };
}

export async function planBiomechConcepts(input: PlannerInput, opts?: { analysis?: BiomechAnalysis | null }): Promise<PlannerOutput> {
  // Try Spark planner if configured
  const cfg = (()=> { try { return getMetaConfig(); } catch { return null; } })();
  const canSpark = !!(cfg && cfg.apiKey && cfg.aiMode !== "off");
  if (!canSpark) {
    return heuristicPlan(input);
  }
  try {
    const client = createMetaOpenAiClient();
    const analysisCtx = opts?.analysis ? `
Therapist-verified task analysis (use this as ground truth for what to track):
- Movement: ${(opts.analysis.movementAnalysis || "").slice(0, 300)}
- Targets: ${(opts.analysis.targets || []).slice(0, 6).map((t) => `${t.metric} (${t.direction}, expect ${t.expectedRange})`).join("; ").slice(0, 400)}
- Watch for: ${(opts.analysis.watchFor || []).slice(0, 6).join("; ").slice(0, 200)}
- Candidate joints to consider first: ${(opts.analysis.candidateConcepts || []).slice(0, 8).join(", ")}
Consider the candidates seriously, but use your own judgment — final list must still be 2-8 from the lock list.` : "";
    const system = `You are the Aruga biomechanic planner. You may ONLY pick from BIOMECH_KEYWORDS 16:
["person","shoulder","elbow","forearm","wrist","hand","finger","thumb","hip","knee joint","ankle joint","foot","trunk","cervical spine","thoracic spine","neck"]
Rules:
- Return 2-8 concepts, MUST include "person" as first.
- Prioritize joints most informative for the prescribed activity title + instructions + ageBand + therapist need.
- Output JSON only: {concepts: string[], rationale: string}
- Do NOT invent outside list. rationale ≤ 180 chars, explain why these joints matter for this activity.${analysisCtx}`;
    const user = `Prescribed Activity Title: "${(input.prescribedTitle||"").slice(0,120)}"
Instructions: "${(input.prescribedInstructions||"").slice(0,400)}"
AgeBand: ${input.ageBand||"adult"}
Therapist focus: "${(input.therapistNeed||"").slice(0,120)}"
Pick concepts.`;

    const t0 = Date.now();
    const res = await client.chat.completions.create({
      model: cfg!.models.spark,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "biomech_planner",
          strict: true,
          schema: {
            type: "object",
            properties: {
              concepts: { type: "array", items: { type: "string" }, minItems: 2, maxItems: 8 },
              rationale: { type: "string" },
            },
            required: ["concepts", "rationale"],
            additionalProperties: false,
          }
        }
      },
      temperature: 0.2,
      // was 400 → NO_CONTENT: reasoning alone ≈1000+ tok, so 400 always hits length with content=null
      max_tokens: 1200,
    } as never, { timeout: 15000, maxRetries: 0 } as never) as any;

    let latencyMs = Date.now() - t0;
    let choice0: any = res?.choices?.[0];
    let raw: unknown = choice0?.message?.content;
    // length retry with more headroom (cheap: tiny prompt, reasoning overhead)
    if ((!raw || !String(raw).trim()) && choice0?.finish_reason === "length") {
      console.warn(`[biomech-planner] NO_CONTENT length with 1200, retry 2000 json_object`);
      try {
        const retry: any = await client.chat.completions.create({
          model: cfg!.models.spark,
          messages: [{ role: "system", content: system }, { role: "user", content: user }],
          response_format: { type: "json_object" } as never,
          temperature: 0.2,
          max_tokens: 2000,
        } as never, { timeout: 15000, maxRetries: 0 } as never);
        choice0 = retry?.choices?.[0];
        raw = choice0?.message?.content;
        latencyMs = Date.now() - t0;
      } catch {}
    }
    if (!raw) throw new Error("empty Spark planner response");
    const parsed = JSON.parse(String(raw));
    const concepts = sanitizeConcepts(parsed.concepts || []);
    if (concepts.length < 2) throw new Error("too few concepts from Spark");
    return { concepts: concepts as BiomechKeyword[], rationale: String(parsed.rationale||"Spark planner — activity-informed").slice(0,220), source: "spark", latencyMs };
  } catch (e) {
    // Fallback to heuristic on any Spark failure
    const h = heuristicPlan(input);
    h.rationale = `${h.rationale} (Spark unavailable → heuristic)`;
    return h;
  }
}

/**
 * Step 0 — Task analysis. Reads the prescription the way a clinician would and
 * decides what the agent should try to get out of the video: the driving
 * movement, the measurable targets (angle/range + expectation), what
 * compensations to watch for, and candidate joints. Pure reasoning step —
 * returns null when Spark is unavailable so the pipeline still runs.
 */
export async function analyzeBiomechTask(input: PlannerInput): Promise<BiomechAnalysis | null> {
  const cfg = (()=> { try { return getMetaConfig(); } catch { return null; } })();
  const canSpark = !!(cfg && cfg.apiKey && cfg.aiMode !== "off");
  if (!canSpark) return null;
  try {
    const client = createMetaOpenAiClient();
    const system = `You are the Aruga biomechanic task analyst. Read a prescribed therapy activity and decide what a motion-analysis agent should measure from the patient's video.
Rules:
- Analyze the movement first: which joints drive it, what good execution looks like for the given ageBand.
- Targets must be measurable from video (joint angles, ranges, holds, symmetry, trunk compensation).
- Candidate joints MUST come from BIOMECH_KEYWORDS 16 only: ["person","shoulder","elbow","forearm","wrist","hand","finger","thumb","hip","knee joint","ankle joint","foot","trunk","cervical spine","thoracic spine","neck"].
- Output JSON only: {movementAnalysis: string, targets: [{metric, direction, expectedRange, why}], watchFor: string[], candidateConcepts: string[]}.
- movementAnalysis ≤ 300 chars. Up to 6 targets, up to 6 watchFor strings (≤ 80 chars each), up to 8 candidateConcepts.`;
    const user = `Prescribed Activity Title: "${(input.prescribedTitle||"").slice(0,120)}"
Instructions: "${(input.prescribedInstructions||"").slice(0,600)}"
AgeBand: ${input.ageBand||"adult"}
Therapist focus / client note: "${(input.therapistNeed||"").slice(0,200)}"
Analyze what to measure.`;

    const t0 = Date.now();
    const res = await client.chat.completions.create({
      model: cfg!.models.spark,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "biomech_task_analysis",
          strict: true,
          schema: {
            type: "object",
            properties: {
              movementAnalysis: { type: "string" },
              targets: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    metric: { type: "string" },
                    direction: { type: "string" },
                    expectedRange: { type: "string" },
                    why: { type: "string" },
                  },
                  required: ["metric", "direction", "expectedRange", "why"],
                  additionalProperties: false,
                },
              },
              watchFor: { type: "array", items: { type: "string" } },
              candidateConcepts: { type: "array", items: { type: "string" } },
            },
            required: ["movementAnalysis", "targets", "watchFor", "candidateConcepts"],
            additionalProperties: false,
          }
        }
      },
      temperature: 0.2,
      // Reasoning-heavy prompt: needs headroom above the ~1000 tok reasoning overhead or we get finish_reason=length with content=null
      max_tokens: 2000,
    } as never, { timeout: 20000, maxRetries: 0 } as never) as any;

    let latencyMs = Date.now() - t0;
    let choice0: any = res?.choices?.[0];
    let raw: unknown = choice0?.message?.content;
    if ((!raw || !String(raw).trim()) && choice0?.finish_reason === "length") {
      console.warn(`[biomech-analyzer] NO_CONTENT length with 2000, retry 3000 json_object`);
      try {
        const retry: any = await client.chat.completions.create({
          model: cfg!.models.spark,
          messages: [{ role: "system", content: system }, { role: "user", content: user }],
          response_format: { type: "json_object" } as never,
          temperature: 0.2,
          max_tokens: 3000,
        } as never, { timeout: 20000, maxRetries: 0 } as never);
        choice0 = retry?.choices?.[0];
        raw = choice0?.message?.content;
        latencyMs = Date.now() - t0;
      } catch {}
    }
    if (!raw) throw new Error("empty Spark analyzer response");
    const parsed = JSON.parse(String(raw));
    const targets = Array.isArray(parsed.targets) ? parsed.targets.slice(0, 6).map((t: any) => ({
      metric: String(t?.metric || "movement").slice(0, 80),
      direction: String(t?.direction || "").slice(0, 120),
      expectedRange: String(t?.expectedRange || "").slice(0, 80),
      why: String(t?.why || "").slice(0, 160),
    })) : [];
    const watchFor = Array.isArray(parsed.watchFor) ? parsed.watchFor.map((s: unknown) => String(s).slice(0, 80)).filter(Boolean).slice(0, 6) : [];
    const candidateConcepts = Array.isArray(parsed.candidateConcepts)
      ? parsed.candidateConcepts.map((s: unknown) => String(s).trim()).filter((c: string) => isBiomechKeyword(c)).slice(0, 8)
      : [];
    void latencyMs;
    return {
      movementAnalysis: String(parsed.movementAnalysis || "Functional movement analysis.").slice(0, 300),
      targets,
      watchFor,
      candidateConcepts,
    };
  } catch {
    // Analysis is advisory — pipeline continues without it
    return null;
  }
}

/**
 * Step 2 — Finalize the SAM 3.1 prompt. Reviews the draft concept list against
 * the task analysis and returns the exact tracking list forwarded to SAM.
 * Strictly a subset of the draft (may drop, never add); lock-list and
 * person-first are re-enforced deterministically so the output is always valid.
 */
export async function finalizeBiomechPrompt(args: {
  draftConcepts: string[];
  analysis: BiomechAnalysis | null;
  input: PlannerInput;
}): Promise<FinalizedPlan> {
  const { draftConcepts, analysis, input } = args;
  const draftSanitized = sanitizeConcepts(draftConcepts);
  const cfg = (()=> { try { return getMetaConfig(); } catch { return null; } })();
  const canSpark = !!(cfg && cfg.apiKey && cfg.aiMode !== "off");

  const ruleBased = (reason: string): FinalizedPlan => ({
    concepts: draftSanitized.length >= 2 ? draftSanitized : heuristicPlan(input).concepts,
    dropped: draftConcepts
      .map((c) => String(c).trim())
      .filter((c) => c && !draftSanitized.includes(c as BiomechKeyword))
      .slice(0, 8)
      .map((c) => ({ concept: c, reason })),
    perConceptUse: [],
    rationale: reason,
    source: "heuristic",
  });

  if (!canSpark || draftSanitized.length === 0) {
    if (draftSanitized.length === 0) {
      const h = heuristicPlan(input);
      return { concepts: h.concepts, dropped: [], perConceptUse: [], rationale: h.rationale, source: "heuristic" };
    }
    return ruleBased("Rule-based finalization (Spark unavailable) — draft list kept after lock/person checks.");
  }

  try {
    const client = createMetaOpenAiClient();
    const system = `You are the Aruga biomechanic reviewer. Given a draft tracking list and a task analysis, produce the FINAL list of body concepts for SAM 3.1 video segmentation.
Rules:
- FINAL list must be a SUBSET of the draft list: you may DROP concepts, never add new ones. Person must stay first.
- Keep 2-8 concepts. Drop anything redundant, unlikely to be visible, or irrelevant to the measurement targets.
- perConceptUse: one line per kept concept (≤ 100 chars) stating which target/angle/flag it serves.
- dropped: every removed draft concept with reason ≤ 120 chars (may be empty array).
- Output JSON only: {concepts: string[], dropped: [{concept, reason}], perConceptUse: [{concept, use}], rationale: string}.
- rationale ≤ 180 chars: why this final list is the right SAM prompt for the activity.`;
    const user = `Draft concepts: [${draftSanitized.join(", ")}]
Task analysis: ${(analysis?.movementAnalysis || "(no analysis — judge from activity text alone)").slice(0, 300)}
Targets: ${(analysis?.targets || []).map((t) => `${t.metric} (${t.direction}, expect ${t.expectedRange})`).join("; ").slice(0, 400) || "(none listed)"}
Watch for: ${(analysis?.watchFor || []).join("; ").slice(0, 200) || "(none listed)"}
Activity: "${(input.prescribedTitle||"").slice(0,120)}" / "${(input.prescribedInstructions||"").slice(0,400)}" AgeBand: ${input.ageBand||"adult"}
Finalize the SAM prompt.`;

    const t0 = Date.now();
    const res = await client.chat.completions.create({
      model: cfg!.models.spark,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "biomech_finalize",
          strict: true,
          schema: {
            type: "object",
            properties: {
              concepts: { type: "array", items: { type: "string" }, minItems: 2, maxItems: 8 },
              dropped: {
                type: "array",
                items: {
                  type: "object",
                  properties: { concept: { type: "string" }, reason: { type: "string" } },
                  required: ["concept", "reason"],
                  additionalProperties: false,
                },
              },
              perConceptUse: {
                type: "array",
                items: {
                  type: "object",
                  properties: { concept: { type: "string" }, use: { type: "string" } },
                  required: ["concept", "use"],
                  additionalProperties: false,
                },
              },
              rationale: { type: "string" },
            },
            required: ["concepts", "dropped", "perConceptUse", "rationale"],
            additionalProperties: false,
          }
        }
      },
      temperature: 0.2,
      max_tokens: 1200,
    } as never, { timeout: 15000, maxRetries: 0 } as never) as any;

    let latencyMs = Date.now() - t0;
    let choice0: any = res?.choices?.[0];
    let raw: unknown = choice0?.message?.content;
    if ((!raw || !String(raw).trim()) && choice0?.finish_reason === "length") {
      console.warn(`[biomech-finalize] NO_CONTENT length with 1200, retry 2000 json_object`);
      try {
        const retry: any = await client.chat.completions.create({
          model: cfg!.models.spark,
          messages: [{ role: "system", content: system }, { role: "user", content: user }],
          response_format: { type: "json_object" } as never,
          temperature: 0.2,
          max_tokens: 2000,
        } as never, { timeout: 15000, maxRetries: 0 } as never);
        choice0 = retry?.choices?.[0];
        raw = choice0?.message?.content;
        latencyMs = Date.now() - t0;
      } catch {}
    }
    if (!raw) throw new Error("empty Spark finalize response");
    const parsed = JSON.parse(String(raw));
    // Enforce subset + lock + person-first deterministically — model output is advisory
    const draftSet = new Set(draftSanitized);
    const modelConcepts = Array.isArray(parsed.concepts) ? parsed.concepts.map((s: unknown) => String(s).trim()) : [];
    const keptInOrder = modelConcepts.filter((c: string) => draftSet.has(c as BiomechKeyword));
    const finalConcepts = sanitizeConcepts(keptInOrder.length > 0 ? keptInOrder : draftSanitized);
    const finalSet = new Set(finalConcepts);
    const modelDropped: Record<string, string> = {};
    if (Array.isArray(parsed.dropped)) {
      for (const d of parsed.dropped) {
        if (d && typeof d.concept === "string" && typeof d.reason === "string") modelDropped[d.concept.trim()] = d.reason.slice(0, 120);
      }
    }
    const dropped = draftSanitized
      .filter((c) => !finalSet.has(c))
      .map((c) => ({ concept: c, reason: modelDropped[c] || "Removed in final review — lower priority for the measurement targets." }));
    const perConceptUse = Array.isArray(parsed.perConceptUse)
      ? parsed.perConceptUse
          .filter((p: any) => p && typeof p.concept === "string" && finalSet.has(p.concept.trim() as BiomechKeyword))
          .slice(0, 8)
          .map((p: any) => ({ concept: String(p.concept).trim(), use: String(p.use || "").slice(0, 100) }))
      : [];
    if (finalConcepts.length < 2) {
      const h = heuristicPlan(input);
      return { concepts: h.concepts, dropped, perConceptUse: [], rationale: h.rationale, source: "heuristic", latencyMs };
    }
    return {
      concepts: finalConcepts,
      dropped: dropped.slice(0, 8),
      perConceptUse,
      rationale: String(parsed.rationale || "Finalized SAM tracking list.").slice(0, 220),
      source: "spark",
      latencyMs,
    };
  } catch {
    return ruleBased("Rule-based finalization (reviewer call failed) — draft list kept after lock/person checks.");
  }
}

// Lightweight adherence heuristic — deterministic, no LLM
export function deriveExpectation(title: string, instructions: string): Array<{ id: string; label: string; metricPath: string; target: { min?: number; max?: number }; unit: string; higherIsBetter?: boolean }> {
  const t = `${title} ${instructions}`.toLowerCase();
  const expects: Array<{ id: string; label: string; metricPath: string; target: any; unit: string }> = [];
  // Generic screens always present
  // Shoulder flex for UE tasks
  if (/shoulder|reach|lift|overhead|cup|drink|hair|arm|elbow|hand/i.test(t)) {
    expects.push({ id: "shoulderFlex", label: "Shoulder flexion", metricPath: "summary.peakAngles.shoulderFlex_max", target: { min: 120 }, unit: "°" });
  }
  if (/trunk|lean|balance|sit|stand|compensation/i.test(t)) {
    expects.push({ id: "trunkLean", label: "Trunk lean", metricPath: "frames[].angles.trunkLean_max", target: { max: 8 }, unit: "°" });
  } else {
    // Always monitor trunk compensation as secondary
    expects.push({ id: "trunkLean", label: "Trunk compensation", metricPath: "frames[].angles.trunkLean", target: { max: 12 }, unit: "°" });
  }
  if (/neck|head|cervical|chin/i.test(t)) {
    expects.push({ id: "neckFlex", label: "Neck flexion", metricPath: "summary.peakAngles.neckFlex_max", target: { min: 0, max: 30 }, unit: "°" });
  }
  if (/hip|knee|ankle|leg|walk|gait|stand|squat/i.test(t)) {
    expects.push({ id: "kneeFlex", label: "Knee flexion", metricPath: "summary.peakAngles.kneeFlex_L_max", target: { min: 60 }, unit: "°" });
  }
  // Wrist / hand / forearm / thumb — always grade for tendon-gliding example; keep permissive so compare shows
  const isHandTask = /wrist|forearm|hand|finger|thumb|pincer|grasp|tendon.?glid|hook|fist|open hand|peg|pinch/i.test(t);
  if (isHandTask || true) { // always include at least one wrist metric so Compare grades it
    if (isHandTask) {
      expects.push({ id: "wristFlex", label: "Wrist flexion (tendons)", metricPath: "summary.peakAngles.wristFlex_L_max", target: { min: 10, max: 60 }, unit: "°" });
      expects.push({ id: "fingerAperture", label: "Finger aperture (thumb-index)", metricPath: "summary.rom.fingerAperture_range_mm", target: { min: 18 }, unit: "mm" });
      expects.push({ id: "wristDeviation", label: "Wrist deviation", metricPath: "frames[].angles.wristDeviation_max", target: { max: 25 }, unit: "°" });
    } else {
      expects.push({ id: "wristFlex", label: "Wrist posture", metricPath: "summary.peakAngles.wristFlex_L_max", target: { min: 0, max: 50 }, unit: "°" });
    }
  }
  // BoS / balance always useful for adherence narrative
  expects.push({ id: "bos", label: "Base of support", metricPath: "summary.posturalAndDeformity.meanBosMarginMm", target: { max: 120 }, unit: "mm" });
  return expects.slice(0, 6);
}

export function thresholdBand(value: number | null, target: { min?: number; max?: number }): "Good"|"Watch"|"Needs support" {
  if (value == null || isNaN(value)) return "Watch";
  if (target.min !== undefined && target.max !== undefined) {
    if (value >= target.min && value <= target.max) return "Good";
    const margin = Math.max(10, (target.max - target.min) * 0.5);
    if (value >= target.min - margin && value <= target.max + margin) return "Watch";
    return "Needs support";
  }
  if (target.min !== undefined) {
    if (value >= target.min) return "Good";
    if (value >= target.min * 0.75) return "Watch";
    return "Needs support";
  }
  if (target.max !== undefined) {
    if (value <= target.max) return "Good";
    if (value <= target.max * 1.4) return "Watch";
    return "Needs support";
  }
  return "Watch";
}
