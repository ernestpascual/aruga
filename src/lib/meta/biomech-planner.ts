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

export async function planBiomechConcepts(input: PlannerInput): Promise<PlannerOutput> {
  // Try Spark planner if configured
  const cfg = (()=> { try { return getMetaConfig(); } catch { return null; } })();
  const canSpark = !!(cfg && cfg.apiKey && cfg.aiMode !== "off");
  if (!canSpark) {
    return heuristicPlan(input);
  }
  try {
    const client = createMetaOpenAiClient();
    const system = `You are the Aruga biomechanic planner. You may ONLY pick from BIOMECH_KEYWORDS 16:
["person","shoulder","elbow","forearm","wrist","hand","finger","thumb","hip","knee joint","ankle joint","foot","trunk","cervical spine","thoracic spine","neck"]
Rules:
- Return 2-8 concepts, MUST include "person" as first.
- Prioritize joints most informative for the prescribed activity title + instructions + ageBand + therapist need.
- Output JSON only: {concepts: string[], rationale: string}
- Do NOT invent outside list. rationale ≤ 180 chars, explain why these joints matter for this activity.`;
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
      max_tokens: 400,
    } as never, { timeout: 15000, maxRetries: 0 } as never) as any;

    const latencyMs = Date.now() - t0;
    const raw = res?.choices?.[0]?.message?.content;
    if (!raw) throw new Error("empty Spark planner response");
    const parsed = JSON.parse(raw);
    let concepts = (parsed.concepts || []).map((s:string)=> String(s).trim()).filter(Boolean) as string[];
    // Validate against BIOMECH_KEYWORDS
    concepts = concepts.filter((c)=> isBiomechKeyword(c));
    if (!concepts.includes("person")) concepts.unshift("person");
    concepts = Array.from(new Set(concepts)).slice(0, 8) as BiomechKeyword[];
    if (concepts.length < 2) throw new Error("too few concepts from Spark");
    return { concepts: concepts as BiomechKeyword[], rationale: String(parsed.rationale||"Spark planner — activity-informed").slice(0,220), source: "spark", latencyMs };
  } catch (e) {
    // Fallback to heuristic on any Spark failure
    const h = heuristicPlan(input);
    h.rationale = `${h.rationale} (Spark unavailable → heuristic)`;
    return h;
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
  // BoS / balance always useful for adherence narrative
  expects.push({ id: "bos", label: "Base of support", metricPath: "summary.posturalAndDeformity.meanBosMarginMm", target: { max: 120 }, unit: "mm" });
  return expects.slice(0, 5);
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
