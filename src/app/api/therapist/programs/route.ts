import { NextRequest, NextResponse } from "next/server";
import { getMockStore, DEMO_THERAPIST_ID } from "@/lib/supabase/mock-store";
import { createAdminClient } from "@/lib/supabase/admin";
import { HomeProgram, ProgramStep } from "@/types/database";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const programId = searchParams.get("programId") || searchParams.get("id");
    const patientId = searchParams.get("patientId");
    const clientUserId = searchParams.get("clientUserId");
    const therapistId = searchParams.get("therapistId");
    const isDemo = searchParams.get("isDemo") === "true";

    const admin = createAdminClient();
    const isExplicitRealUser = (clientUserId || (therapistId && therapistId !== DEMO_THERAPIST_ID)) && !isDemo;

    if (admin) {
      if (programId) {
        const { data: dbProg, error } = await admin
          .from("home_programs")
          .select("*, steps:program_steps(*), patient:patients(*)")
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

      let query = admin.from("home_programs").select("*, steps:program_steps(*)");
      if (resolvedPatientId) {
        query = query.eq("patient_id", resolvedPatientId);
      } else if (therapistId && therapistId !== DEMO_THERAPIST_ID && !isDemo) {
        query = query.eq("creator_id", therapistId);
      }

      const { data: dbPrograms, error } = await query.order("created_at", { ascending: false });

      if (!error && dbPrograms) {
        if (dbPrograms.length === 0) {
          return NextResponse.json({ programs: [] });
        }

        // Sort steps per program
        dbPrograms.forEach((p) => {
          if (Array.isArray(p.steps)) {
            p.steps.sort((a: ProgramStep, b: ProgramStep) => a.position - b.position);
          }
        });
        return NextResponse.json({ programs: dbPrograms });
      }
    }

    // If explicit real user, return empty list (no dummy data)
    if (isExplicitRealUser) {
      return NextResponse.json({ programs: [] });
    }

    // Fallback store (only for demo bypass mode)
    const store = getMockStore();
    if (programId) {
      const prog = store.programs.find((p) => p.id === programId);
      if (prog) {
        const enriched = {
          ...prog,
          steps: store.steps.filter((s) => s.program_id === prog.id).sort((a, b) => a.position - b.position),
          patient: store.patients.find((pt) => pt.id === prog.patient_id),
        };
        return NextResponse.json({ program: enriched, programs: [enriched] });
      }
    }

    let programs = store.programs;
    if (patientId) {
      programs = programs.filter((p) => p.patient_id === patientId);
    }

    const enriched = programs.map((p) => ({
      ...p,
      steps: store.steps.filter((s) => s.program_id === p.id).sort((a, b) => a.position - b.position),
    }));

    return NextResponse.json({ programs: enriched });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action, patientId, programId, title, mainInstructions, steps } = body;
    const store = getMockStore();
    const therapistId = DEMO_THERAPIST_ID;
    const admin = createAdminClient();

    // 1. DUPLICATE PROGRAM
    if (action === "duplicate" && programId) {
      if (admin) {
        const { data: srcProg } = await admin.from("home_programs").select("*").eq("id", programId).single();
        if (srcProg) {
          const targetTitle = `${srcProg.title} (Copy)`;
          // Deduplicate: check if a copy was created within the last 4 seconds
          const recentWindow = new Date(Date.now() - 4000).toISOString();
          const { data: existingCopy } = await admin
            .from("home_programs")
            .select("*, steps:program_steps(*)")
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
      }

      const sourceProg = store.programs.find((p) => p.id === programId);
      if (!sourceProg) {
        return NextResponse.json({ error: "Source program not found" }, { status: 404 });
      }

      // Check fallback store for recent duplicate
      const recentDup = store.programs.find(
        (p) =>
          p.patient_id === sourceProg.patient_id &&
          p.title === `${sourceProg.title} (Copy)` &&
          Date.now() - new Date(p.created_at).getTime() < 4000
      );
      if (recentDup) {
        return NextResponse.json({
          program: {
            ...recentDup,
            steps: store.steps.filter((s) => s.program_id === recentDup.id),
          },
          deduplicated: true,
        });
      }

      const sourceSteps = store.steps.filter((s) => s.program_id === programId);
      const newProgId = `prog-${Date.now()}`;

      const duplicatedProgram: HomeProgram = {
        id: newProgId,
        patient_id: sourceProg.patient_id,
        creator_id: therapistId,
        title: `${sourceProg.title} (Copy)`,
        main_instructions: sourceProg.main_instructions,
        status: "draft",
        assigned_at: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const duplicatedSteps: ProgramStep[] = sourceSteps.map((s, idx) => ({
        id: `step-${Date.now()}-${idx}`,
        program_id: newProgId,
        position: s.position,
        title: s.title,
        instructions: s.instructions,
        created_at: new Date().toISOString(),
      }));

      store.programs.unshift(duplicatedProgram);
      store.steps.push(...duplicatedSteps);

      return NextResponse.json({
        program: { ...duplicatedProgram, steps: duplicatedSteps },
      });
    }

    // 2. ASSIGN PROGRAM
    if (action === "assign" && programId) {
      if (admin) {
        await admin
          .from("home_programs")
          .update({ status: "assigned", assigned_at: new Date().toISOString(), updated_at: new Date().toISOString() })
          .eq("id", programId);
      }

      const prog = store.programs.find((p) => p.id === programId);
      if (prog) {
        prog.status = "assigned";
        prog.assigned_at = new Date().toISOString();
        prog.updated_at = new Date().toISOString();
      }

      return NextResponse.json({ success: true });
    }

    // 3. ARCHIVE PROGRAM
    if (action === "archive" && programId) {
      if (admin) {
        await admin
          .from("home_programs")
          .update({ status: "archived", updated_at: new Date().toISOString() })
          .eq("id", programId);
      }

      const prog = store.programs.find((p) => p.id === programId);
      if (prog) {
        prog.status = "archived";
        prog.updated_at = new Date().toISOString();
      }

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

    if (admin) {
      // Deduplicate: check if a program with the same title for this patient was created within 5 seconds
      const recentWindow = new Date(Date.now() - 5000).toISOString();
      const { data: existingProg } = await admin
        .from("home_programs")
        .select("*, steps:program_steps(*)")
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
          status: "draft",
        })
        .select()
        .single();

      if (!pErr && newProg) {
        const stepRecords = steps.map((s: { title?: string; instructions: string }, idx: number) => ({
          program_id: newProg.id,
          position: idx + 1,
          title: s.title || `Step ${idx + 1}`,
          instructions: s.instructions,
        }));
        const { data: createdSteps } = await admin.from("program_steps").insert(stepRecords).select();
        return NextResponse.json(
          { program: { ...newProg, steps: createdSteps || stepRecords } },
          { status: 201 }
        );
      }
    }

    // Fallback store duplicate check
    const recentFallbackDup = store.programs.find(
      (p) =>
        p.patient_id === patientId &&
        p.title === trimmedTitle &&
        Date.now() - new Date(p.created_at).getTime() < 5000
    );
    if (recentFallbackDup) {
      return NextResponse.json({
        program: {
          ...recentFallbackDup,
          steps: store.steps.filter((s) => s.program_id === recentFallbackDup.id),
        },
        deduplicated: true,
      });
    }

    const newProgramId = `prog-${Date.now()}`;
    const newProgram: HomeProgram = {
      id: newProgramId,
      patient_id: patientId,
      creator_id: therapistId,
      title: trimmedTitle,
      main_instructions: mainInstructions,
      status: "draft",
      assigned_at: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const newSteps: ProgramStep[] = steps.map((s: { title?: string; instructions: string }, idx: number) => ({
      id: `step-${Date.now()}-${idx + 1}`,
      program_id: newProgramId,
      position: idx + 1,
      title: s.title || `Step ${idx + 1}`,
      instructions: s.instructions,
      created_at: new Date().toISOString(),
    }));

    store.programs.unshift(newProgram);
    store.steps.push(...newSteps);

    return NextResponse.json(
      { program: { ...newProgram, steps: newSteps } },
      { status: 201 }
    );
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

    const { title, mainInstructions, status, steps } = body;
    const admin = createAdminClient();

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

    if (admin) {
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
        const stepRecords = steps.map((s: { title?: string; instructions: string }, idx: number) => ({
          program_id: targetId,
          position: idx + 1,
          title: s.title || `Step ${idx + 1}`,
          instructions: s.instructions,
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
    }

    // Fallback in-memory
    const store = getMockStore();
    const existing = store.programs.find((p) => p.id === targetId);
    if (!existing) {
      return NextResponse.json({ error: "Program not found" }, { status: 404 });
    }

    if (title !== undefined) existing.title = title.trim();
    if (mainInstructions !== undefined) existing.main_instructions = mainInstructions.trim();
    if (status) {
      existing.status = status;
      if (status === "assigned") existing.assigned_at = new Date().toISOString();
    }
    existing.updated_at = new Date().toISOString();

    if (Array.isArray(steps) && steps.length > 0) {
      store.steps = store.steps.filter((s) => s.program_id !== targetId);
      const newSteps: ProgramStep[] = steps.map((s: { title?: string; instructions: string }, idx: number) => ({
        id: `step-${Date.now()}-${idx + 1}`,
        program_id: targetId,
        position: idx + 1,
        title: s.title || `Step ${idx + 1}`,
        instructions: s.instructions,
        created_at: new Date().toISOString(),
      }));
      store.steps.push(...newSteps);
    }

    return NextResponse.json({
      success: true,
      program: {
        ...existing,
        steps: store.steps.filter((s) => s.program_id === targetId).sort((a, b) => a.position - b.position),
      },
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

    if (admin) {
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
    }

    // Fallback in-memory
    const store = getMockStore();
    store.programs = store.programs.filter((p) => p.id !== targetId);
    store.steps = store.steps.filter((s) => s.program_id !== targetId);
    store.submissions = store.submissions.filter((s) => s.program_id !== targetId);

    return NextResponse.json({ success: true, message: "Program deleted successfully." });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

