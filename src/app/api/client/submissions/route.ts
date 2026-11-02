import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ownsPatient } from "@/lib/supabase/owner";
import { ProgramStep, Submission, StepSubmission } from "@/types/database";

async function ownsPatientCheck(admin: NonNullable<ReturnType<typeof createAdminClient>>, patientId: string, requesterId: string) {
  let pat: any = null;
  {
    const { data } = await admin.from("patients").select("client_user_id, therapist_id").eq("id", patientId).maybeSingle();
    if (data) pat = data;
    else {
      const { data: byClient } = await admin.from("patients").select("client_user_id, therapist_id").eq("client_user_id", patientId).maybeSingle();
      if (byClient) pat = byClient;
    }
  }
  if (!pat) return false;
  return pat.client_user_id === requesterId || pat.therapist_id === requesterId;
}
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const submissionId = searchParams.get("submissionId") || searchParams.get("id");
    const programId = searchParams.get("programId");
    let patientId = searchParams.get("patientId");
    const clientUserId = searchParams.get("clientUserId");
    const requesterId = searchParams.get("requesterId") || clientUserId;
    const scheduledDate = searchParams.get("scheduledDate") || searchParams.get("scheduled_date");

    const admin = createAdminClient();
    if (!admin) {
      return NextResponse.json({ error: "Database not configured" }, { status: 503 });
    }

    if (clientUserId && !patientId) {
      const { data: patientRecord } = await admin
        .from("patients")
        .select("id")
        .eq("client_user_id", clientUserId)
        .maybeSingle();

      if (patientRecord) {
        patientId = patientRecord.id;
      }
    }

    // Ownership check: if patientId filter supplied, verify requester owns it
    if (patientId && requesterId) {
      const ok = await ownsPatientCheck(admin, patientId, requesterId);
      if (!ok) return NextResponse.json({ error: "Not found" }, { status: 404 });
    } else if (patientId && !requesterId) {
      return NextResponse.json({ error: "requesterId required" }, { status: 403 });
    }

    let query = admin.from("submissions").select(`
        *,
        program:home_programs(*, steps:program_steps(*, generated_activity:generated_activities(*))),
        step_submissions(*),
        review:submission_reviews(*, step_reviews(*))
      `);

    if (submissionId) {
      query = query.eq("id", submissionId);
    } else if (programId) {
      query = query.eq("program_id", programId);
      if (patientId) query = query.eq("patient_id", patientId);
      if (scheduledDate) query = query.eq("scheduled_date", scheduledDate);
    } else if (patientId) {
      query = query.eq("patient_id", patientId);
      if (scheduledDate) query = query.eq("scheduled_date", scheduledDate);
    }

    const { data: dbSubs, error } = await query.order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!dbSubs || dbSubs.length === 0) {
      return NextResponse.json({ submissions: [], submission: null });
    }

    // Post-filter: verify each result's patient belongs to requester (prevents IDOR via submissionId)
    if (requesterId) {
      const filtered = [];
      for (const s of dbSubs) {
        const ok = await ownsPatientCheck(admin, s.patient_id, requesterId);
        if (ok) filtered.push(s);
      }
      if (filtered.length === 0) return NextResponse.json({ error: "Not found" }, { status: 404 });
      filtered.forEach((sub) => {
        if (sub.program && Array.isArray(sub.program.steps)) {
          sub.program.steps.sort((a: ProgramStep, b: ProgramStep) => a.position - b.position);
        }
      });
      for (const s of filtered) {
        if (Array.isArray((s as unknown as { step_submissions?: unknown[] }).step_submissions)) {
          for (const ss of (s as unknown as { step_submissions: Array<Record<string, unknown>> }).step_submissions) {
            const sp = (ss as Record<string, unknown>).media_meta && typeof (ss as Record<string, unknown>).media_meta === "object"
              ? ((ss as Record<string, unknown>).media_meta as Record<string, unknown>).storagePath as string || ((ss as Record<string, unknown>).media_meta as Record<string, unknown>).storage_path as string || ss.video_path as string
              : ss.video_path as string;
            if (sp && typeof sp === "string" && sp.startsWith("submissions/")) {
              try {
                const { data: signed } = await admin.storage.from("program-videos").createSignedUrl(sp, 60 * 15);
                if (signed?.signedUrl) ss.video_path = signed.signedUrl;
              } catch {}
            }
          }
        }
      }
      if (submissionId) return NextResponse.json({ submission: filtered[0], submissions: filtered });
      return NextResponse.json({ submissions: filtered, submission: filtered[0] });
    }

    // Sort steps in program and order step_submissions to match step position
    dbSubs.forEach((sub) => {
      if (sub.program && Array.isArray(sub.program.steps)) {
        sub.program.steps.sort((a: ProgramStep, b: ProgramStep) => a.position - b.position);
      }
    });
    for (const s of dbSubs) {
      if (Array.isArray((s as unknown as { step_submissions?: unknown[] }).step_submissions)) {
        for (const ss of (s as unknown as { step_submissions: Array<Record<string, unknown>> }).step_submissions) {
          const sp = (ss as Record<string, unknown>).media_meta && typeof (ss as Record<string, unknown>).media_meta === "object"
            ? ((ss as Record<string, unknown>).media_meta as Record<string, unknown>).storagePath as string || ((ss as Record<string, unknown>).media_meta as Record<string, unknown>).storage_path as string || ss.video_path as string
            : ss.video_path as string;
          if (sp && typeof sp === "string" && sp.startsWith("submissions/")) {
            try {
              const { data: signed } = await admin.storage.from("program-videos").createSignedUrl(sp, 60 * 15);
              if (signed?.signedUrl) ss.video_path = signed.signedUrl;
            } catch {}
          }
        }
      }
    }

    if (submissionId) {
      return NextResponse.json({ submission: dbSubs[0], submissions: dbSubs });
    }
    return NextResponse.json({ submissions: dbSubs, submission: dbSubs[0] });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      action,
      submissionId,
      stepSubmissionId,
      stepId,
      programId,
      patientId: inputPatientId,
      clientUserId,
      videoPath,
      mediaMeta,
      clientComment,
      skipped,
      skipReason,
      consentTherapist,
      consentMetaAi,
      scheduledDate,
      scheduled_date,
    } = body;

    const targetScheduledDate = scheduledDate || scheduled_date || null;

    const admin = createAdminClient();
    if (!admin) {
      return NextResponse.json({ error: "Database not configured" }, { status: 503 });
    }

    let patientId = inputPatientId;
    if (!patientId && clientUserId) {
      const { data: patientRecord } = await admin
        .from("patients")
        .select("id")
        .eq("client_user_id", clientUserId)
        .maybeSingle();
      if (patientRecord) patientId = patientRecord.id;
    }

    // 1. GET OR CREATE DRAFT SUBMISSION FOR PROGRAM & PATIENT
    if (action === "get_or_create" && programId) {
      let resolvedPatientId = patientId;
      if (!resolvedPatientId) {
        // Resolve patient from program
        const { data: prog } = await admin.from("home_programs").select("patient_id").eq("id", programId).maybeSingle();
        if (prog) resolvedPatientId = prog.patient_id;
      }

      if (!resolvedPatientId) {
        return NextResponse.json({ error: "Patient not found" }, { status: 404 });
      }

      // Find existing submission for this program and scheduled date (if specified)
      let subQuery = admin
        .from("submissions")
        .select(`
              *,
              program:home_programs(*, steps:program_steps(*, generated_activity:generated_activities(*))),
              step_submissions(*),
              review:submission_reviews(*, step_reviews(*))
            `)
        .eq("program_id", programId)
        .eq("patient_id", resolvedPatientId);

      if (targetScheduledDate) {
        subQuery = subQuery.eq("scheduled_date", targetScheduledDate);
      }

      const { data: existingSubList } = await subQuery.order("created_at", { ascending: false });
      const existingSub = existingSubList && existingSubList.length > 0 ? existingSubList[0] : null;

      if (existingSub) {
        // Check if step_submissions are complete
        const existingStepSubs = existingSub.step_submissions || [];
        const progSteps: ProgramStep[] = existingSub.program?.steps || [];
        const missingSteps = progSteps.filter(
          (ps) => !existingStepSubs.some((ess: StepSubmission) => ess.program_step_id === ps.id)
        );

        if (missingSteps.length > 0) {
          const newStepSubs = missingSteps.map((ms) => ({
            submission_id: existingSub.id,
            program_step_id: ms.id,
            skipped: false,
            media_meta: {},
          }));
          await admin.from("step_submissions").insert(newStepSubs);

          // Re-fetch enriched
          const { data: refreshed } = await admin
            .from("submissions")
            .select(`
                  *,
                  program:home_programs(*, steps:program_steps(*, generated_activity:generated_activities(*))),
                  step_submissions(*),
                  review:submission_reviews(*, step_reviews(*))
                `)
            .eq("id", existingSub.id)
            .single();

          return NextResponse.json({ submission: refreshed || existingSub, created: false });
        }

        return NextResponse.json({ submission: existingSub, created: false });
      }

      // Create new draft submission
      const { data: newSub, error: subErr } = await admin
        .from("submissions")
        .insert({
          program_id: programId,
          patient_id: resolvedPatientId,
          client_id: clientUserId || null,
          scheduled_date: targetScheduledDate,
          state: "draft",
          consent_therapist: true,
          consent_meta_ai: true,
        })
        .select()
        .single();

      if (subErr || !newSub) {
        return NextResponse.json({ error: subErr?.message || "Failed to create submission" }, { status: 500 });
      }

      // Get program steps
      const { data: progSteps } = await admin
        .from("program_steps")
        .select("*")
        .eq("program_id", programId)
        .order("position", { ascending: true });

      if (progSteps && progSteps.length > 0) {
        const stepSubs = progSteps.map((ps: ProgramStep) => ({
          submission_id: newSub.id,
          program_step_id: ps.id,
          skipped: false,
          media_meta: {},
        }));
        await admin.from("step_submissions").insert(stepSubs);
      }

      const { data: completeSub } = await admin
        .from("submissions")
        .select(`
                *,
                program:home_programs(*, steps:program_steps(*, generated_activity:generated_activities(*))),
                step_submissions(*)
              `)
        .eq("id", newSub.id)
        .single();

      return NextResponse.json({ submission: completeSub || newSub, created: true });
    }

    if (!submissionId) {
      return NextResponse.json({ error: "submissionId is required" }, { status: 400 });
    }

    const { data: dbSub } = await admin
      .from("submissions")
      .select("*, review:submission_reviews(status)")
      .eq("id", submissionId)
      .maybeSingle();

    if (!dbSub) {
      return NextResponse.json({ error: "Submission not found" }, { status: 404 });
    }

    const isReviewed =
      dbSub.state === "reviewed" ||
      (Array.isArray(dbSub.review)
        ? dbSub.review.some((r: { status?: string }) => r.status === "published")
        : (dbSub.review as { status?: string } | null)?.status === "published");

    if (
      isReviewed &&
      (action === "save_step_draft" || action === "submit" || action === "update_submission")
    ) {
      return NextResponse.json(
        {
          error:
            "This submission cannot be edited because feedback has already been published by your therapist.",
          isLocked: true,
        },
        { status: 403 }
      );
    }

    if (action === "update_consents") {
      const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
      if (typeof consentTherapist === "boolean") updates.consent_therapist = consentTherapist;
      if (typeof consentMetaAi === "boolean") updates.consent_meta_ai = consentMetaAi;

      const { data: updated } = await admin
        .from("submissions")
        .update(updates)
        .eq("id", submissionId)
        .select()
        .single();

      return NextResponse.json({ success: true, submission: updated || dbSub });
    }

    if (action === "save_step_draft") {
      const stepUpdates: Record<string, unknown> = { updated_at: new Date().toISOString() };
      if (typeof skipped === "boolean") {
        stepUpdates.skipped = skipped;
        stepUpdates.skip_reason = skipped ? (skipReason || null) : null;
      }
      if (videoPath !== undefined) stepUpdates.video_path = videoPath;
      if (mediaMeta !== undefined) stepUpdates.media_meta = mediaMeta;
      if (clientComment !== undefined) stepUpdates.client_comment = clientComment;

      let targetStepSubId = stepSubmissionId;

      // If stepSubmissionId wasn't passed directly, find it by stepId (program_step_id)
      if (!targetStepSubId && stepId) {
        const { data: foundStepSub } = await admin
          .from("step_submissions")
          .select("id")
          .eq("submission_id", submissionId)
          .eq("program_step_id", stepId)
          .maybeSingle();

        if (foundStepSub) {
          targetStepSubId = foundStepSub.id;
        } else {
          // Create the missing step submission
          const { data: createdStepSub } = await admin
            .from("step_submissions")
            .insert({
              submission_id: submissionId,
              program_step_id: stepId,
              ...stepUpdates,
            })
            .select()
            .single();

          return NextResponse.json({ success: true, stepSubmission: createdStepSub });
        }
      }

      if (targetStepSubId) {
        const { data: updatedStep } = await admin
          .from("step_submissions")
          .update(stepUpdates)
          .eq("id", targetStepSubId)
          .select()
          .single();

        return NextResponse.json({ success: true, stepSubmission: updatedStep });
      }

      return NextResponse.json({ error: "Step submission not found" }, { status: 404 });
    }

    if (action === "submit" || action === "update_submission") {
      const { data: submittedSub } = await admin
        .from("submissions")
        .update({
          state: "submitted",
          submitted_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", submissionId)
        .select()
        .single();

      // Upsert review shell (Idempotent: ON CONFLICT DO NOTHING)
      const { data: prog } = await admin
        .from("home_programs")
        .select("creator_id")
        .eq("id", dbSub.program_id)
        .single();

      await admin
        .from("submission_reviews")
        .upsert(
          {
            submission_id: submissionId,
            therapist_id: prog?.creator_id || null,
            status: "draft",
          },
          { onConflict: "submission_id" }
        );

      return NextResponse.json({
        success: true,
        submission: submittedSub || dbSub,
        message: "Program submitted to therapist for review.",
      });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
