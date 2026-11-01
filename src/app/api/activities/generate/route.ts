import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { generateActivity } from "@/lib/meta-ai";
import { MetaApiError } from "@/lib/meta/errors";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      titleOverride,
      ageBand,
      category,
      theme,
      difficulty,
      lineStyle,
      templateId,
      customSparkPrompt,
      customImagePrompt,
      referenceLinks,
      referenceImages,
      patientId,
      creatorId,
      generateImage,
      // legacy aliases from UI
      customSpark,
      customImage,
    } = body;

    if (!ageBand || !["pedia", "adolescent", "adult", "geriatric"].includes(ageBand)) {
      return NextResponse.json({ error: "ageBand must be one of pedia, adolescent, adult, geriatric" }, { status: 400 });
    }

    // Efficient: cap custom prompts at source to avoid finish_reason=length
    const effectiveSparkPrompt = (customSparkPrompt || customSpark || undefined)?.toString().slice(0, 800) || undefined;
    const effectiveImagePrompt = (customImagePrompt || customImage || undefined)?.toString().slice(0, 600) || undefined;

    // If templateId provided, hydrate template prompts as base
    let templateSpark: string | undefined = effectiveSparkPrompt;
    let templateImage: string | undefined = effectiveImagePrompt;
    let templateCategory = category;
    let dbTemplateTitle: string | undefined;

    const admin = createAdminClient();
    // C1 write-guard: verify requester owns patientId and derive creatorId from auth
    let authenticatedCreatorId: string | null = null;
    try {
      const serverClient = await createServerClient();
      if (serverClient) {
        const { data: { user } } = await serverClient.auth.getUser();
        if (user?.id) authenticatedCreatorId = user.id;
      }
    } catch {}
    const headerRequester = req.headers.get("x-requester-id") || req.headers.get("x-user-id");
    const effectiveRequesterId = authenticatedCreatorId || headerRequester || (creatorId as string | null) || null;
    if (admin && patientId) {
      if (!effectiveRequesterId) {
        return NextResponse.json({ error: "requesterId required" }, { status: 403 });
      }
      const { data: pat } = await admin.from("patients").select("client_user_id, therapist_id").eq("id", patientId).maybeSingle();
      if (!pat) return NextResponse.json({ error: "Not found" }, { status: 404 });
      const owns = pat.client_user_id === effectiveRequesterId || pat.therapist_id === effectiveRequesterId;
      if (!owns) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const verifiedCreatorId = authenticatedCreatorId || effectiveRequesterId || (creatorId as string | null) || null;
    if (templateId && admin) {
      const { data: tmpl } = await admin.from("activity_templates").select("*").eq("id", templateId).maybeSingle();
      if (tmpl) {
        dbTemplateTitle = tmpl.title;
        templateCategory = templateCategory || tmpl.category;
        if (!templateSpark) templateSpark = tmpl.spark_prompt;
        if (!templateImage) templateImage = tmpl.image_prompt;
      }
    }

    const result = await generateActivity({
      templateId,
      ageBand,
      category: (templateCategory as never) || "other",
      titleOverride: titleOverride || dbTemplateTitle,
      theme,
      difficulty,
      lineStyle,
      customSparkPrompt: templateSpark,
      customImagePrompt: templateImage,
      referenceLinks: Array.isArray(referenceLinks) ? referenceLinks.filter(Boolean).slice(0, 6) : undefined,
      referenceImages: Array.isArray(referenceImages) ? referenceImages.filter(Boolean).slice(0, 4) : undefined,
      patientId,
      generateImage: generateImage === false || generateImage === "false" ? false : true,
    });

    // Persist to generated_activities if we have DB
    let persisted: Record<string, unknown> | null = null;
    if (admin) {
      const isMockImage = result.baseImageUrl?.startsWith("data:image/svg+xml");
      const baseImageUrlForStorage = isMockImage ? null : result.baseImageUrl;

      // If we have a remote URL image, try to store it (or just keep URL)
      let baseImagePath: string | null = null;
      let finalBaseImageUrl: string | null = result.baseImageUrl;

      // For data URLs (mock), store as-is in base_image_url; for http URLs keep as URL
      // For generation, we want to persist spark_spec and prompts
      const insertRow = {
        creator_id: verifiedCreatorId || null,
        patient_id: patientId || null,
        template_id: templateId || null,
        age_band: ageBand,
        title: result.title,
        instructions: result.instructions,
        spark_prompt_used: (templateSpark || titleOverride || result.sparkSpec.visualBrief || "").slice(0, 8000),
        image_prompt_used: (templateImage || result.sparkSpec.refinedImagePrompt || "").slice(0, 8000),
        reference_links: Array.isArray(referenceLinks) ? referenceLinks.slice(0, 6) : [],
        reference_image_paths: [], // handled via storage separately if needed
        spark_spec: result.sparkSpec as unknown as Record<string, unknown>,
        base_image_path: baseImagePath,
        base_image_url: finalBaseImageUrl,
        model_ids: result.modelIds as unknown as Record<string, unknown>,
        status: "ready",
      };

      const { data: inserted, error: insErr } = await admin.from("generated_activities").insert(insertRow).select().single();
      if (!insErr && inserted) {
        persisted = inserted as Record<string, unknown>;
      } else if (insErr) {
        // still return generated result even if persist fails (e.g. missing migration)
        console.warn("[activities/generate] persist warning:", insErr.message);
      }
    }

    return NextResponse.json({
      activity: persisted || {
        id: result.activityId,
        title: result.title,
        instructions: result.instructions,
        age_band: ageBand,
        spark_spec: result.sparkSpec,
        base_image_url: result.baseImageUrl,
        base_image_path: null,
        model_ids: result.modelIds,
        status: "ready",
      },
      modelIds: result.modelIds,
      latencyMs: result.latencyMs,
      persisted: Boolean(persisted),
    });
  } catch (err: unknown) {
    if (err instanceof MetaApiError) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: err.statusCode || 500 });
    }
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
