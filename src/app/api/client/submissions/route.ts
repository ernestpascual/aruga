import { NextRequest, NextResponse } from "next/server";
import { getMockStore, DEMO_CLIENT_ID } from "@/lib/supabase/mock-store";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      action,
      submissionId,
      stepSubmissionId,
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

        if (action === "save_step_draft" && stepSubmissionId) {
          const stepUpdates: Record<string, unknown> = { updated_at: new Date().toISOString() };
          if (typeof skipped === "boolean") {
            stepUpdates.skipped = skipped;
            stepUpdates.skip_reason = skipped ? (skipReason || null) : null;
          }
          if (videoPath !== undefined) stepUpdates.video_path = videoPath;
          if (mediaMeta !== undefined) stepUpdates.media_meta = mediaMeta;
          if (clientComment !== undefined) stepUpdates.client_comment = clientComment;

          const { data: updatedStep } = await admin
            .from("step_submissions")
            .update(stepUpdates)
            .eq("id", stepSubmissionId)
            .select()
            .single();

          return NextResponse.json({ success: true, stepSubmission: updatedStep });
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
    if (action === "save_step_draft" && stepSubmissionId) {
      const stepSub = store.stepSubmissions.find(
        (ss) => ss.id === stepSubmissionId && ss.submission_id === submissionId
      );
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
