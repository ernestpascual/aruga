import { NextRequest, NextResponse } from "next/server";
import { getMockStore, DEMO_THERAPIST_ID } from "@/lib/supabase/mock-store";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      action,
      submissionId,
      reviewId,
      stepReviews,
      overallFeedback,
      confirmedObservationIds,
      stepSubmissionId,
    } = body;

    const store = getMockStore();
    const therapistId = DEMO_THERAPIST_ID;
    const admin = createAdminClient();

    // 1. CONFIRM OBSERVATIONS
    if (action === "confirm_observation" && stepSubmissionId) {
      if (admin) {
        try {
          await admin
            .from("ai_analyses")
            .update({
              confirmed_observations: confirmedObservationIds || [],
              updated_at: new Date().toISOString(),
            })
            .eq("step_submission_id", stepSubmissionId);
        } catch {
          // non-fatal
        }
      }

      const aiRec = store.aiAnalyses.find(
        (a) => a.step_submission_id === stepSubmissionId
      );
      if (aiRec) {
        aiRec.confirmed_observations = confirmedObservationIds || [];
        if (aiRec.spark_results?.observations) {
          aiRec.spark_results.observations.forEach((obs) => {
            obs.confirmed = (confirmedObservationIds || []).includes(obs.id);
          });
        }
      }
      return NextResponse.json({ success: true, aiRecord: aiRec });
    }

    // 2. SAVE DRAFT REVIEW OR PUBLISH FEEDBACK
    if (!submissionId) {
      return NextResponse.json({ error: "submissionId is required" }, { status: 400 });
    }

    const isPublish = action === "publish";

    if (admin) {
      // Upsert submission review (idempotent ON CONFLICT submission_id)
      const reviewPayload: Record<string, unknown> = {
        submission_id: submissionId,
        therapist_id: therapistId,
        status: isPublish ? "published" : "draft",
        updated_at: new Date().toISOString(),
      };
      if (overallFeedback !== undefined) reviewPayload.overall_feedback = overallFeedback;
      if (isPublish) reviewPayload.published_at = new Date().toISOString();

      const { data: dbReview } = await admin
        .from("submission_reviews")
        .upsert(reviewPayload, { onConflict: "submission_id" })
        .select()
        .single();

      if (dbReview && Array.isArray(stepReviews)) {
        for (const sr of stepReviews) {
          if (sr.stepSubmissionId) {
            await admin.from("step_reviews").upsert(
              {
                review_id: dbReview.id,
                step_submission_id: sr.stepSubmissionId,
                therapist_note: sr.note || "",
                updated_at: new Date().toISOString(),
              },
              { onConflict: "review_id,step_submission_id" }
            );
          }
        }
      }

      if (isPublish) {
        await admin
          .from("submissions")
          .update({
            state: "reviewed",
            reviewed_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq("id", submissionId);
      }

      return NextResponse.json({
        success: true,
        review: dbReview,
        submissionState: isPublish ? "reviewed" : "submitted",
      });
    }

    // Fallback store
    const submission = store.submissions.find((s) => s.id === submissionId);
    if (!submission) {
      return NextResponse.json({ error: "Submission not found" }, { status: 404 });
    }

    let review = store.reviews.find((r) => r.submission_id === submissionId);

    if (!review) {
      const newReviewId = reviewId || `rev-${Date.now()}`;
      review = {
        id: newReviewId,
        submission_id: submissionId,
        therapist_id: therapistId,
        overall_feedback: overallFeedback || null,
        status: isPublish ? "published" : "draft",
        published_at: isPublish ? new Date().toISOString() : null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      store.reviews.push(review);
    } else {
      review.overall_feedback = overallFeedback ?? review.overall_feedback;
      review.updated_at = new Date().toISOString();
      if (isPublish) {
        review.status = "published";
        review.published_at = new Date().toISOString();
      }
    }

    // Update step reviews (deduplicated by step_submission_id)
    if (Array.isArray(stepReviews)) {
      for (const sr of stepReviews) {
        const existingSr = store.stepReviews.find(
          (r) => r.review_id === review!.id && r.step_submission_id === sr.stepSubmissionId
        );
        if (existingSr) {
          existingSr.therapist_note = sr.note || "";
          existingSr.updated_at = new Date().toISOString();
        } else {
          store.stepReviews.push({
            id: `sr-${Date.now()}-${Math.random()}`,
            review_id: review.id,
            step_submission_id: sr.stepSubmissionId,
            therapist_note: sr.note || "",
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          });
        }
      }
    }

    if (isPublish) {
      submission.state = "reviewed";
      submission.reviewed_at = new Date().toISOString();
      submission.updated_at = new Date().toISOString();
    }

    return NextResponse.json({
      success: true,
      review,
      submissionState: submission.state,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
