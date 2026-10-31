import { NextRequest, NextResponse } from "next/server";
import { getMockStore, DEMO_CLIENT_ID } from "@/lib/supabase/mock-store";
import { createAdminClient } from "@/lib/supabase/admin";
import { ProgramStep, Submission, StepSubmission } from "@/types/database";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const submissionId = searchParams.get("submissionId") || searchParams.get("id");
    const programId = searchParams.get("programId");
    let patientId = searchParams.get("patientId");
    const clientUserId = searchParams.get("clientUserId");

    const admin = createAdminClient();

    if (admin) {
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

      let query = admin.from("submissions").select(`
        *,
        program:home_programs(*, steps:program_steps(*)),
        step_submissions(*),
        review:submission_reviews(*, step_reviews(*))
      `);

      if (submissionId) {
        query = query.eq("id", submissionId);
      } else if (programId) {
        query = query.eq("program_id", programId);
        if (patientId) query = query.eq("patient_id", patientId);
      } else if (patientId) {
        query = query.eq("patient_id", patientId);
      }

      const { data: dbSubs, error } = await query.order("created_at", { ascending: false });

      if (!error && dbSubs) {
        if (dbSubs.length === 0) {
          return NextResponse.json({ submissions: [], submission: null });
        }

        // Sort steps in program and order step_submissions to match step position
        dbSubs.forEach((sub) => {
          if (sub.program && Array.isArray(sub.program.steps)) {
            sub.program.steps.sort((a: ProgramStep, b: ProgramStep) => a.position - b.position);
          }
        });

        if (submissionId) {
          return NextResponse.json({ submission: dbSubs[0], submissions: dbSubs });
        }
        return NextResponse.json({ submissions: dbSubs, submission: dbSubs[0] });
      }
    }

    // Fallback in-memory store (only for demo users)
    const store = getMockStore();
    const isExplicitRealUser =
      (clientUserId && clientUserId !== DEMO_CLIENT_ID) ||
      (patientId && patientId !== "33333333-3333-4333-8333-333333333333" && patientId !== "33333333-3333-4333-8333-333333333334");

    if (isExplicitRealUser) {
      return NextResponse.json({ submissions: [], submission: null });
    }

    let matchingSubs = store.submissions;

    if (submissionId) {
      matchingSubs = matchingSubs.filter((s) => s.id === submissionId);
    } else if (programId) {
      matchingSubs = matchingSubs.filter((s) => s.program_id === programId);
      if (patientId) matchingSubs = matchingSubs.filter((s) => s.patient_id === patientId);
    } else if (patientId) {
      matchingSubs = matchingSubs.filter((s) => s.patient_id === patientId);
    }

    const enriched = matchingSubs.map((s) => {
      const prog = store.programs.find((p) => p.id === s.program_id);
      const steps = prog ? store.steps.filter((st) => st.program_id === prog.id).sort((a, b) => a.position - b.position) : [];
      const stepSubs = store.stepSubmissions.filter((ss) => ss.submission_id === s.id);
      const rev = store.reviews.find((r) => r.submission_id === s.id);
      const stepRevs = rev ? store.stepReviews.filter((sr) => sr.review_id === rev.id) : [];

      return {
        ...s,
        program: prog ? { ...prog, steps } : null,
        step_submissions: stepSubs,
        review: rev ? { ...rev, step_reviews: stepRevs } : null,
      };
    });

    return NextResponse.json({
      submissions: enriched,
      submission: enriched[0] || null,
    });
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
    } = body;

    const store = getMockStore();
    const admin = createAdminClient();

    let patientId = inputPatientId;
    if (!patientId && clientUserId && admin) {
      const { data: patientRecord } = await admin
        .from("patients")
        .select("id")
        .eq("client_user_id", clientUserId)
        .maybeSingle();
      if (patientRecord) patientId = patientRecord.id;
    }

    // 1. GET OR CREATE DRAFT SUBMISSION FOR PROGRAM & PATIENT
    if (action === "get_or_create" && programId) {
      if (admin) {
        let resolvedPatientId = patientId;
        if (!resolvedPatientId) {
          // Resolve patient from program
          const { data: prog } = await admin.from("home_programs").select("patient_id").eq("id", programId).maybeSingle();
          if (prog) resolvedPatientId = prog.patient_id;
        }

        if (resolvedPatientId) {
          // Find existing submission
          const { data: existingSub } = await admin
            .from("submissions")
            .select(`
              *,
              program:home_programs(*, steps:program_steps(*)),
              step_submissions(*),
              review:submission_reviews(*, step_reviews(*))
            `)
            .eq("program_id", programId)
            .eq("patient_id", resolvedPatientId)
            .maybeSingle();

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
                  program:home_programs(*, steps:program_steps(*)),
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
              state: "draft",
              consent_therapist: true,
              consent_meta_ai: true,
            })
            .select()
            .single();

          if (!subErr && newSub) {
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
                program:home_programs(*, steps:program_steps(*)),
                step_submissions(*)
              `)
              .eq("id", newSub.id)
              .single();

            return NextResponse.json({ submission: completeSub || newSub, created: true });
          }
        }
      }

      // Fallback in-memory
      let sub = store.submissions.find((s) => s.program_id === programId);
      if (!sub) {
        const prog = store.programs.find((p) => p.id === programId);
        const resolvedPatientId = patientId || prog?.patient_id || DEMO_CLIENT_ID;
        const newSubId = `sub-${Date.now()}`;
        sub = {
          id: newSubId,
          program_id: programId,
          patient_id: resolvedPatientId,
          client_id: DEMO_CLIENT_ID,
          state: "draft",
          consent_therapist: true,
          consent_meta_ai: true,
          submitted_at: null,
          reviewed_at: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        store.submissions.push(sub);

        const progSteps = store.steps.filter((s) => s.program_id === programId);
        progSteps.forEach((ps, idx) => {
          store.stepSubmissions.push({
            id: `ss-${Date.now()}-${idx + 1}`,
            submission_id: newSubId,
            program_step_id: ps.id,
            video_path: null,
            media_meta: {},
            client_comment: null,
            skipped: false,
            skip_reason: null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          });
        });
      }

      return NextResponse.json({
        submission: {
          ...sub,
          program: store.programs.find((p) => p.id === programId),
          step_submissions: store.stepSubmissions.filter((ss) => ss.submission_id === sub?.id),
        },
        created: true,
      });
    }

    if (!submissionId) {
      return NextResponse.json({ error: "submissionId is required" }, { status: 400 });
    }

    if (admin) {
      const { data: dbSub } = await admin
        .from("submissions")
        .select("*")
        .eq("id", submissionId)
        .maybeSingle();

      if (dbSub) {
        if (dbSub.state !== "draft" && action !== "get_status") {
          return NextResponse.json(
            {
              error: "This program submission has already been submitted and cannot be modified.",
              submission: dbSub,
              deduplicated: true,
            },
            { status: 200 }
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
        }

        if (action === "submit") {
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
      }
    }

    // Fallback store
    const submission = store.submissions.find((s) => s.id === submissionId);
    if (!submission) {
      return NextResponse.json({ error: "Submission not found" }, { status: 404 });
    }

    // Guard: read-only after submission
    if (submission.state !== "draft") {
      return NextResponse.json(
        {
          error: "This program submission has already been submitted and cannot be modified.",
          submission,
          deduplicated: true,
        },
        { status: 200 }
      );
    }

    // 1. UPDATE CONSENTS
    if (action === "update_consents") {
      if (typeof consentTherapist === "boolean") submission.consent_therapist = consentTherapist;
      if (typeof consentMetaAi === "boolean") submission.consent_meta_ai = consentMetaAi;
      submission.updated_at = new Date().toISOString();
      return NextResponse.json({ success: true, submission });
    }

    // 2. SAVE DRAFT STEP PROGRESS
    if (action === "save_step_draft") {
      let stepSub = store.stepSubmissions.find(
        (ss) => (stepSubmissionId && ss.id === stepSubmissionId) || (stepId && ss.program_step_id === stepId && ss.submission_id === submissionId)
      );

      if (!stepSub && stepId) {
        stepSub = {
          id: `ss-${Date.now()}`,
          submission_id: submissionId,
          program_step_id: stepId,
          video_path: videoPath || null,
          media_meta: mediaMeta || {},
          client_comment: clientComment || null,
          skipped: Boolean(skipped),
          skip_reason: skipReason || null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        store.stepSubmissions.push(stepSub);
        return NextResponse.json({ success: true, stepSubmission: stepSub });
      }

      if (!stepSub) {
        return NextResponse.json({ error: "Step submission not found" }, { status: 404 });
      }

      if (typeof skipped === "boolean") {
        stepSub.skipped = skipped;
        stepSub.skip_reason = skipped ? (skipReason || null) : null;
      }

      if (videoPath !== undefined) stepSub.video_path = videoPath;
      if (mediaMeta !== undefined) stepSub.media_meta = mediaMeta;
      if (clientComment !== undefined) stepSub.client_comment = clientComment;
      stepSub.updated_at = new Date().toISOString();

      return NextResponse.json({ success: true, stepSubmission: stepSub });
    }

    // 3. FINAL SUBMISSION TO THERAPIST
    if (action === "submit") {
      // Validate all steps are accounted for
      const stepsForSub = store.stepSubmissions.filter((ss) => ss.submission_id === submissionId);
      const invalidSteps = stepsForSub.filter((ss) => {
        if (ss.skipped) {
          return !ss.skip_reason || ss.skip_reason.trim().length === 0;
        }
        return !ss.video_path;
      });

      if (invalidSteps.length > 0) {
        return NextResponse.json(
          {
            error:
              "All steps must have either an uploaded activity video or an explicit skip reason before submitting.",
            unaccountedCount: invalidSteps.length,
          },
          { status: 400 }
        );
      }

      submission.state = "submitted";
      submission.submitted_at = new Date().toISOString();
      submission.updated_at = new Date().toISOString();

      // Ensure review shell exists for therapist without duplicating
      let review = store.reviews.find((r) => r.submission_id === submissionId);
      if (!review) {
        const prog = store.programs.find((p) => p.id === submission.program_id);
        const therapistId = prog?.creator_id || "demo-therapist-id";
        review = {
          id: `rev-${Date.now()}`,
          submission_id: submissionId,
          therapist_id: therapistId,
          overall_feedback: null,
          status: "draft",
          published_at: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        store.reviews.push(review);
      }

      return NextResponse.json({
        success: true,
        submission,
        message: "Program submitted to therapist for review.",
      });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
