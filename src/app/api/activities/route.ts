import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

async function getAttachedActivityIds(admin: ReturnType<typeof createAdminClient>, patientId: string): Promise<string[]> {
  if (!admin || !patientId) return [];
  const { data: programs } = await admin.from("home_programs").select("id").eq("patient_id", patientId);
  if (!programs || programs.length === 0) return [];
  const progIds = programs.map(p => p.id);
  const { data: steps } = await admin.from("program_steps").select("generated_activity_id").in("program_id", progIds).not("generated_activity_id", "is", null);
  if (!steps) return [];
  return [...new Set(steps.map(s => s.generated_activity_id).filter(Boolean) as string[])];
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    const patientId = searchParams.get("patientId");
    const creatorId = searchParams.get("creatorId");
    const clientUserId = searchParams.get("clientUserId");
    const requesterId = searchParams.get("requesterId") || clientUserId || creatorId;

    const admin = createAdminClient();
    if (!admin) {
      // If a scoped filter was requested, surface the config error instead of silently returning empty
      if (id || patientId || creatorId || clientUserId) {
        return NextResponse.json({ error: "Database not configured — run Supabase migrations. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY." }, { status: 503 });
      }
      return NextResponse.json({ activities: [] });
    }

    // Single activity with privacy check
    if (id) {
      const { data, error } = await admin.from("generated_activities").select("*").eq("id", id).maybeSingle();
      if (error) throw new Error(error.message);
      if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 });

      // If patientId supplied, verify activity is attached to that patient's home program
      if (patientId) {
        // Resolve canonical id if caller passed client_user_id
        let canonicalPid = patientId;
        {
          const { data: byId } = await admin.from("patients").select("id").eq("id", patientId).maybeSingle();
          if (!byId?.id) {
            const { data: byClient } = await admin.from("patients").select("id").eq("client_user_id", patientId).maybeSingle();
            if (byClient?.id) canonicalPid = byClient.id;
          }
        }
        const attached = await getAttachedActivityIds(admin, canonicalPid);
        if (!attached.includes(id) && data.patient_id !== canonicalPid && data.patient_id !== patientId && data.creator_id !== requesterId) {
          return NextResponse.json({ error: "Forbidden: activity not assigned to this patient" }, { status: 403 });
        }
      } else if (clientUserId) {
        // Resolve patient(s) for this client and check attachment
        const { data: patients } = await admin.from("patients").select("id").eq("client_user_id", clientUserId);
        const pids = (patients || []).map(p => p.id);
        let allowed = data.creator_id === clientUserId;
        for (const pid of pids) {
          const attached = await getAttachedActivityIds(admin, pid);
          if (attached.includes(id) || data.patient_id === pid) { allowed = true; break; }
        }
        if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      } else if (requesterId && data.creator_id !== requesterId) {
        // Therapist view without patient check — ensure they own it or its assigned patient
        const { data: progSteps } = await admin.from("program_steps").select("program_id").eq("generated_activity_id", id).limit(1);
        if (progSteps && progSteps.length > 0) {
          const { data: prog } = await admin.from("home_programs").select("patient_id").eq("id", progSteps[0].program_id).maybeSingle();
          if (prog?.patient_id) {
            const { data: pat } = await admin.from("patients").select("therapist_id").eq("id", prog.patient_id).maybeSingle();
            if (pat?.therapist_id !== requesterId && data.creator_id !== requesterId) {
              return NextResponse.json({ error: "Forbidden" }, { status: 403 });
            }
          }
        } else if (data.creator_id !== requesterId) {
          // Not attached and not creator → therapist can still see if they created it (already checked) else block
          // Allow viewing templates? No, generated activities are private to creator
        }
      }
      return NextResponse.json({ activity: data });
    }

    // List mode — require scoped filter, never return all
    if (clientUserId) {
      const { data: patients } = await admin.from("patients").select("id").eq("client_user_id", clientUserId);
      if (!patients || patients.length === 0) return NextResponse.json({ activities: [] });
      const allIds = new Set<string>();
      for (const p of patients) {
        const ids = await getAttachedActivityIds(admin, p.id);
        ids.forEach(v => allIds.add(v));
      }
      if (allIds.size === 0) return NextResponse.json({ activities: [] });
      const { data, error } = await admin.from("generated_activities").select("*").in("id", [...allIds]).order("created_at", { ascending: false });
      if (error) throw new Error(error.message);
      return NextResponse.json({ activities: data || [] });
    }

    if (patientId) {
      // Resolve canonical patients.id if caller passed client_user_id / profiles.id
      let canonicalPatientId = patientId;
      {
        const { data: byId } = await admin.from("patients").select("id").eq("id", patientId).maybeSingle();
        if (!byId?.id) {
          const { data: byClient } = await admin.from("patients").select("id").eq("client_user_id", patientId).maybeSingle();
          if (byClient?.id) canonicalPatientId = byClient.id;
        }
      }
      const attachedIds = await getAttachedActivityIds(admin, canonicalPatientId);
      if (attachedIds.length === 0) return NextResponse.json({ activities: [] });
      const { data, error } = await admin.from("generated_activities").select("*").in("id", attachedIds).order("created_at", { ascending: false });
      if (error) throw new Error(error.message);
      return NextResponse.json({ activities: data || [] });
    }

    if (creatorId) {
      const { data, error } = await admin.from("generated_activities").select("*").eq("creator_id", creatorId).order("created_at", { ascending: false }).limit(100);
      if (error) throw new Error(error.message);
      return NextResponse.json({ activities: data || [] });
    }

    // No filter → deny broad listing (privacy)
    return NextResponse.json({ activities: [] });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, title, instructions } = body;
    if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
    const admin = createAdminClient();
    if (!admin) return NextResponse.json({ error: "DB not configured" }, { status: 503 });
    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (title !== undefined) updates.title = title.trim();
    if (instructions !== undefined) updates.instructions = instructions.trim();
    const { data, error } = await admin.from("generated_activities").update(updates).eq("id", id).select().single();
    if (error) throw new Error(error.message);
    return NextResponse.json({ activity: data });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
