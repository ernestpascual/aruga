import { NextRequest, NextResponse } from "next/server";
import { getMockStore, DEMO_THERAPIST_ID } from "@/lib/supabase/mock-store";
import { createAdminClient } from "@/lib/supabase/admin";
import { HomeProgram, ProgramStep } from "@/types/database";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const patientId = searchParams.get("patientId");
    const clientUserId = searchParams.get("clientUserId");
    const therapistId = searchParams.get("therapistId");
    const isDemo = searchParams.get("isDemo") === "true";

    const admin = createAdminClient();
    const isExplicitRealUser = (clientUserId || (therapistId && therapistId !== DEMO_THERAPIST_ID)) && !isDemo;

    if (admin) {
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
        if (isExplicitRealUser && dbPrograms.length === 0) {
          return NextResponse.json({ programs: [] });
        }
        if (dbPrograms.length > 0) {
          return NextResponse.json({ programs: dbPrograms });
        }
      }
    }

    // If explicit real user, return empty list (no dummy data)
    if (isExplicitRealUser) {
      return NextResponse.json({ programs: [] });
    }

    // Fallback store (only for demo bypass mode)
    const store = getMockStore();
    let programs = store.programs;
    if (patientId) {
      programs = programs.filter((p) => p.patient_id === patientId);
    }

    const enriched = programs.map((p) => ({
      ...p,
      steps: store.steps.filter((s) => s.program_id === p.id),
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
