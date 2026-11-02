import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { runSparkActivitySpec, runMuseImage } from "./activity-generator";

/**
 * Activity Agent — Phase 0
 * Planner + 3 tools (fetch_patient, list_templates, generate_activity)
 * Uses Responses-ready pattern on top of existing chat.completions (see plan/ACTIVITY_AGENT_PLAN.md)
 */

function mapCategory(cat?: string | null): string {
  const v = (cat || "pedia").toLowerCase();
  if (v === "pedia" || v === "adolescent" || v === "adult" || v === "geriatric" || v === "old_people") return v;
  return "adult";
}
function mapToAgeBand(clientCategory?: string | null): "pedia" | "adolescent" | "adult" | "geriatric" {
  switch (mapCategory(clientCategory)) {
    case "pedia": return "pedia";
    case "adolescent": return "adolescent";
    case "adult": return "adult";
    case "old_people":
    case "geriatric": return "geriatric";
    default: return "adult";
  }
}
function deriveTheme(title: string, instructions: string): string {
  const raw = `${title || ""} ${instructions || ""}`.trim().replace(/\s+/g, " ");
  return raw.slice(0, 80);
}

export type AgentRunInput = {
  patientId: string;
  creatorId?: string | null;
  step: { title: string; instructions: string; position: number };
  action?: "auto_draft" | "regenerate";
  feedback?: string;
  generateImage?: boolean;
  targetGoalKind?: "ltg" | "stg" | null;
  targetGoalText?: string | null;
};

export type AgentDraft = {
  draftId: string;
  status: "pending_approval";
  title: string;
  instructions: string;
  ageBand: "pedia" | "adolescent" | "adult" | "geriatric";
  category: string;
  sparkSpec: Record<string, unknown>;
  base_image_url: string | null;
  reasoning: string;
  sources: string[];
  modelIds: { spark: string; image?: string | null };
  latencyMs: number;
};

async function fetchPatient(admin: NonNullable<ReturnType<typeof createAdminClient>>, patientId: string) {
  // Accept either patients.id or profiles.id (client_user_id) — client dashboard passes user.id
  let pat: any = null;
  let patErr: unknown = null;
  {
    const { data, error } = await admin.from("patients").select("id, client_user_id, therapist_id, client_category, age, condition, caregiver_name, long_term_goals, short_term_goals").eq("id", patientId).maybeSingle();
    pat = data;
    patErr = error;
    if (!pat) {
      const { data: byClient, error: byClientErr } = await admin.from("patients").select("id, client_user_id, therapist_id, client_category, age, condition, caregiver_name, long_term_goals, short_term_goals").eq("client_user_id", patientId).maybeSingle();
      if (byClient) { pat = byClient; patErr = null; }
      else if (byClientErr) patErr = byClientErr;
    }
  }
  if (patErr) {
    console.error("[agent/fetchPatient] DB error:", (patErr as { message?: string })?.message || String(patErr));
  }
  if (pat) {
    const canonicalId: string = pat.id;
    const { data: priorActivities } = await admin.from("generated_activities").select("title, category, age_band").eq("patient_id", canonicalId).order("created_at", { ascending: false }).limit(10);
    const priorThemes = (priorActivities || []).map((a) => a.title).slice(0, 5);
    const ageBand = mapToAgeBand(pat.client_category);
    let displayName: string | null = null;
    if (pat.client_user_id) {
      const { data: prof } = await admin.from("profiles").select("display_name").eq("id", pat.client_user_id).maybeSingle();
      displayName = (prof as { display_name?: string | null } | null)?.display_name || null;
    }
    const therapyGoals = Array.isArray(pat.long_term_goals) ? (pat.long_term_goals as string[]).join("; ") : "";
    return {
      id: canonicalId,
      ageBand,
      clientCategory: pat.client_category,
      age: pat.age,
      condition: (pat.condition as string) || "",
      therapyGoals,
      caregiverName: pat.caregiver_name as string | null,
      displayName,
      priorThemes,
      priorActivities: priorActivities || [],
    };
  }
  // No mock fallback — if DB has no patient record, return null so the caller
  // can throw a proper "Patient not found" error instead of synthesizing mock data.
  return null;
}

async function listTemplates(admin: NonNullable<ReturnType<typeof createAdminClient>>, ageBand: string, scope: "system" | "all" = "system") {
  const q = admin.from("activity_templates").select("id, title, category, age_band, spark_prompt, image_prompt, default_params").eq("age_band", ageBand).limit(12);
  const { data } = await q;
  return data || [];
}

export async function runActivityAgent(input: AgentRunInput): Promise<AgentDraft> {
  const admin = createAdminClient();
  if (!admin) throw new Error("Supabase not configured");

  const patient = await fetchPatient(admin, input.patientId);
  if (!patient) throw new Error("Patient not found");
  const ageBand = patient.ageBand;
  const themeHint = deriveTheme(input.step.title, input.step.instructions);
  const feedbackSuffix = input.feedback ? ` Feedback: ${input.feedback.slice(0, 120)}.` : "";
  const targetGoalKind = input.targetGoalKind || null;
  const targetGoalText = input.targetGoalText?.trim().slice(0, 500) || null;
  const goalSuffix = targetGoalText ? ` Target ${targetGoalKind === "ltg" ? "LTG" : "STG"}: ${targetGoalText.slice(0, 200)}.` : "";

  // Tool 2: list templates (inform planner, not yet used to filter — future: avoid repetition)
  const templates = await listTemplates(admin, ageBand, "system");
  const pick = templates[0] || null;

  // Planner: choose path (a) template+theme override OR (b) custom synthesized from patient+step
  // For Phase 0, heuristic: if step title/instructions contain strong keywords matching a template title, use template; else custom
  let targetTemplateId: string | undefined;
  let customSparkPrompt: string | undefined;
  let targetCategory = pick?.category || "visual_motor";
  let reasoning = "";
  const sources: string[] = [];

  if (pick) {
    // naive match: if any template title word appears in step
    const stepWords = `${input.step.title} ${input.step.instructions}`.toLowerCase();
    const matched = templates.find((t) => t.title.toLowerCase().split(/\s+/).some((w: string) => w.length > 4 && stepWords.includes(w)));
    const chosen = matched || pick;
    targetTemplateId = chosen.id;
    targetCategory = chosen.category;
    reasoning = `Picked ${chosen.title} — tailored for ${patient.ageBand} ${patient.condition ? `(${String(patient.condition).slice(0, 48)})` : ""} step "${input.step.title.slice(0, 32)}"${goalSuffix ? ` • ${goalSuffix.slice(0, 80)}` : ""}${feedbackSuffix ? " with feedback" : ""}`;
    sources.push(`system:${chosen.title}`);
    if (targetGoalText) sources.push(`${targetGoalKind}:${targetGoalText.slice(0, 32)}`);
  } else {
    customSparkPrompt = `Create a ${ageBand} ${targetCategory} worksheet for ${input.step.title || "therapy step"}: ${input.step.instructions.slice(0, 220)}${goalSuffix}${feedbackSuffix} Theme: ${themeHint}. Keep tokens efficient.`;
    reasoning = `Custom prompt for ${patient.ageBand} ${patient.condition ? String(patient.condition).slice(0, 32) : ""} — ${themeHint.slice(0, 40)}${goalSuffix ? ` • ${targetGoalText!.slice(0, 40)}` : ""}`;
    sources.push(`patient:${patient.displayName || patient.id.slice(0, 8)} ${patient.ageBand}`);
    if (targetGoalText) sources.push(`${targetGoalKind}:${targetGoalText.slice(0, 32)}`);
  }
  sources.push(`patient:${patient.id.slice(0, 8)} ${ageBand}`);

  // Tool 3: generate via existing Spark+Image
  const start = Date.now();
  // If template path, pass templateId-equivalent via templatePrompt/imagePrompt hydration will happen in /api/activities/generate,
  // but here we call generator directly: supply template's spark/image as base
  const templateRow = pick && targetTemplateId ? templates.find((t) => t.id === targetTemplateId) : null;
  const gen = await (async () => {
    if (templateRow) {
      // hydrate from DB row + theme override
      const sparkPrompt = templateRow.spark_prompt || undefined;
      const imagePrompt = templateRow.image_prompt || undefined;
      const themeOverride = themeHint || input.step.title;
      // Append feedback into theme/craft
      const finalTheme = `${themeOverride}${goalSuffix}${feedbackSuffix}`;
      const { result, latencyMs } = await runSparkActivitySpec({
        ageBand,
        category: targetCategory,
        templatePrompt: sparkPrompt,
        imagePrompt,
        titleOverride: input.step.title || templateRow.title,
        theme: finalTheme,
        difficulty: "guided",
      });
      let baseImageUrl: string | null = null;
      let imageModelId: string | null = null;
      if (input.generateImage !== false) {
        try {
          const img = await runMuseImage(result.refinedImagePrompt);
          baseImageUrl = img.imageUrl;
          imageModelId = img.modelId;
        } catch {
          // image optional
        }
      }
      return { result, baseImageUrl, imageModelId, latencyMs };
    }
    // custom path — map customSparkPrompt to templatePrompt (activity-generator has no customSparkPrompt field)
    const { result, latencyMs } = await runSparkActivitySpec({
      ageBand,
      category: targetCategory,
      templatePrompt: customSparkPrompt!,
      titleOverride: input.step.title || `Step ${input.step.position} Activity`,
      theme: `${themeHint}${goalSuffix}${feedbackSuffix}`,
    });
    let baseImageUrl: string | null = null;
    let imageModelId: string | null = null;
    if (input.generateImage !== false) {
      try {
        const img = await runMuseImage(result.refinedImagePrompt);
        baseImageUrl = img.imageUrl;
        imageModelId = img.modelId;
      } catch {}
    }
    return { result, baseImageUrl, imageModelId, latencyMs };
  })();

  // Persist draft to generated_activities (status=ready, pending_approval handled client-side via not-yet-linked)
  const sparkSpec = gen.result as unknown as Record<string, unknown>;
  const title = String((sparkSpec.title as string) || gen.result.title || input.step.title || "Activity");
  const instructions = String((sparkSpec.instructions as string) || gen.result.instructions || input.step.instructions || "");

  const insertRow = {
    creator_id: input.creatorId || null,
    patient_id: input.patientId,
    template_id: targetTemplateId || null,
    age_band: ageBand,
    title,
    instructions,
    spark_prompt_used: (templateRow?.spark_prompt || customSparkPrompt || input.step.instructions || "").slice(0, 8000),
    image_prompt_used: (templateRow?.image_prompt || String((sparkSpec.refinedImagePrompt as string) || "")).slice(0, 8000),
    reference_links: [],
    reference_image_paths: [],
    spark_spec: sparkSpec,
    base_image_path: null,
    base_image_url: gen.baseImageUrl,
    model_ids: { spark: process.env.META_SPARK_MODEL || process.env.SPARK_MODEL_ID || "muse-spark-1.3-contributor", image: gen.imageModelId },
    status: "ready",
  };
  const { data: inserted, error: insErr } = await admin.from("generated_activities").insert(insertRow).select("id").single();
  if (insErr || !inserted) throw new Error(insErr?.message || "Failed to persist draft");

  // Optional trace
  try {
    await admin.from("agent_runs").insert({
      patient_id: input.patientId,
      step_position: input.step.position,
      draft_id: (inserted as { id: string }).id,
      reasoning,
      trace: [{ thought: `Patient ${patient.ageBand} ${patient.condition?.slice(0, 40) || ""}`, tool: "fetch_patient+list_templates", observation: pick ? `pick ${pick.title}` : "custom" }, { thought: reasoning, tool: "generate_activity", observation: title }],
      status: "pending",
    });
  } catch {
    // table may not exist — ignore
  }

  return {
    draftId: (inserted as { id: string }).id,
    status: "pending_approval",
    title,
    instructions,
    ageBand,
    category: targetCategory,
    sparkSpec,
    base_image_url: gen.baseImageUrl,
    reasoning,
    sources,
    modelIds: { spark: (insertRow.model_ids as { spark: string }).spark, image: gen.imageModelId },
    latencyMs: Date.now() - start,
  };
}
