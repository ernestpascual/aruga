import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("../src/lib/supabase/admin", async () => {
  const { createFakeAdmin } = await import("./mocks/supabase-fake");
  return { createAdminClient: () => createFakeAdmin() };
});

vi.mock("../src/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: null }, error: null }) },
  }),
}));

import { NextRequest } from "next/server";
import {
  getMockStore,
  resetMockStore,
  DEMO_THERAPIST_ID,
  DEMO_SUBMISSION_ID,
} from "../src/lib/supabase/mock-store";
import { POST as clientSubmissionsPOST } from "../src/app/api/client/submissions/route";
import { POST as therapistReviewsPOST } from "../src/app/api/therapist/reviews/route";
import { __resetFakeAuth } from "./mocks/supabase-fake";

describe("Client Submission Feedback Lock & Therapist Feedback Editing", () => {
  beforeEach(() => {
    resetMockStore();
    __resetFakeAuth();
  });

  it("blocks client from editing step drafts when therapist feedback is already reviewed/published", async () => {
    const store = getMockStore();
    const submission = store.submissions.find((s) => s.id === DEMO_SUBMISSION_ID);
    expect(submission).toBeDefined();

    // Mark submission as reviewed with published review
    if (submission) {
      submission.state = "reviewed";
    }
    const review = store.reviews.find((r) => r.submission_id === DEMO_SUBMISSION_ID);
    if (review) {
      review.status = "published";
    }

    const req = new NextRequest("http://localhost:3000/api/client/submissions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "save_step_draft",
        submissionId: DEMO_SUBMISSION_ID,
        clientComment: "Attempting to change my comment after feedback",
      }),
    });

    const res = await clientSubmissionsPOST(req);
    expect(res.status).toBe(403);

    const data = await res.json();
    expect(data.isLocked).toBe(true);
    expect(data.error).toContain("cannot be edited because feedback has already been published");
  });

  it("blocks client from re-submitting when therapist feedback is already reviewed/published", async () => {
    const store = getMockStore();
    const submission = store.submissions.find((s) => s.id === DEMO_SUBMISSION_ID);
    expect(submission).toBeDefined();

    if (submission) {
      submission.state = "reviewed";
    }
    const review = store.reviews.find((r) => r.submission_id === DEMO_SUBMISSION_ID);
    if (review) {
      review.status = "published";
    }

    const req = new NextRequest("http://localhost:3000/api/client/submissions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "submit",
        submissionId: DEMO_SUBMISSION_ID,
      }),
    });

    const res = await clientSubmissionsPOST(req);
    expect(res.status).toBe(403);

    const data = await res.json();
    expect(data.isLocked).toBe(true);
  });

  it("permits client to edit steps before therapist feedback is published", async () => {
    const store = getMockStore();
    const submission = store.submissions.find((s) => s.id === DEMO_SUBMISSION_ID);
    expect(submission).toBeDefined();

    if (submission) {
      submission.state = "draft";
    }
    const review = store.reviews.find((r) => r.submission_id === DEMO_SUBMISSION_ID);
    if (review) {
      review.status = "draft";
    }

    const req = new NextRequest("http://localhost:3000/api/client/submissions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "save_step_draft",
        submissionId: DEMO_SUBMISSION_ID,
        stepSubmissionId: store.stepSubmissions[0].id,
        clientComment: "Practice note while awaiting clinician review",
      }),
    });

    const res = await clientSubmissionsPOST(req);
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.success).toBe(true);
  });

  it("allows therapist to check and edit feedback for an already reviewed submission", async () => {
    const store = getMockStore();
    const submission = store.submissions.find((s) => s.id === DEMO_SUBMISSION_ID);
    if (submission) {
      submission.state = "reviewed";
    }
    const review = store.reviews.find((r) => r.submission_id === DEMO_SUBMISSION_ID);
    if (review) {
      review.status = "published";
      review.overall_feedback = "Initial clinical feedback";
    }

    // Therapist edits and updates the published feedback
    const updateReq = new NextRequest("http://localhost:3000/api/therapist/reviews", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "publish",
        submissionId: DEMO_SUBMISSION_ID,
        therapistId: DEMO_THERAPIST_ID,
        overallFeedback: "Updated clinical feedback after re-checking kinematics",
        subjective: "Client reports zero wrist pain today.",
        objective: "Active cylindrical grasp vertical lift measured 4.2 inches.",
        assessment: "Marked improvement in sustained grasp.",
        plan: "Advance to heavier tabletop objects.",
        stepReviews: [
          {
            stepSubmissionId: store.stepSubmissions[0].id,
            note: "Edited step 1 note: impeccable finger isolation.",
          },
        ],
      }),
    });

    const updateRes = await therapistReviewsPOST(updateReq);
    expect(updateRes.status).toBe(200);

    const updatedData = await updateRes.json();
    expect(updatedData.success).toBe(true);
    expect(updatedData.review.status).toBe("published");
    expect(updatedData.review.overall_feedback).toBe(
      "Updated clinical feedback after re-checking kinematics"
    );
    expect(updatedData.review.subjective).toBe("Client reports zero wrist pain today.");

    // Verify step note was updated
    const updatedStepReview = store.stepReviews.find(
      (sr) => sr.step_submission_id === store.stepSubmissions[0].id
    );
    expect(updatedStepReview?.therapist_note).toBe(
      "Edited step 1 note: impeccable finger isolation."
    );
  });
});
