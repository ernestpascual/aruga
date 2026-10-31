import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const ageBand = searchParams.get("ageBand");
    const category = searchParams.get("category");
    const scope = searchParams.get("scope"); // system | therapist | all
    const therapistId = searchParams.get("therapistId");
    const featured = searchParams.get("featured");

    const admin = createAdminClient();
    if (!admin) {
      return NextResponse.json({ templates: [], note: "no db connection — mock mode" });
    }

    let query = admin.from("activity_templates").select("*").order("created_at", { ascending: true });

    if (ageBand) query = query.eq("age_band", ageBand);
    if (category) query = query.eq("category", category);
    if (featured === "true") query = query.eq("is_featured", true);
    if (scope === "system") query = query.eq("owner_scope", "system");
    if (scope === "therapist" && therapistId) query = query.eq("therapist_id", therapistId).eq("owner_scope", "therapist");
    // default: system + therapist mix is handled client side; but raw fetch gets all

    const { data, error } = await query;
    if (error) throw new Error(error.message);
    return NextResponse.json({ templates: data || [] });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { therapistId, title, description, ageBand, category, sparkPrompt, imagePrompt, defaultParams } = body;

    if (!title || !ageBand || !category || !sparkPrompt || !imagePrompt) {
      return NextResponse.json({ error: "title, ageBand, category, sparkPrompt, imagePrompt required" }, { status: 400 });
    }

    const admin = createAdminClient();
    if (!admin) {
      return NextResponse.json({ error: "Database not configured — cannot save template. Run migrations and set SUPABASE keys." }, { status: 503 });
    }

    const { data, error } = await admin
      .from("activity_templates")
      .insert({
        therapist_id: therapistId || null,
        owner_scope: therapistId ? "therapist" : "system",
        title: title.trim(),
        description: description?.trim() || null,
        age_band: ageBand,
        category,
        spark_prompt: sparkPrompt,
        image_prompt: imagePrompt,
        default_params: defaultParams || {},
      })
      .select()
      .single();

    if (error) throw new Error(error.message);
    return NextResponse.json({ template: data }, { status: 201 });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
