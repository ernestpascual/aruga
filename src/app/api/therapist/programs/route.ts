import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { HomeProgram, ProgramStep } from "@/types/database";
import { ownsPatient } from "@/lib/supabase/owner";

async function ownsPatientCheck(admin: NonNullable<ReturnType<typeof createAdminClient>>, patientId: string, requesterId: string) {
  return ownsPatient(admin, patientId, requesterId);
}
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const programId = searchParams.get("programId") || searchParams.get("id");
    const patientId = searchParams.get("patientId");
    const clientUserId = searchParams.get("clientUserId");
    const therapistId = searchParams.get("therapistId");
    const requesterId = searchParams.get("requesterId") || clientUserId || therapistId;

    const admin = createAdminClient();
    if (!admin) {
      return NextResponse.json({ error: "Database not configured. Run migrations." }, { status: 503 });
    }

    if (programId) {
      if (requesterId) {
        const { data: progRow } = await admin.from("home_programs").select("patient_id").eq("id", programId).maybeSingle();
        if (progRow?.patient_id) {
          const ok = await ownsPatientCheck(admin, progRow.patient_id, requesterId);
          if (!ok) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }
      }
      const { data: dbProg, error } = await admin
        .from("home_programs")
        .select("*, steps:program_steps(*, generated_activity:generated_activities(*)), patient:patients(*)")
        .eq("id", programId)
        .maybeSingle();

      if (!error && dbProg) {
        // Sort steps by position
        if (Array.isArray(dbProg.steps)) {
          dbProg.steps.sort((a: ProgramStep, b: ProgramStep) => a.position - b.position);
        }
        return NextResponse.json({ program: dbProg, programs: [dbProg] });
      }
    }

    let resolvedPatientId = patientId;

    // If clientUserId is provided, find this specific client's linked patient record
    if (clientUserId && !resolvedPatientId) {
      const { data: patientRecord } = await admin
        .from("patients")
        .select("id")
        .eq("client_user_id", clientUserId)
        .maybeSingle();

      if (patientRecord) {
        resolvedPatientId = patientRecord.id;
      } else {
        // Newly registered client without an assigned patient record has 0 programs
        return NextResponse.json({ programs: [] });
      }
    }

    if (resolvedPatientId && requesterId) {
      const ok = await ownsPatientCheck(admin, resolvedPatientId, requesterId);
      if (!ok) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    let query = admin.from("home_programs").select("*, steps:program_steps(*, generated_activity:generated_activities(*))");
    if (resolvedPatientId) {
      query = query.eq("patient_id", resolvedPatientId);
    } else if (therapistId) {
      query = query.eq("creator_id", therapistId);
    }

    const { data: dbPrograms, error } = await query.order("created_at", { ascending: false });

    if (!error && dbPrograms) {
      if (dbPrograms.length === 0) {
        return NextResponse.json({ programs: [] });
      }

      const progIds = dbPrograms.map((p) => p.id);
      const { data: dbSubmissions } = await admin
        .from("submissions")
        .select("*, step_submissions(*), review:submission_reviews(*)")
        .in("program_id", progIds)
        .order("created_at", { ascending: false });

      // Sort steps per program and attach submissions
      dbPrograms.forEach((p) => {
        if (Array.isArray(p.steps)) {
          p.steps.sort((a: ProgramStep, b: ProgramStep) => a.position - b.position);
        }
        const matchingSubs = dbSubmissions ? dbSubmissions.filter((s: { program_id: string }) => s.program_id === p.id) : [];
        p.submissions = matchingSubs;
        p.latest_submission = matchingSubs[0] || null;
      });
      return NextResponse.json({ programs: dbPrograms, program: dbPrograms[0] });
    }

    return NextResponse.json({ programs: [] });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action, patientId, programId, title, mainInstructions, steps, scheduledDates, scheduled_dates } = body;
    const admin = createAdminClient();
    if (!admin) {
      return NextResponse.json({ error: "Database not configured. Run migrations." }, { status: 503 });
    }
    const headerRequester = req.headers.get("x-requester-id") || req.headers.get("x-user-id");
    let resolvedTherapistId: string | null = (body.therapistId || body.requesterId || body.creatorId || headerRequester || null) as string | null;
    if (!resolvedTherapistId) {
      try {
        const serverClient = await createServerClient();
        if (serverClient) {
          const { data: { user } } = await serverClient.auth.getUser();
          if (user?.id) resolvedTherapistId = user.id;
        }
      } catch {}
    }
    if (!resolvedTherapistId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const therapistId = resolvedTherapistId;

    const rawDates = scheduledDates || scheduled_dates || [];
    const cleanedDates: string[] = Array.isArray(rawDates)
      ? Array.from(
          new Set(
            rawDates
              .map((d: unknown) => (typeof d === "string" ? d.trim() : ""))
              .filter((d: string) => Boolean(d))
          )
        ).slice(0, 10)
      : [];

    // 1. DUPLICATE PROGRAM
    if (action === "duplicate" && programId) {
      const { data: srcProg } = await admin.from("home_programs").select("*").eq("id", programId).single();
      if (srcProg) {
        const okDup = await ownsPatientCheck(admin, srcProg.patient_id, therapistId);
        if (!okDup) return NextResponse.json({ error: "Not found" }, { status: 404 });
        const targetTitle = `${srcProg.title} (Copy)`;
        // Deduplicate: check if a copy was created within the last 4 seconds
        const recentWindow = new Date(Date.now() - 4000).toISOString();
        const { data: existingCopy } = await admin
          .from("home_programs")
          .select("*, steps:program_steps(*, generated_activity:generated_activities(*))")
          .eq("patient_id", srcProg.patient_id)
          .eq("title", targetTitle)
          .gte("created_at", recentWindow)
          .maybeSingle();

        if (existingCopy) {
          return NextResponse.json({ program: existingCopy, deduplicated: true });
        }

        const { data: srcSteps } = await admin.from("program_steps").select("*").eq("program_id", programId);
        const { data: dupProg } = await admin
          .from("home_programs")
          .insert({
            patient_id: srcProg.patient_id,
            creator_id: srcProg.creator_id,
            title: targetTitle,
            main_instructions: srcProg.main_instructions,
            status: "draft",
          })
          .select()
          .single();

        if (dupProg && srcSteps) {
          const newSteps = srcSteps.map((s: ProgramStep) => ({
            program_id: dupProg.id,
            position: s.position,
            title: s.title,
            instructions: s.instructions,
          }));
          await admin.from("program_steps").insert(newSteps);
          return NextResponse.json({ program: { ...dupProg, steps: newSteps } });
        }
      }
      return NextResponse.json({ error: "Source program not found" }, { status: 404 });
    }

    // 2. ASSIGN PROGRAM
    if (action === "assign" && programId) {
      const { data: progRowAssign } = await admin.from("home_programs").select("patient_id").eq("id", programId).maybeSingle();
      if (progRowAssign?.patient_id) {
        const okAssign = await ownsPatientCheck(admin, progRowAssign.patient_id, therapistId);
        if (!okAssign) return NextResponse.json({ error: "Not found" }, { status: 404 });
      }
      await admin
        .from("home_programs")
        .update({ status: "assigned", assigned_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq("id", programId);

      return NextResponse.json({ success: true });
    }

    // 3. ARCHIVE PROGRAM
    if (action === "archive" && programId) {
      const { data: progRowArch } = await admin.from("home_programs").select("patient_id").eq("id", programId).maybeSingle();
      if (progRowArch?.patient_id) {
        const okArch = await ownsPatientCheck(admin, progRowArch.patient_id, therapistId);
        if (!okArch) return NextResponse.json({ error: "Not found" }, { status: 404 });
      }
      await admin
        .from("home_programs")
        .update({ status: "archived", updated_at: new Date().toISOString() })
        .eq("id", programId);

      return NextResponse.json({ success: true });
    }

    // 4. CREATE NEW PROGRAM
    if (!patientId || !title || !mainInstructions || !Array.isArray(steps) || steps.length === 0) {
      return NextResponse.json(
        { error: "Missing required fields: patientId, title, mainInstructions, and at least 1 step." },
        { status: 400 }
      );
    }

    const trimmedTitle = title.trim();

    const okCreate = await ownsPatientCheck(admin, patientId, therapistId);
    if (!okCreate) return NextResponse.json({ error: "Not found" }, { status: 404 });
    // Deduplicate: check if a program with the same title for this patient was created within 5 seconds
    const recentWindow = new Date(Date.now() - 5000).toISOString();
    const { data: existingProg } = await admin
      .from("home_programs")
      .select("*, steps:program_steps(*, generated_activity:generated_activities(*))")
      .eq("patient_id", patientId)
      .eq("title", trimmedTitle)
      .gte("created_at", recentWindow)
      .maybeSingle();

    if (existingProg) {
      return NextResponse.json({ program: existingProg, deduplicated: true }, { status: 200 });
    }

    const { data: newProg, error: pErr } = await admin
      .from("home_programs")
      .insert({
        patient_id: patientId,
        creator_id: therapistId,
        title: trimmedTitle,
        main_instructions: mainInstructions.trim(),
        scheduled_dates: cleanedDates,
        status: "draft",
      })
      .select()
      .single();

    if (pErr) {
      return NextResponse.json({ error: pErr.message }, { status: 500 });
    }

    if (newProg) {
      const stepRecords = steps.map((s: { title?: string; instructions: string; generated_activity_id?: string; generatedActivityId?: string }, idx: number) => ({
        program_id: newProg.id,
        position: idx + 1,
        title: s.title || `Step ${idx + 1}`,
        instructions: s.instructions,
        generated_activity_id: s.generated_activity_id || s.generatedActivityId || null,
      }));
      const { data: createdSteps } = await admin.from("program_steps").insert(stepRecords).select();
      return NextResponse.json(
        { program: { ...newProg, steps: createdSteps || stepRecords } },
        { status: 201 }
      );
    }

    return NextResponse.json({ error: "Failed to create program" }, { status: 500 });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { searchParams } = new URL(req.url);
    const targetId = body.programId || body.id || searchParams.get("id") || searchParams.get("programId");

    if (!targetId) {
      return NextResponse.json({ error: "programId or id is required for update" }, { status: 400 });
    }

    const { title, mainInstructions, status, steps, scheduledDates, scheduled_dates } = body;
    const admin = createAdminClient();
    if (!admin) {
      return NextResponse.json({ error: "Database not configured. Run migrations." }, { status: 503 });
    }
    let patchRequester: string | null = (body.requesterId || body.therapistId || searchParams.get("requesterId") || req.headers.get("x-requester-id")) as string | null;
    if (!patchRequester) {
      try {
        const serverClient = await createServerClient();
        if (serverClient) {
          const { data: { user } } = await serverClient.auth.getUser();
          if (user?.id) patchRequester = user.id;
        }
      } catch {}
    }

    const updates: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };
    if (title !== undefined) updates.title = title.trim();
    if (mainInstructions !== undefined) updates.main_instructions = mainInstructions.trim();
    if (status) {
      updates.status = status;
      if (status === "assigned") {
        updates.assigned_at = new Date().toISOString();
      }
    }
    if (scheduledDates !== undefined || scheduled_dates !== undefined) {
      const rawDates = scheduledDates ?? scheduled_dates ?? [];
      const cleanedDates: string[] = Array.isArray(rawDates)
        ? Array.from(
            new Set(
              rawDates
                .map((d: unknown) => (typeof d === "string" ? d.trim() : ""))
                .filter((d: string) => Boolean(d))
            )
          ).slice(0, 10)
        : [];
      updates.scheduled_dates = cleanedDates;
    }

    if (patchRequester) {
      const { data: progRowPatch } = await admin.from("home_programs").select("patient_id").eq("id", targetId).maybeSingle();
      if (progRowPatch?.patient_id) {
        const okPatch = await ownsPatientCheck(admin, progRowPatch.patient_id, patchRequester);
        if (!okPatch) return NextResponse.json({ error: "Not found" }, { status: 404 });
      }
    } else {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { data: updatedProg, error: pErr } = await admin
      .from("home_programs")
      .update(updates)
      .eq("id", targetId)
      .select()
      .single();

    if (pErr) {
      return NextResponse.json({ error: pErr.message }, { status: 500 });
    }

    let savedSteps: ProgramStep[] = [];
    if (Array.isArray(steps) && steps.length > 0) {
      await admin.from("program_steps").delete().eq("program_id", targetId);
      const stepRecords = steps.map((s: { title?: string; instructions: string; generated_activity_id?: string; generatedActivityId?: string }, idx: number) => ({
        program_id: targetId,
        position: idx + 1,
        title: s.title || `Step ${idx + 1}`,
        instructions: s.instructions,
        generated_activity_id: s.generated_activity_id || s.generatedActivityId || null,
      }));
      const { data: createdSteps } = await admin.from("program_steps").insert(stepRecords).select();
      savedSteps = createdSteps || (stepRecords as ProgramStep[]);
    } else {
      const { data: existingSteps } = await admin
        .from("program_steps")
        .select("*")
        .eq("program_id", targetId)
        .order("position", { ascending: true });
      savedSteps = existingSteps || [];
    }

    return NextResponse.json({
      success: true,
      program: { ...updatedProg, steps: savedSteps },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    let targetId = searchParams.get("id") || searchParams.get("programId");

    if (!targetId) {
      try {
        const body = await req.json();
        targetId = body.id || body.programId;
      } catch {
        // body might not be JSON
      }
    }

    if (!targetId) {
      return NextResponse.json({ error: "Program id is required for deletion" }, { status: 400 });
    }

    const admin = createAdminClient();
    if (!admin) {
      return NextResponse.json({ error: "Database not configured. Run migrations." }, { status: 503 });
    }

    let delRequesterProg: string | null = (searchParams.get("requesterId") || searchParams.get("therapistId") || req.headers.get("x-requester-id")) as string | null;
    if (!delRequesterProg) {
      try {
        const serverClient = await createServerClient();
        if (serverClient) {
          const { data: { user } } = await serverClient.auth.getUser();
          if (user?.id) delRequesterProg = user.id;
        }
      } catch {}
    }
    if (delRequesterProg) {
      const { data: progRowDel } = await admin.from("home_programs").select("patient_id").eq("id", targetId).maybeSingle();
      if (progRowDel?.patient_id) {
        const okDel = await ownsPatientCheck(admin, progRowDel.patient_id, delRequesterProg);
        if (!okDel) return NextResponse.json({ error: "Not found" }, { status: 404 });
      }
    } else {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    // 1. Delete associated submissions and their reviews/step submissions
    const { data: subs } = await admin.from("submissions").select("id").eq("program_id", targetId);
    const subIds = subs?.map((s) => s.id) || [];
    if (subIds.length > 0) {
      const { data: revs } = await admin.from("submission_reviews").select("id").in("submission_id", subIds);
      const revIds = revs?.map((r) => r.id) || [];
      if (revIds.length > 0) {
        await admin.from("step_reviews").delete().in("review_id", revIds);
      }
      await admin.from("submission_reviews").delete().in("submission_id", subIds);
      await admin.from("step_submissions").delete().in("submission_id", subIds);
      await admin.from("submissions").delete().eq("program_id", targetId);
    }

    // 2. Delete program steps
    await admin.from("program_steps").delete().eq("program_id", targetId);

    // 3. Delete home program
    const { error: delErr } = await admin.from("home_programs").delete().eq("id", targetId);
    if (delErr) {
      return NextResponse.json({ error: delErr.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: "Program deleted successfully from database." });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
