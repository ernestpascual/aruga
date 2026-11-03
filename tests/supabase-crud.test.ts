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
  GET as getClients,
  POST as createClient,
  PATCH as updateClient,
  DELETE as deleteClient,
} from "../src/app/api/therapist/clients/route";
import {
  GET as getPrograms,
  POST as postPrograms,
  PATCH as updateProgram,
  DELETE as deleteProgram,
} from "../src/app/api/therapist/programs/route";
import {
  GET as getSubmissions,
  POST as postSubmissions,
} from "../src/app/api/client/submissions/route";
import {
  GET as getReviews,
  POST as postReviews,
} from "../src/app/api/therapist/reviews/route";
import {
  GET as getMessages,
  POST as postMessages,
  DELETE as deleteMessages,
} from "../src/app/api/messages/route";
import {
  GET as getTherapistLink,
  POST as postTherapistLink,
  PATCH as patchTherapistLink,
  DELETE as deleteTherapistLink,
} from "../src/app/api/client/therapist-link/route";
import { POST as therapistLinkClient } from "../src/app/api/therapist/client-link/route";
import { POST as transferCare } from "../src/app/api/therapist/clients/transfer/route";
import { POST as uploadVideo } from "../src/app/api/client/submissions/upload/route";
import {
  GET as getNotifications,
  POST as postNotifications,
} from "../src/app/api/notifications/route";
import {
  GET as getTherapistSoapNotes,
  POST as postTherapistSoapNotes,
  PATCH as patchTherapistSoapNotes,
  DELETE as deleteTherapistSoapNotes,
} from "../src/app/api/therapist/soap-notes/route";
import { GET as getClientSoapNotes } from "../src/app/api/client/soap-notes/route";
import {
  GET as getSoapSummary,
  POST as postSoapSummary,
} from "../src/app/api/ai/soap-summary/route";
import {
  resetMockStore,
  getMockStore,
  DEMO_THERAPIST_ID,
  DEMO_CLIENT_ID,
  DEMO_PATIENT_ID,
  DEMO_PEDIATRIC_PATIENT_ID,
  DEMO_GERIATRIC_PATIENT_ID,
  DEMO_ADOLESCENT_PATIENT_ID,
  DEMO_PROGRAM_ID,
  DEMO_SUBMISSION_ID,
} from "../src/lib/supabase/mock-store";
import { createAdminClient } from "../src/lib/supabase/admin";
import { __resetFakeAuth } from "./mocks/supabase-fake";

describe("Therapist and Client Database CRUD Operations", () => {
  beforeEach(() => {
    resetMockStore();
    __resetFakeAuth();
  });

  // 1. THERAPIST CLIENTS CRUD
  describe("Therapist -> Clients (Patients) CRUD", () => {
    it("creates a new patient record (POST) and links to therapist", async () => {
      const customTherapistId = "th-custom-999";
      const req = new NextRequest("http://localhost:3000/api/therapist/clients", {
        method: "POST",
        body: JSON.stringify({
          name: "Gabriel Santos",
          age: 62,
          gender: "Male",
          condition: "Post-stroke right hemiparesis",
          email: "gabriel.santos.test@aruga-health.local",
          caregiverName: "Maria Santos",
          therapistId: customTherapistId,
        }),
      });

      const res = await createClient(req);
      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.client).toBeDefined();
      expect(data.client.name).toBe("Gabriel Santos");
      expect(data.client.therapist_id).toBe(customTherapistId);
      expect(data.client.client_category).toBe("old_people");
      expect(data.credentials).toBeDefined();

      // Verify that the user created by the therapist is strictly of client role in profiles
      const store = getMockStore();
      const clientProfile = store.profiles.find(
        (p: { id: string; email?: string | null; role: string }) =>
          p.id === data.client.client_user_id || p.email === "gabriel.santos.test@aruga-health.local"
      );
      expect(clientProfile).toBeDefined();
      expect(clientProfile?.role).toBe("client");

      // Verify that this therapist can fetch this client
      const listReq = new NextRequest(
        `http://localhost:3000/api/therapist/clients?therapistId=${customTherapistId}`
      );
      const listRes = await getClients(listReq);
      const listData = await listRes.json();
      expect(listData.clients.some((c: any) => c.email === "gabriel.santos.test@aruga-health.local")).toBe(true);
    });

    it("adopts and updates existing patient record when re-added by the same therapist", async () => {
      const customTherapistId = "th-custom-999";
      // First create
      await createClient(
        new NextRequest("http://localhost:3000/api/therapist/clients", {
          method: "POST",
          body: JSON.stringify({
            name: "Gabriel Santos",
            age: 62,
            gender: "Male",
            condition: "Post-stroke right hemiparesis",
            email: "gabriel.santos.test@aruga-health.local",
            therapistId: customTherapistId,
          }),
        })
      );

      // Re-add to adopt / update
      const req = new NextRequest("http://localhost:3000/api/therapist/clients", {
        method: "POST",
        body: JSON.stringify({
          name: "Gabriel Santos Modified",
          age: 63,
          gender: "Male",
          condition: "Post-stroke right hemiparesis (Refined)",
          email: "gabriel.santos.test@aruga-health.local",
          therapistId: customTherapistId,
        }),
      });

      const res = await createClient(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.client.name).toBe("Gabriel Santos Modified");
      expect(data.client.age).toBe(63);
      expect(data.client.therapist_id).toBe(customTherapistId);
    });

    it("allows re-adding/linking client if assigned to a different therapist or existing account", async () => {
      const firstTherapistId = "th-first-777";
      const differentTherapistId = "th-different-888";

      // First create under first therapist
      await createClient(
        new NextRequest("http://localhost:3000/api/therapist/clients", {
          method: "POST",
          body: JSON.stringify({
            name: "Gabriel Santos",
            age: 62,
            gender: "Male",
            condition: "Post-stroke right hemiparesis",
            email: "gabriel.santos.test@aruga-health.local",
            therapistId: firstTherapistId,
          }),
        })
      );

      // Re-adding under different therapist initiates link invitation
      const req = new NextRequest("http://localhost:3000/api/therapist/clients", {
        method: "POST",
        body: JSON.stringify({
          name: "Gabriel Santos",
          age: 63,
          gender: "Male",
          condition: "Post-stroke right hemiparesis",
          email: "gabriel.santos.test@aruga-health.local",
          therapistId: differentTherapistId,
        }),
      });

      const res = await createClient(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.client.therapist_id).toBe(differentTherapistId);
      expect(data.client.previous_therapist_id).toBe(firstTherapistId);
      expect(data.client.invitation_status).toBe("pending");
    });

    it("reads client list and individual client by id (GET)", async () => {
      // Read list
      const listReq = new NextRequest(
        `http://localhost:3000/api/therapist/clients?therapistId=${DEMO_THERAPIST_ID}&isDemo=true`
      );
      const listRes = await getClients(listReq);
      expect(listRes.status).toBe(200);
      const listData = await listRes.json();
      expect(listData.clients.length).toBeGreaterThan(0);

      // Read single
      const singleReq = new NextRequest(
        `http://localhost:3000/api/therapist/clients?id=${DEMO_PATIENT_ID}&isDemo=true`
      );
      const singleRes = await getClients(singleReq);
      expect(singleRes.status).toBe(200);
      const singleData = await singleRes.json();
      expect(singleData.client).toBeDefined();
      expect(singleData.client.id).toBe(DEMO_PATIENT_ID);
    });

    it("updates an existing patient record (PATCH)", async () => {
      const updateReq = new NextRequest("http://localhost:3000/api/therapist/clients", {
        method: "PATCH",
        body: JSON.stringify({
          id: DEMO_PATIENT_ID,
          name: "Marcus Vance Updated",
          condition: "Advanced neuro-rehabilitation and dynamic grasp",
          caregiverName: "Helena Vance",
        }),
      });

      const updateRes = await updateClient(updateReq);
      expect(updateRes.status).toBe(200);
      const data = await updateRes.json();
      expect(data.client.name).toBe("Marcus Vance Updated");
      expect(data.client.condition).toBe("Advanced neuro-rehabilitation and dynamic grasp");
      expect(data.client.caregiver_name).toBe("Helena Vance");
    });

    it("deletes a patient record (DELETE)", async () => {
      const deleteReq = new NextRequest(
        `http://localhost:3000/api/therapist/clients?id=${DEMO_PATIENT_ID}`,
        { method: "DELETE" }
      );

      const deleteRes = await deleteClient(deleteReq);
      expect(deleteRes.status).toBe(200);
      const data = await deleteRes.json();
      expect(data.success).toBe(true);

      // Verify patient is removed
      const checkReq = new NextRequest(
        `http://localhost:3000/api/therapist/clients?id=${DEMO_PATIENT_ID}&isDemo=true`
      );
      const checkRes = await getClients(checkReq);
      const checkData = await checkRes.json();
      expect(checkData.client).toBeFalsy();
    });
  });

  // 2. THERAPIST HOME PROGRAMS CRUD
  describe("Therapist -> Home Programs & Steps CRUD", () => {
    let createdProgramId: string;

    it("creates a new home program with steps (POST)", async () => {
      const req = new NextRequest("http://localhost:3000/api/therapist/programs", {
        method: "POST",
        body: JSON.stringify({
          patientId: DEMO_PATIENT_ID,
          therapistId: DEMO_THERAPIST_ID,
          title: "Bilateral Tabletop Coordination Routine",
          mainInstructions: "Perform once daily with steady posture.",
          steps: [
            { title: "Warmup Stretch", instructions: "Slow wrist rotations for 30s." },
            { title: "Target Block Grasp", instructions: "Reach and grasp wooden block cleanly." },
          ],
        }),
      });

      const res = await postPrograms(req);
      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.program).toBeDefined();
      expect(data.program.title).toBe("Bilateral Tabletop Coordination Routine");
      expect(data.program.steps.length).toBe(2);
      createdProgramId = data.program.id;
    });

    it("reads a program by id and by patientId (GET)", async () => {
      const req = new NextRequest(
        `http://localhost:3000/api/therapist/programs?id=${DEMO_PROGRAM_ID}&isDemo=true`
      );
      const res = await getPrograms(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.program).toBeDefined();
      expect(data.program.id).toBe(DEMO_PROGRAM_ID);
      expect(data.program.steps.length).toBeGreaterThan(0);
    });

    it("updates program title, instructions, and steps (PATCH)", async () => {
      const updateReq = new NextRequest("http://localhost:3000/api/therapist/programs", {
        method: "PATCH",
        body: JSON.stringify({
          programId: DEMO_PROGRAM_ID,
          therapistId: DEMO_THERAPIST_ID,
          title: "Advanced Precision Grasp Routine",
          mainInstructions: "Updated therapeutic instructions for week 4.",
          steps: [
            { title: "Step 1", instructions: "Updated first step" },
            { title: "Step 2", instructions: "Updated second step" },
            { title: "Step 3", instructions: "Updated third step" },
          ],
        }),
      });

      const updateRes = await updateProgram(updateReq);
      expect(updateRes.status).toBe(200);
      const data = await updateRes.json();
      expect(data.program.title).toBe("Advanced Precision Grasp Routine");
      expect(data.program.main_instructions).toBe("Updated therapeutic instructions for week 4.");
      expect(data.program.steps.length).toBe(3);
    });

    it("creates and updates a home program with up to 10 scheduled practice dates (POST & PATCH)", async () => {
      const initialDates = ["2026-11-01", "2026-11-03", "2026-11-05"];
      const createReq = new NextRequest("http://localhost:3000/api/therapist/programs", {
        method: "POST",
        body: JSON.stringify({
          patientId: DEMO_PATIENT_ID,
          therapistId: DEMO_THERAPIST_ID,
          title: "Scheduled Practice Session Routine",
          mainInstructions: "Practice on designated scheduled dates.",
          scheduledDates: initialDates,
          steps: [
            { title: "Warmup Stretch", instructions: "Slow wrist rotations." },
          ],
        }),
      });

      const createRes = await postPrograms(createReq);
      expect(createRes.status).toBe(201);
      const createData = await createRes.json();
      expect(createData.program).toBeDefined();
      expect(createData.program.scheduled_dates).toEqual(initialDates);
      const programId = createData.program.id;

      // Update with up to 5 dates
      const updatedDates = ["2026-11-01", "2026-11-03", "2026-11-05", "2026-11-07", "2026-11-09"];
      const updateReq = new NextRequest("http://localhost:3000/api/therapist/programs", {
        method: "PATCH",
        body: JSON.stringify({
          programId,
          therapistId: DEMO_THERAPIST_ID,
          scheduledDates: updatedDates,
        }),
      });

      const updateRes = await updateProgram(updateReq);
      expect(updateRes.status).toBe(200);
      const updateData = await updateRes.json();
      expect(updateData.program.scheduled_dates).toEqual(updatedDates);
    });

    it("assigns, duplicates, and archives programs (POST actions)", async () => {
      // 1. Assign
      const assignReq = new NextRequest("http://localhost:3000/api/therapist/programs", {
        method: "POST",
        body: JSON.stringify({
          action: "assign",
          programId: DEMO_PROGRAM_ID,
          therapistId: DEMO_THERAPIST_ID,
        }),
      });
      const assignRes = await postPrograms(assignReq);
      expect(assignRes.status).toBe(200);

      // 2. Archive
      const archiveReq = new NextRequest("http://localhost:3000/api/therapist/programs", {
        method: "POST",
        body: JSON.stringify({
          action: "archive",
          programId: DEMO_PROGRAM_ID,
          therapistId: DEMO_THERAPIST_ID,
        }),
      });
      const archiveRes = await postPrograms(archiveReq);
      expect(archiveRes.status).toBe(200);

      // 3. Duplicate
      const dupReq = new NextRequest("http://localhost:3000/api/therapist/programs", {
        method: "POST",
        body: JSON.stringify({
          action: "duplicate",
          programId: DEMO_PROGRAM_ID,
          therapistId: DEMO_THERAPIST_ID,
        }),
      });
      const dupRes = await postPrograms(dupReq);
      expect(dupRes.status).toBe(200);
      const dupData = await dupRes.json();
      expect(dupData.program.title).toContain("(Copy)");
    });

    it("attaches submissions and latest_submission to home programs so therapist can view completed status and provide feedback", async () => {
      const progReq = new NextRequest(
        `http://localhost:3000/api/therapist/programs?patientId=${DEMO_PATIENT_ID}&isDemo=true`
      );
      const progRes = await getPrograms(progReq);
      expect(progRes.status).toBe(200);
      const progData = await progRes.json();
      expect(progData.programs.length).toBeGreaterThan(0);

      // Verify that programs contain submissions and latest_submission
      const progWithSub = progData.programs.find((p: any) => p.latest_submission);
      expect(progWithSub).toBeDefined();
      expect(progWithSub.latest_submission.id).toBe(DEMO_SUBMISSION_ID);
      expect(progWithSub.latest_submission.state).toBeDefined();
      expect(Array.isArray(progWithSub.submissions)).toBe(true);
    });

    it("deletes a home program (DELETE)", async () => {
      const delReq = new NextRequest(
        `http://localhost:3000/api/therapist/programs?id=${DEMO_PROGRAM_ID}&requesterId=${DEMO_THERAPIST_ID}`,
        { method: "DELETE" }
      );
      const delRes = await deleteProgram(delReq);
      expect(delRes.status).toBe(200);
      const data = await delRes.json();
      expect(data.success).toBe(true);
    });
  });

  // 3. CLIENT SUBMISSIONS CRUD
  describe("Client -> Submissions & Step Progress CRUD", () => {
    async function createDraft(programId = "prog-draft-test") {
      const req = new NextRequest("http://localhost:3000/api/client/submissions", {
        method: "POST",
        body: JSON.stringify({
          action: "get_or_create",
          programId,
          patientId: DEMO_PATIENT_ID,
        }),
      });
      const res = await postSubmissions(req);
      const data = await res.json();
      return data.submission;
    }

    it("gets or creates a draft submission shell (POST action: get_or_create)", async () => {
      const sub = await createDraft("prog-draft-1");
      expect(sub).toBeDefined();
      expect(sub.program_id).toBe("prog-draft-1");
      expect(sub.state).toBe("draft");
    });

    it("reads submissions by programId or submissionId (GET)", async () => {
      const req = new NextRequest(
        `http://localhost:3000/api/client/submissions?submissionId=${DEMO_SUBMISSION_ID}`
      );
      const res = await getSubmissions(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.submission).toBeDefined();
      expect(data.submission.id).toBe(DEMO_SUBMISSION_ID);
    });

    it("saves step draft progress (POST action: save_step_draft)", async () => {
      const draft = await createDraft("prog-draft-2");

      const req = new NextRequest("http://localhost:3000/api/client/submissions", {
        method: "POST",
        body: JSON.stringify({
          action: "save_step_draft",
          submissionId: draft.id,
          stepId: "step-new-1",
          videoPath: "/uploads/exercise_step1_test.mp4",
          clientComment: "Completed 5 reps smoothly without tremors.",
          skipped: false,
        }),
      });

      const res = await postSubmissions(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.stepSubmission.video_path).toBe("/uploads/exercise_step1_test.mp4");
      expect(data.stepSubmission.client_comment).toBe("Completed 5 reps smoothly without tremors.");
    });

    it("updates sharing and AI consents (POST action: update_consents)", async () => {
      const draft = await createDraft("prog-draft-3");

      const req = new NextRequest("http://localhost:3000/api/client/submissions", {
        method: "POST",
        body: JSON.stringify({
          action: "update_consents",
          submissionId: draft.id,
          consentTherapist: true,
          consentMetaAi: false,
        }),
      });

      const res = await postSubmissions(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.submission.consent_meta_ai).toBe(false);
    });

    it("submits the routine to therapist (POST action: submit)", async () => {
      const draft = await createDraft("prog-draft-4");

      // Save a valid video step first so all steps are complete
      await postSubmissions(
        new NextRequest("http://localhost:3000/api/client/submissions", {
          method: "POST",
          body: JSON.stringify({
            action: "save_step_draft",
            submissionId: draft.id,
            stepId: "step-1",
            videoPath: "/uploads/exercise_step1_test.mp4",
            skipped: false,
          }),
        })
      );

      const req = new NextRequest("http://localhost:3000/api/client/submissions", {
        method: "POST",
        body: JSON.stringify({
          action: "submit",
          submissionId: draft.id,
          consentTherapist: true,
          consentMetaAi: false,
        }),
      });

      const res = await postSubmissions(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.submission.state).toBe("submitted");
    });

    it("manages separate submissions per scheduled practice date (one submission per date)", async () => {
      const programId = "prog-multi-dates-test";
      const date1 = "2026-11-01";
      const date2 = "2026-11-03";

      // 1. Create or get submission for Date 1
      const req1 = new NextRequest("http://localhost:3000/api/client/submissions", {
        method: "POST",
        body: JSON.stringify({
          action: "get_or_create",
          programId,
          patientId: DEMO_PATIENT_ID,
          scheduledDate: date1,
        }),
      });
      const res1 = await postSubmissions(req1);
      expect(res1.status).toBe(200);
      const data1 = await res1.json();
      expect(data1.submission.program_id).toBe(programId);
      expect(data1.submission.scheduled_date).toBe(date1);

      // 2. Create or get submission for Date 2
      const req2 = new NextRequest("http://localhost:3000/api/client/submissions", {
        method: "POST",
        body: JSON.stringify({
          action: "get_or_create",
          programId,
          patientId: DEMO_PATIENT_ID,
          scheduledDate: date2,
        }),
      });
      const res2 = await postSubmissions(req2);
      expect(res2.status).toBe(200);
      const data2 = await res2.json();
      expect(data2.submission.program_id).toBe(programId);
      expect(data2.submission.scheduled_date).toBe(date2);

      // Verify that they are distinct submissions
      expect(data1.submission.id).not.toBe(data2.submission.id);

      // 3. Query submission by programId + scheduledDate (GET)
      const getReq = new NextRequest(
        `http://localhost:3000/api/client/submissions?programId=${programId}&scheduledDate=${date1}`
      );
      const getRes = await getSubmissions(getReq);
      expect(getRes.status).toBe(200);
      const getData = await getRes.json();
      expect(getData.submission.id).toBe(data1.submission.id);
      expect(getData.submission.scheduled_date).toBe(date1);
    });

    it("allows client to edit an already-submitted home program submission (POST action: save_step_draft and update_submission)", async () => {
      // 1. Create and submit a home program routine
      const draft = await createDraft("prog-edit-submitted-test");

      await postSubmissions(
        new NextRequest("http://localhost:3000/api/client/submissions", {
          method: "POST",
          body: JSON.stringify({
            action: "save_step_draft",
            submissionId: draft.id,
            stepId: "step-1",
            videoPath: "/uploads/initial_video.mp4",
            clientComment: "Initial attempt with mild fatigue.",
            skipped: false,
          }),
        })
      );

      const submitReq = new NextRequest("http://localhost:3000/api/client/submissions", {
        method: "POST",
        body: JSON.stringify({
          action: "submit",
          submissionId: draft.id,
          consentTherapist: true,
          consentMetaAi: false,
        }),
      });
      const submitRes = await postSubmissions(submitReq);
      expect(submitRes.status).toBe(200);
      const submitData = await submitRes.json();
      expect(submitData.submission.state).toBe("submitted");

      // 2. Client re-edits step details on the submitted submission
      const editStepReq = new NextRequest("http://localhost:3000/api/client/submissions", {
        method: "POST",
        body: JSON.stringify({
          action: "save_step_draft",
          submissionId: draft.id,
          stepId: "step-1",
          videoPath: "/uploads/improved_video_retake.mp4",
          clientComment: "Retook video: much better wrist stability and grip.",
          skipped: false,
        }),
      });
      const editStepRes = await postSubmissions(editStepReq);
      expect(editStepRes.status).toBe(200);
      const editStepData = await editStepRes.json();
      expect(editStepData.success).toBe(true);
      expect(editStepData.stepSubmission.video_path).toBe("/uploads/improved_video_retake.mp4");
      expect(editStepData.stepSubmission.client_comment).toBe(
        "Retook video: much better wrist stability and grip."
      );

      // 3. Client re-submits updated submission
      const reSubmitReq = new NextRequest("http://localhost:3000/api/client/submissions", {
        method: "POST",
        body: JSON.stringify({
          action: "update_submission",
          submissionId: draft.id,
          consentTherapist: true,
          consentMetaAi: false,
        }),
      });
      const reSubmitRes = await postSubmissions(reSubmitReq);
      expect(reSubmitRes.status).toBe(200);
      const reSubmitData = await reSubmitRes.json();
      expect(reSubmitData.success).toBe(true);
      expect(reSubmitData.submission.state).toBe("submitted");

      // 4. Verify step submission shows updated details on fetch
      const verifyReq = new NextRequest(
        `http://localhost:3000/api/client/submissions?submissionId=${draft.id}`
      );
      const verifyRes = await getSubmissions(verifyReq);
      expect(verifyRes.status).toBe(200);
      const verifyData = await verifyRes.json();
      const step1 = verifyData.submission.step_submissions.find(
        (s: any) => s.program_step_id === "step-1"
      );
      expect(step1).toBeDefined();
      expect(step1.video_path).toBe("/uploads/improved_video_retake.mp4");
      expect(step1.client_comment).toBe("Retook video: much better wrist stability and grip.");
    });

    it("uploads video per step to Cloud Storage compliant with limits", async () => {
      const draft = await createDraft("prog-upload-test");

      const formData = new FormData();
      const videoBlob = new Blob(["dummy-video-content-stream"], { type: "video/webm" });
      formData.append("file", videoBlob, "exercise_step_1.webm");
      formData.append("submissionId", draft.id);
      formData.append("stepId", "step-1");
      formData.append("durationSeconds", "15");

      const uploadReq = new NextRequest("http://localhost:3000/api/client/submissions/upload", {
        method: "POST",
        body: formData,
      });

      const uploadRes = await uploadVideo(uploadReq);
      expect(uploadRes.status).toBe(200);
      const data = await uploadRes.json();
      expect(data.success).toBe(true);
      expect(data.videoPath).toBeDefined();
      expect(data.bucket).toBe("program-videos");
    });

    it("rejects video upload exceeding maximum limit (50MB)", async () => {
      const formData = new FormData();
      const oversizedBlob = new Blob(["mock"], { type: "video/mp4" });
      formData.append("file", oversizedBlob, "huge_exercise.mp4");
      formData.append("fileSizeBytes", String(60 * 1024 * 1024));

      const uploadReq = new NextRequest("http://localhost:3000/api/client/submissions/upload", {
        method: "POST",
        body: formData,
      });

      const uploadRes = await uploadVideo(uploadReq);
      expect(uploadRes.status).toBe(400);
      const data = await uploadRes.json();
      expect(data.error).toContain("maximum allowed size of 50MB");
    });

    it("rejects non-video mime types for step uploads", async () => {
      const formData = new FormData();
      const textBlob = new Blob(["this is a text note"], { type: "text/plain" });
      formData.append("file", textBlob, "notes.txt");

      const uploadReq = new NextRequest("http://localhost:3000/api/client/submissions/upload", {
        method: "POST",
        body: formData,
      });

      const uploadRes = await uploadVideo(uploadReq);
      expect(uploadRes.status).toBe(400);
      const data = await uploadRes.json();
      expect(data.error).toContain("Unsupported media format");
    });
  });

  // 4. THERAPIST REVIEWS CRUD
  describe("Therapist -> Reviews CRUD", () => {
    it("reads review by submissionId (GET)", async () => {
      const req = new NextRequest(
        `http://localhost:3000/api/therapist/reviews?submissionId=${DEMO_SUBMISSION_ID}`
      );
      const res = await getReviews(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.review).toBeDefined();
      expect(data.review.submission_id).toBe(DEMO_SUBMISSION_ID);
    });

    it("saves draft review notes and publishes review (POST)", async () => {
      // 1. Save Draft
      const draftReq = new NextRequest("http://localhost:3000/api/therapist/reviews", {
        method: "POST",
        body: JSON.stringify({
          action: "save_draft",
          submissionId: DEMO_SUBMISSION_ID,
          therapistId: DEMO_THERAPIST_ID,
          overallFeedback: "Smooth arm reach. Keep working on finger release.",
          stepReviews: [
            {
              stepSubmissionId: "88888881-8888-4888-8888-888888888881",
              note: "Good posture maintenance.",
            },
          ],
        }),
      });

      const draftRes = await postReviews(draftReq);
      expect(draftRes.status).toBe(200);
      const draftData = await draftRes.json();
      expect(draftData.review.status).toBe("draft");

      // 2. Publish Review with overall and per-step feedback
      const pubReq = new NextRequest("http://localhost:3000/api/therapist/reviews", {
        method: "POST",
        body: JSON.stringify({
          action: "publish",
          submissionId: DEMO_SUBMISSION_ID,
          therapistId: DEMO_THERAPIST_ID,
          overallFeedback: "Clinically approved: impressive bilateral dexterity improvement.",
          stepReviews: [
            {
              stepSubmissionId: "88888881-8888-4888-8888-888888888881",
              note: "Good posture maintenance and finger release.",
            },
          ],
        }),
      });

      const pubRes = await postReviews(pubReq);
      expect(pubRes.status).toBe(200);
      const pubData = await pubRes.json();
      expect(pubData.review.status).toBe("published");
      expect(pubData.submissionState).toBe("reviewed");
      expect(pubData.review.overall_feedback).toBe(
        "Clinically approved: impressive bilateral dexterity improvement."
      );

      // 3. Client reads the published review with per-step notes and overall feedback
      const clientReq = new NextRequest(
        `http://localhost:3000/api/client/submissions?submissionId=${DEMO_SUBMISSION_ID}`
      );
      const clientRes = await getSubmissions(clientReq);
      expect(clientRes.status).toBe(200);
      const clientData = await clientRes.json();
      expect(clientData.submission.review.overall_feedback).toBe(
        "Clinically approved: impressive bilateral dexterity improvement."
      );
      expect(clientData.submission.review.step_reviews.length).toBeGreaterThan(0);
      expect(clientData.submission.review.step_reviews[0].therapist_note).toBe(
        "Good posture maintenance and finger release."
      );
    });
  });

  // 5. MESSAGES CRUD
  describe("Therapist <-> Client Messages CRUD", () => {
    it("sends a message and reads thread (POST & GET)", async () => {
      // Send message
      const postReq = new NextRequest("http://localhost:3000/api/messages", {
        method: "POST",
        body: JSON.stringify({
          patientId: DEMO_PATIENT_ID,
          senderRole: "therapist",
          senderId: DEMO_THERAPIST_ID,
          text: "Hi Marcus, remember to take short breath breaks between cup grasps today.",
          referencedProgramId: DEMO_PROGRAM_ID,
        }),
      });

      const postRes = await postMessages(postReq);
      expect(postRes.status).toBe(201);
      const postData = await postRes.json();
      expect(postData.message).toBeDefined();
      expect(postData.message.body).toBe(
        "Hi Marcus, remember to take short breath breaks between cup grasps today."
      );

      // Read thread
      const getReq = new NextRequest(
        `http://localhost:3000/api/messages?patientId=${DEMO_PATIENT_ID}&requesterId=${DEMO_THERAPIST_ID}&isDemo=true`
      );
      const getRes = await getMessages(getReq);
      expect(getRes.status).toBe(200);
      const getData = await getRes.json();
      expect(getData.messages.length).toBeGreaterThan(1);
      expect(getData.availablePrograms.length).toBeGreaterThan(0);
    });

    it("supports 1 therapist to many clients with distinct conversation threads and multiple messages", async () => {
      // 1. Therapist fetches thread for Client 1 (Marcus Vance - Adult)
      const adultReq = new NextRequest(
        `http://localhost:3000/api/messages?patientId=${DEMO_PATIENT_ID}&requesterId=${DEMO_THERAPIST_ID}&isDemo=true`
      );
      const adultRes = await getMessages(adultReq);
      expect(adultRes.status).toBe(200);
      const adultData = await adultRes.json();
      expect(adultData.messages.length).toBeGreaterThanOrEqual(2);
      expect(adultData.messages.every((m: any) => m.patient_id === DEMO_PATIENT_ID)).toBe(true);

      // 2. Therapist fetches thread for Client 2 (Leo Chen - Pediatric)
      const pediaReq = new NextRequest(
        `http://localhost:3000/api/messages?patientId=${DEMO_PEDIATRIC_PATIENT_ID}&requesterId=${DEMO_THERAPIST_ID}&isDemo=true`
      );
      const pediaRes = await getMessages(pediaReq);
      expect(pediaRes.status).toBe(200);
      const pediaData = await pediaRes.json();
      expect(pediaData.messages.length).toBeGreaterThanOrEqual(2);
      expect(pediaData.messages.every((m: any) => m.patient_id === DEMO_PEDIATRIC_PATIENT_ID)).toBe(true);

      // 3. Therapist fetches thread for Client 3 (Eleanor Ramos - Geriatric)
      const geriatricReq = new NextRequest(
        `http://localhost:3000/api/messages?patientId=${DEMO_GERIATRIC_PATIENT_ID}&requesterId=${DEMO_THERAPIST_ID}&isDemo=true`
      );
      const geriatricRes = await getMessages(geriatricReq);
      expect(geriatricRes.status).toBe(200);
      const geriatricData = await geriatricRes.json();
      expect(geriatricData.messages.length).toBeGreaterThanOrEqual(2);
      expect(geriatricData.messages.every((m: any) => m.patient_id === DEMO_GERIATRIC_PATIENT_ID)).toBe(true);

      // 4. Therapist fetches thread for Client 4 (Jordan Miller - Adolescent)
      const adolescentReq = new NextRequest(
        `http://localhost:3000/api/messages?patientId=${DEMO_ADOLESCENT_PATIENT_ID}&requesterId=${DEMO_THERAPIST_ID}&isDemo=true`
      );
      const adolescentRes = await getMessages(adolescentReq);
      expect(adolescentRes.status).toBe(200);
      const adolescentData = await adolescentRes.json();
      expect(adolescentData.messages.length).toBeGreaterThanOrEqual(2);
      expect(adolescentData.messages.every((m: any) => m.patient_id === DEMO_ADOLESCENT_PATIENT_ID)).toBe(true);

      // 5. Therapist sends message to Client 2
      const postPedia = new NextRequest("http://localhost:3000/api/messages", {
        method: "POST",
        body: JSON.stringify({
          patientId: DEMO_PEDIATRIC_PATIENT_ID,
          senderRole: "therapist",
          senderId: DEMO_THERAPIST_ID,
          text: "Hi Sarah, excellent job with Leo's pincer grip today!",
          referencedProgramId: null,
        }),
      });
      const postPediaRes = await postMessages(postPedia);
      expect(postPediaRes.status).toBe(201);
      const postPediaData = await postPediaRes.json();
      expect(postPediaData.message.patient_id).toBe(DEMO_PEDIATRIC_PATIENT_ID);
    });

    it("allows referencing a home program when sending a message", async () => {
      const postReq = new NextRequest("http://localhost:3000/api/messages", {
        method: "POST",
        body: JSON.stringify({
          patientId: DEMO_PATIENT_ID,
          senderRole: "therapist",
          senderId: DEMO_THERAPIST_ID,
          text: "Marcus, please practice this routine before dinner tonight.",
          referencedProgramId: DEMO_PROGRAM_ID,
        }),
      });
      const postRes = await postMessages(postReq);
      expect(postRes.status).toBe(201);
      const postData = await postRes.json();
      expect(postData.message.referenced_program_id).toBe(DEMO_PROGRAM_ID);
      expect(postData.message.referenced_program).toBeDefined();
      expect(postData.message.referenced_program.id).toBe(DEMO_PROGRAM_ID);
    });

    it("allows message deletion via DELETE /api/messages", async () => {
      // 1. Post a new message to delete
      const postReq = new NextRequest("http://localhost:3000/api/messages", {
        method: "POST",
        body: JSON.stringify({
          patientId: DEMO_PATIENT_ID,
          senderRole: "therapist",
          senderId: DEMO_THERAPIST_ID,
          text: "This message will be deleted shortly.",
          referencedProgramId: null,
        }),
      });
      const postRes = await postMessages(postReq);
      const postData = await postRes.json();
      const messageId = postData.message.id;
      expect(messageId).toBeDefined();

      // 2. Delete the message
      const delReq = new NextRequest(
        `http://localhost:3000/api/messages?id=${messageId}&requesterId=${DEMO_THERAPIST_ID}`,
        { method: "DELETE" }
      );
      const delRes = await deleteMessages(delReq);
      expect(delRes.status).toBe(200);
      const delData = await delRes.json();
      expect(delData.success).toBe(true);
      expect(delData.deletedId).toBe(messageId);

      // 3. Confirm deletion
      const getReq = new NextRequest(
        `http://localhost:3000/api/messages?patientId=${DEMO_PATIENT_ID}&requesterId=${DEMO_THERAPIST_ID}&isDemo=true`
      );
      const getRes = await getMessages(getReq);
      const getData = await getRes.json();
      expect(getData.messages.some((m: any) => m.id === messageId)).toBe(false);
    });
  });

  // 6. TWO-WAY THERAPIST <-> CLIENT CONFIRMATION HANDSHAKE
  describe("Two-Way Therapist <-> Client Confirmation Handshake", () => {
    it("client requests therapist connection and therapist confirms (POST & PATCH)", async () => {
      // 1. Client sends request to connect with therapist
      const req = new NextRequest("http://localhost:3000/api/client/therapist-link", {
        method: "POST",
        body: JSON.stringify({
          clientUserId: "test-client-usr-101",
          therapistEmail: "dr.elena.ramos@aruga.local",
        }),
      });

      const res = await postTherapistLink(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.patient.invitation_status).toBe("pending");
      expect(data.patient.invitation_initiated_by).toBe("client");

      // 2. Therapist sees pending request and confirms it
      const confirmReq = new NextRequest("http://localhost:3000/api/therapist/clients", {
        method: "PATCH",
        body: JSON.stringify({
          id: data.patient.id,
          action: "confirm",
        }),
      });

      const confirmRes = await updateClient(confirmReq);
      expect(confirmRes.status).toBe(200);
      const confirmData = await confirmRes.json();
      expect(confirmData.client.invitation_status).toBe("accepted");
    });

    it("therapist invites client and client accepts invitation (POST & PATCH)", async () => {
      // 1. Therapist invites client
      const inviteReq = new NextRequest("http://localhost:3000/api/therapist/clients", {
        method: "POST",
        body: JSON.stringify({
          name: "Amara Jones",
          age: 28,
          gender: "Female",
          condition: "Carpal tunnel release rehabilitation",
          email: "amara.jones@test.local",
          therapistId: DEMO_THERAPIST_ID,
        }),
      });

      const inviteRes = await createClient(inviteReq);
      expect(inviteRes.status).toBe(201);
      const inviteData = await inviteRes.json();
      expect(inviteData.client.invitation_status).toBe("pending");
      expect(inviteData.client.invitation_initiated_by).toBe("therapist");

      // 2. Client logs in and accepts invitation
      const acceptReq = new NextRequest("http://localhost:3000/api/client/therapist-link", {
        method: "PATCH",
        body: JSON.stringify({
          clientUserId: inviteData.client.client_user_id,
          action: "accept",
        }),
      });

      const acceptRes = await patchTherapistLink(acceptReq);
      expect(acceptRes.status).toBe(200);
      const acceptData = await acceptRes.json();
      expect(acceptData.success).toBe(true);
      expect(acceptData.patient.invitation_status).toBe("accepted");
    });

    it("allows a therapist to link an existing client account without duplicate collision", async () => {
      // 1. Client account already exists under a prior clinician or self-signup
      const initialClientReq = new NextRequest("http://localhost:3000/api/therapist/clients", {
        method: "POST",
        body: JSON.stringify({
          name: "Existing Client User",
          age: 34,
          gender: "Non-binary",
          condition: "Post-stroke fine motor",
          email: "existing.client@platform.local",
          therapistId: "original-therapist-id",
        }),
      });
      const initialRes = await createClient(initialClientReq);
      expect(initialRes.status).toBe(201);

      // 2. Another therapist adds this existing client by email to link them
      const linkExistingReq = new NextRequest("http://localhost:3000/api/therapist/clients", {
        method: "POST",
        body: JSON.stringify({
          name: "Existing Client User",
          age: 34,
          gender: "Non-binary",
          condition: "Post-stroke fine motor",
          email: "existing.client@platform.local",
          therapistId: DEMO_THERAPIST_ID,
        }),
      });

      const linkRes = await createClient(linkExistingReq);
      expect(linkRes.status).toBe(200);
      const linkData = await linkRes.json();
      expect(linkData.credentials.isNewUser).toBe(false);
      expect(linkData.client.therapist_id).toBe(DEMO_THERAPIST_ID);
      expect(linkData.client.previous_therapist_id).toBe("original-therapist-id");
      expect(linkData.client.invitation_status).toBe("pending");
    });
  });

  describe("7. Care Transfer Service", () => {
    it("successfully transfers client care to colleague with handover notes", async () => {
      // Seed the colleague therapist profile the transfer targets
      const admin = createAdminClient()!;
      await admin.from("profiles").upsert({
        id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
        role: "therapist",
        display_name: "Colleague Clinician",
        email: "colleague.therapist@aruga.com",
      });
      // 1. Create a client
      const createReq = new NextRequest("http://localhost:3000/api/therapist/clients", {
        method: "POST",
        body: JSON.stringify({
          name: "Carlos Dela Cruz",
          age: 45,
          gender: "Male",
          condition: "Carpal Tunnel Rehabilitation",
          email: "carlos.delacruz@example.com",
          therapistId: DEMO_THERAPIST_ID,
        }),
      });
      const createRes = await createClient(createReq);
      expect(createRes.status).toBe(201);
      const client = (await createRes.json()).client;

      // 2. Transfer care to colleague clinician
      const transferReq = new NextRequest("http://localhost:3000/api/therapist/clients/transfer", {
        method: "POST",
        body: JSON.stringify({
          patientId: client.id,
          targetTherapistEmail: "colleague.therapist@aruga.com",
          handoverNotes: "Progressing well with nerve gliding exercises. Recommended 3x weekly focus.",
          originatingTherapistId: DEMO_THERAPIST_ID,
        }),
      });

      const transferRes = await transferCare(transferReq);
      expect(transferRes.status).toBe(200);
      const transferData = await transferRes.json();
      expect(transferData.success).toBe(true);
      expect(transferData.patient.previous_therapist_id).toBe(DEMO_THERAPIST_ID);
      expect(transferData.patient.handover_notes).toBe(
        "Progressing well with nerve gliding exercises. Recommended 3x weekly focus."
      );
      expect(transferData.transferredTo.email).toBe("colleague.therapist@aruga.com");
    });

    it("rejects transfer with invalid target email", async () => {
      const transferReq = new NextRequest("http://localhost:3000/api/therapist/clients/transfer", {
        method: "POST",
        body: JSON.stringify({
          patientId: "nonexistent",
          targetTherapistEmail: "not-an-email",
        }),
      });

      const res = await transferCare(transferReq);
      expect(res.status).toBe(400);
    });

    it("returns 404 when transferring non-existent client", async () => {
      const transferReq = new NextRequest("http://localhost:3000/api/therapist/clients/transfer", {
        method: "POST",
        body: JSON.stringify({
          patientId: "patient-unknown-999",
          targetTherapistEmail: "valid.doc@aruga.com",
          originatingTherapistId: DEMO_THERAPIST_ID,
        }),
      });

      const res = await transferCare(transferReq);
      expect(res.status).toBe(404);
    });
  });

  // 9. IN-APP NOTIFICATIONS & TWO-WAY LINK APPROVAL
  describe("In-App Notifications and Connection Approvals", () => {
    it("notifies therapist in-app when client asks to link, and therapist can approve in-app", async () => {
      // 1. Client asks to link to therapist
      const linkReq = new NextRequest("http://localhost:3000/api/client/therapist-link", {
        method: "POST",
        body: JSON.stringify({
          clientUserId: "client-requesting-123",
          therapistEmail: "dr.elena.ramos@aruga.local",
        }),
      });
      const linkRes = await postTherapistLink(linkReq);
      expect(linkRes.status).toBe(200);
      const linkData = await linkRes.json();
      expect(linkData.invitation_status).toBe("pending");
      expect(linkData.invitation_initiated_by).toBe("client");

      // 2. Therapist checks in-app notifications
      const notifReq = new NextRequest(
        `http://localhost:3000/api/notifications?role=therapist&userId=${DEMO_THERAPIST_ID}`
      );
      const notifRes = await getNotifications(notifReq);
      expect(notifRes.status).toBe(200);
      const notifData = await notifRes.json();

      expect(notifData.unreadCount).toBeGreaterThanOrEqual(1);
      const clientRequestNotif = notifData.notifications.find(
        (n: any) => n.type === "client_link_request" && n.initiatedBy === "client"
      );
      expect(clientRequestNotif).toBeDefined();
      expect(clientRequestNotif.actionRequired).toBe(true);

      // 3. Therapist approves the connection in-app
      const approveReq = new NextRequest("http://localhost:3000/api/notifications", {
        method: "POST",
        body: JSON.stringify({
          patientId: clientRequestNotif.patientId,
          action: "approve",
          role: "therapist",
          userId: DEMO_THERAPIST_ID,
        }),
      });
      const approveRes = await postNotifications(approveReq);
      expect(approveRes.status).toBe(200);
      const approveData = await approveRes.json();
      expect(approveData.success).toBe(true);
      expect(approveData.status).toBe("accepted");

      // 4. Verify that notifications reflect accepted status (no action required)
      const afterRes = await getNotifications(notifReq);
      const afterData = await afterRes.json();
      const stillPending = afterData.notifications.find(
        (n: any) => n.patientId === clientRequestNotif.patientId && n.actionRequired
      );
      expect(stillPending).toBeUndefined();
    });

    it("notifies client in-app when therapist links client, and client can approve in-app", async () => {
      // 1. Therapist creates a client without auto-confirm
      const addReq = new NextRequest("http://localhost:3000/api/therapist/clients", {
        method: "POST",
        body: JSON.stringify({
          name: "Chloe Miller",
          age: 26,
          gender: "Female",
          condition: "Carpal Tunnel Syndrome",
          email: "chloe.miller@test.local",
          therapistId: DEMO_THERAPIST_ID,
          autoConfirm: false,
        }),
      });
      const addRes = await createClient(addReq);
      expect(addRes.status).toBe(201);
      const addData = await addRes.json();
      expect(addData.client.invitation_status).toBe("pending");
      expect(addData.client.invitation_initiated_by).toBe("therapist");

      // 2. Client checks in-app notifications
      const notifReq = new NextRequest(
        `http://localhost:3000/api/notifications?role=client&userId=${addData.client.client_user_id}`
      );
      const notifRes = await getNotifications(notifReq);
      expect(notifRes.status).toBe(200);
      const notifData = await notifRes.json();

      expect(notifData.unreadCount).toBeGreaterThanOrEqual(1);
      const inviteNotif = notifData.notifications.find(
        (n: any) => n.patientId === addData.client.id
      );
      expect(inviteNotif).toBeDefined();
      expect(inviteNotif.actionRequired).toBe(true);
      expect(inviteNotif.type).toBe("therapist_invitation");

      // 3. Client approves the invitation in-app
      const acceptReq = new NextRequest("http://localhost:3000/api/notifications", {
        method: "POST",
        body: JSON.stringify({
          patientId: addData.client.id,
          action: "accept",
          role: "client",
          userId: addData.client.client_user_id,
        }),
      });
      const acceptRes = await postNotifications(acceptReq);
      expect(acceptRes.status).toBe(200);
      const acceptData = await acceptRes.json();
      expect(acceptData.success).toBe(true);
      expect(acceptData.status).toBe("accepted");
    });

    it("allows declining a connection request in-app", async () => {
      // 1. Client asks to link
      const linkReq = new NextRequest("http://localhost:3000/api/client/therapist-link", {
        method: "POST",
        body: JSON.stringify({
          clientUserId: "client-to-decline-456",
          therapistEmail: "dr.elena.ramos@aruga.local",
        }),
      });
      const linkRes = await postTherapistLink(linkReq);
      const linkData = await linkRes.json();

      // 2. Therapist declines in-app
      const declineReq = new NextRequest("http://localhost:3000/api/notifications", {
        method: "POST",
        body: JSON.stringify({
          patientId: linkData.patient.id,
          action: "decline",
          role: "therapist",
        }),
      });
      const declineRes = await postNotifications(declineReq);
      expect(declineRes.status).toBe(200);
      const declineData = await declineRes.json();
      expect(declineData.success).toBe(true);
      expect(declineData.status).toBe("declined");
    });

    it("returns a friendly error message when therapist is not found during client linking", async () => {
      const linkReq = new NextRequest("http://localhost:3000/api/client/therapist-link", {
        method: "POST",
        body: JSON.stringify({
          clientUserId: "real-client-123",
          therapistEmail: "nonexistent.therapist@randomclinic.com",
        }),
      });
      const linkRes = await postTherapistLink(linkReq);
      expect(linkRes.status).toBe(404);
      const linkData = await linkRes.json();
      expect(linkData.error).toContain("We couldn't find an occupational therapist registered with");
      expect(linkData.error).toContain("nonexistent.therapist@randomclinic.com");
      expect(linkData.error).toContain("check for typos or ask your therapist");
    });

    it("returns a friendly error message when client is not found in caseload during transfer", async () => {
      const transferReq = new NextRequest("http://localhost:3000/api/therapist/clients/transfer", {
        method: "POST",
        body: JSON.stringify({
          patientId: "nonexistent-patient-999",
          targetTherapistEmail: "colleague@aruga.local",
          originatingTherapistId: DEMO_THERAPIST_ID,
        }),
      });
      const res = await transferCare(transferReq);
      expect(res.status).toBe(404);
      const data = await res.json();
      expect(data.error).toContain("We couldn't find this client record in your caseload");
    });

    it("returns a friendly error message when connection request is not found in notifications", async () => {
      const notifReq = new NextRequest("http://localhost:3000/api/notifications", {
        method: "POST",
        body: JSON.stringify({
          patientId: "nonexistent-notif-patient",
          action: "approve",
          role: "therapist",
        }),
      });
      const res = await postNotifications(notifReq);
      expect(res.status).toBe(404);
      const data = await res.json();
      expect(data.error).toContain("We couldn't find this care connection request");
    });

    it("allows client to cancel their pending request via DELETE and resets status to unlinked", async () => {
      const clientId = "client-cancelling-789";

      // 1. Client requests link to therapist
      const linkReq = new NextRequest("http://localhost:3000/api/client/therapist-link", {
        method: "POST",
        body: JSON.stringify({
          clientUserId: clientId,
          therapistEmail: "dr.elena.ramos@aruga.local",
        }),
      });
      const linkRes = await postTherapistLink(linkReq);
      expect(linkRes.status).toBe(200);
      const linkData = await linkRes.json();
      expect(linkData.invitation_status).toBe("pending");

      // 2. Client checks their pending status
      const getReq = new NextRequest(`http://localhost:3000/api/client/therapist-link?clientUserId=${clientId}`);
      const getRes = await getTherapistLink(getReq);
      expect(getRes.status).toBe(200);
      const getData = await getRes.json();
      expect(getData.invitation_status).toBe("pending");
      expect(getData.linked).toBe(false);

      // 3. Client cancels their pending link request
      const cancelReq = new NextRequest(`http://localhost:3000/api/client/therapist-link?clientUserId=${clientId}`, {
        method: "DELETE",
      });
      const cancelRes = await deleteTherapistLink(cancelReq);
      expect(cancelRes.status).toBe(200);
      const cancelData = await cancelRes.json();
      expect(cancelData.success).toBe(true);

      // 4. Client verifies they are now unlinked
      const getAfterReq = new NextRequest(`http://localhost:3000/api/client/therapist-link?clientUserId=${clientId}`);
      const getAfterRes = await getTherapistLink(getAfterReq);
      const getAfterData = await getAfterRes.json();
      expect(getAfterData.invitation_status).toBe("unlinked");
      expect(getAfterData.linked).toBe(false);
    });

    it("ensures therapist can view pending client requests in caseload GET query", async () => {
      const testClientId = "client-caseload-visibility-test";

      // Client requests link
      const linkReq = new NextRequest("http://localhost:3000/api/client/therapist-link", {
        method: "POST",
        body: JSON.stringify({
          clientUserId: testClientId,
          therapistEmail: "dr.elena.ramos@aruga.local",
        }),
      });
      await postTherapistLink(linkReq);

      // Therapist fetches caseload
      const caseloadReq = new NextRequest(
        `http://localhost:3000/api/therapist/clients?therapistId=${DEMO_THERAPIST_ID}`
      );
      const caseloadRes = await getClients(caseloadReq);
      expect(caseloadRes.status).toBe(200);
      const caseloadData = await caseloadRes.json();

      const pendingClient = caseloadData.clients.find(
        (c: any) => c.client_user_id === testClientId
      );
      expect(pendingClient).toBeDefined();
      expect(pendingClient.invitation_status).toBe("pending");
      expect(pendingClient.therapist_id).toBe(DEMO_THERAPIST_ID);
    });

    it("allows therapist to link client by email address via POST /api/therapist/client-link", async () => {
      const clientEmail = "pediatric.sarah@aruga.local";

      // 1. Therapist initiates link to client by email
      const linkReq = new NextRequest("http://localhost:3000/api/therapist/client-link", {
        method: "POST",
        body: JSON.stringify({
          clientEmail,
          therapistId: DEMO_THERAPIST_ID,
          condition: "Bilateral fine motor development",
        }),
      });
      const linkRes = await therapistLinkClient(linkReq);
      expect(linkRes.status).toBe(200);
      const linkData = await linkRes.json();
      expect(linkData.success).toBe(true);
      expect(linkData.invitation_status).toBe("pending");
      expect(linkData.invitation_initiated_by).toBe("therapist");

      // 2. Duplicate link request handles gracefully
      const dupReq = new NextRequest("http://localhost:3000/api/therapist/client-link", {
        method: "POST",
        body: JSON.stringify({
          clientEmail,
          therapistId: DEMO_THERAPIST_ID,
        }),
      });
      const dupRes = await therapistLinkClient(dupReq);
      expect(dupRes.status).toBe(200);
      const dupData = await dupRes.json();
      expect(dupData.alreadyPending).toBe(true);

      // 3. Client accepts therapist invitation
      const acceptReq = new NextRequest("http://localhost:3000/api/client/therapist-link", {
        method: "PATCH",
        body: JSON.stringify({
          clientUserId: DEMO_CLIENT_ID,
          action: "accept",
        }),
      });
      const acceptRes = await patchTherapistLink(acceptReq);
      expect(acceptRes.status).toBe(200);
      const acceptData = await acceptRes.json();
      expect(acceptData.success).toBe(true);
      expect(acceptData.invitation_status).toBe("accepted");
    });

    it("allows therapist to link client by email via POST /api/therapist/clients (action: link_by_email)", async () => {
      const clientEmail = "adult.gabriel@aruga.local";

      const req = new NextRequest("http://localhost:3000/api/therapist/clients", {
        method: "POST",
        body: JSON.stringify({
          action: "link_by_email",
          clientEmail,
          therapistId: DEMO_THERAPIST_ID,
          condition: "Post-stroke finger extension routine",
        }),
      });
      const res = await createClient(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.invitation_status).toBe("pending");
      expect(data.invitation_initiated_by).toBe("therapist");
    });
  });

  describe("9. Live Session SOAP Notes, Home Program Feedback, and Database-Cached Plain-English Summaries", () => {
    it("allows therapist to create multiple SOAP notes divided into 4 textarea boxes + client summary per patient", async () => {
      // Create Note #1
      const req1 = new NextRequest("http://localhost:3000/api/therapist/soap-notes", {
        method: "POST",
        body: JSON.stringify({
          patientId: DEMO_PATIENT_ID,
          therapistId: DEMO_THERAPIST_ID,
          sessionDate: "2026-10-29",
          sessionTitle: "Live Session #5: Bilateral Dynamic Reach",
          subjective: "Client reports minimal fatigue (2/10). Reached overhead cabinet without shoulder compensation.",
          objective: "Active shoulder flexion 115°. Completed 12 cup transfers with cylindrical grasp.",
          assessment: "Excellent motor recovery. Proximal stability allows fluid distal release.",
          plan: "Progress to weighted 1lb resistance. Review next video submission Friday.",
          clientSummary: "Marcus, fantastic control reaching overhead today! Your cup lifts were super steady without leaning your body. Keep practicing with your elbow supported.",
        }),
      });
      const res1 = await postTherapistSoapNotes(req1);
      expect(res1.status).toBe(201);
      const data1 = await res1.json();
      expect(data1.soapNote).toBeDefined();
      expect(data1.soapNote.subjective).toContain("minimal fatigue");
      expect(data1.soapNote.objective).toContain("115°");
      expect(data1.soapNote.assessment).toContain("motor recovery");
      expect(data1.soapNote.plan).toContain("weighted 1lb");
      expect(data1.soapNote.client_summary).toContain("fantastic control");

      // Create Note #2 on same patient
      const req2 = new NextRequest("http://localhost:3000/api/therapist/soap-notes", {
        method: "POST",
        body: JSON.stringify({
          patientId: DEMO_PATIENT_ID,
          therapistId: DEMO_THERAPIST_ID,
          sessionDate: "2026-10-31",
          sessionTitle: "Live Session #6: Complex Tabletop Transfer",
          subjective: "Client reports cooking breakfast with minimal hand trembling.",
          objective: "Pinch grip force measured at 8 lbs. 10/10 block transfers completed.",
          assessment: "Functional independence achieved for light meal preparation.",
          plan: "Maintain current maintenance routine 3x per week.",
          clientSummary: "You cooked breakfast today with great stability! Your pinch strength is up to 8 lbs. Continue your 3x weekly exercises.",
        }),
      });
      const res2 = await postTherapistSoapNotes(req2);
      expect(res2.status).toBe(201);
      const data2 = await res2.json();
      expect(data2.soapNote.session_title).toContain("Session #6");

      // Verify therapist can fetch all notes for this patient
      const getReq = new NextRequest(`http://localhost:3000/api/therapist/soap-notes?patientId=${DEMO_PATIENT_ID}&requesterId=${DEMO_THERAPIST_ID}&isDemo=true`);
      const getRes = await getTherapistSoapNotes(getReq);
      expect(getRes.status).toBe(200);
      const getData = await getRes.json();
      expect(getData.soapNotes.length).toBeGreaterThanOrEqual(2);
      const note5 = getData.soapNotes.find((n: any) => n.id === data1.soapNote.id);
      expect(note5).toBeDefined();
      expect(note5.subjective).toContain("minimal fatigue");
    });

    it("allows therapist to update (PATCH) and delete (DELETE) a SOAP note", async () => {
      // 1. Create note
      const createReq = new NextRequest("http://localhost:3000/api/therapist/soap-notes", {
        method: "POST",
        body: JSON.stringify({
          patientId: DEMO_PATIENT_ID,
          therapistId: DEMO_THERAPIST_ID,
          sessionDate: "2026-10-30",
          sessionTitle: "Temporary Session Note",
          subjective: "Temporary S",
          objective: "Temporary O",
          assessment: "Temporary A",
          plan: "Temporary P",
          clientSummary: "Temporary summary",
        }),
      });
      const createRes = await postTherapistSoapNotes(createReq);
      const createData = await createRes.json();
      const noteId = createData.soapNote.id;

      // 2. Edit note (PATCH)
      const patchReq = new NextRequest("http://localhost:3000/api/therapist/soap-notes", {
        method: "PATCH",
        body: JSON.stringify({
          id: noteId,
          therapistId: DEMO_THERAPIST_ID,
          sessionTitle: "Updated Session Note",
          objective: "Updated O with 45° angle",
          clientSummary: "Updated friendly summary for client",
        }),
      });
      const patchRes = await patchTherapistSoapNotes(patchReq);
      expect(patchRes.status).toBe(200);
      const patchData = await patchRes.json();
      expect(patchData.soapNote.session_title).toBe("Updated Session Note");
      expect(patchData.soapNote.objective).toBe("Updated O with 45° angle");
      expect(patchData.soapNote.client_summary).toBe("Updated friendly summary for client");

      // 3. Delete note (DELETE)
      const delReq = new NextRequest(`http://localhost:3000/api/therapist/soap-notes?id=${noteId}&requesterId=${DEMO_THERAPIST_ID}`, {
        method: "DELETE",
      });
      const delRes = await deleteTherapistSoapNotes(delReq);
      expect(delRes.status).toBe(200);
      const delData = await delRes.json();
      expect(delData.success).toBe(true);

      // Verify it is gone
      const checkReq = new NextRequest(`http://localhost:3000/api/therapist/soap-notes?id=${noteId}&requesterId=${DEMO_THERAPIST_ID}&isDemo=true`);
      const checkRes = await getTherapistSoapNotes(checkReq);
      const checkData = await checkRes.json();
      expect(checkData.soapNotes.length).toBe(0);
    });

    it("allows client to fetch live session SOAP notes and see 4 boxes and plain-English summary", async () => {
      const clientReq = new NextRequest(
        `http://localhost:3000/api/client/soap-notes?clientUserId=${DEMO_CLIENT_ID}&patientId=${DEMO_PATIENT_ID}&isDemo=true`
      );
      const clientRes = await getClientSoapNotes(clientReq);
      expect(clientRes.status).toBe(200);
      const clientData = await clientRes.json();
      expect(clientData.soapNotes).toBeDefined();
      expect(clientData.soapNotes.length).toBeGreaterThanOrEqual(1);

      const firstNote = clientData.soapNotes[0];
      expect(firstNote.subjective).toBeTruthy();
      expect(firstNote.objective).toBeTruthy();
      expect(firstNote.assessment).toBeTruthy();
      expect(firstNote.plan).toBeTruthy();
      expect(firstNote.client_summary).toBeTruthy();
    });

    it("creates and updates SOAP note with session recording URL and multiple assessment document links", async () => {
      // 1. Create with recording URL and multiple assessment document links
      const createReq = new NextRequest("http://localhost:3000/api/therapist/soap-notes", {
        method: "POST",
        body: JSON.stringify({
          patientId: DEMO_PATIENT_ID,
          therapistId: DEMO_THERAPIST_ID,
          sessionDate: "2026-10-31",
          sessionTitle: "Evaluation & Standardized Assessment Session",
          sessionRecordingUrl: "https://meet.google.com/rec/eval-session-123",
          subjective: "Patient ready for formal evaluation.",
          objective: "Fugl-Meyer score 48/66.",
          assessment: "Substantial motor recovery observed.",
          assessmentLinks: [
            { title: "Fugl-Meyer UE Motor Assessment (PDF)", url: "https://clinic.org/fm-score.pdf" },
            { title: "Goniometry ROM Evaluation Log", url: "https://clinic.org/goniometry.pdf" },
          ],
          plan: "Maintain current progression.",
          clientSummary: "Great session today! Your assessment showed clear improvement in wrist extension.",
        }),
      });
      const createRes = await postTherapistSoapNotes(createReq);
      expect(createRes.status).toBe(201);
      const createData = await createRes.json();
      expect(createData.soapNote.session_recording_url).toBe("https://meet.google.com/rec/eval-session-123");
      expect(createData.soapNote.assessment_links.length).toBe(2);
      expect(createData.soapNote.assessment_links[0].title).toBe("Fugl-Meyer UE Motor Assessment (PDF)");

      // 2. Update with modified assessment links and recording URL
      const patchReq = new NextRequest("http://localhost:3000/api/therapist/soap-notes", {
        method: "PATCH",
        body: JSON.stringify({
          id: createData.soapNote.id,
          therapistId: DEMO_THERAPIST_ID,
          sessionRecordingUrl: "https://meet.google.com/rec/eval-session-123-updated",
          assessmentLinks: [
            { title: "Updated Fugl-Meyer Scorecard", url: "https://clinic.org/fm-score-v2.pdf" },
          ],
        }),
      });
      const patchRes = await patchTherapistSoapNotes(patchReq);
      expect(patchRes.status).toBe(200);
      const patchData = await patchRes.json();
      expect(patchData.soapNote.session_recording_url).toBe("https://meet.google.com/rec/eval-session-123-updated");
      expect(patchData.soapNote.assessment_links.length).toBe(1);
      expect(patchData.soapNote.assessment_links[0].title).toBe("Updated Fugl-Meyer Scorecard");
    });

    it("allows therapist to review home program submission with 4 SOAP boxes and client summary", async () => {
      const reviewReq = new NextRequest("http://localhost:3000/api/therapist/reviews", {
        method: "POST",
        body: JSON.stringify({
          submissionId: DEMO_SUBMISSION_ID,
          therapistId: DEMO_THERAPIST_ID,
          action: "publish",
          subjective: "Patient performed routine with high motivation.",
          objective: "Completed 3/3 exercise steps. 0 trunk compensation.",
          assessment: "Distal finger dexterity is advancing ahead of schedule.",
          plan: "Keep up daily practice. Next evaluation in 1 week.",
          clientSummary: "You did wonderful today! Your finger dexterity is improving every single day. Keep up the great practice!",
        }),
      });
      const reviewRes = await postReviews(reviewReq);
      expect(reviewRes.status).toBe(200);
      const reviewData = await reviewRes.json();
      expect(reviewData.review.subjective).toBe("Patient performed routine with high motivation.");
      expect(reviewData.review.objective).toBe("Completed 3/3 exercise steps. 0 trunk compensation.");
      expect(reviewData.review.assessment).toBe("Distal finger dexterity is advancing ahead of schedule.");
      expect(reviewData.review.plan).toBe("Keep up daily practice. Next evaluation in 1 week.");
      expect(reviewData.review.client_summary).toBe(
        "You did wonderful today! Your finger dexterity is improving every single day. Keep up the great practice!"
      );

      // Verify client submissions query returns the SOAP fields
      const subReq = new NextRequest(
        `http://localhost:3000/api/client/submissions?submissionId=${DEMO_SUBMISSION_ID}`
      );
      const subRes = await getSubmissions(subReq);
      expect(subRes.status).toBe(200);
      const subData = await subRes.json();
      expect(subData.submission.review.subjective).toBe("Patient performed routine with high motivation.");
      expect(subData.submission.review.client_summary).toContain("finger dexterity");
    });

    it("supports 'See Summary' on-demand button and database caching so AI credits are not recharged", async () => {
      // 1. When summary already exists in DB, POST /api/ai/soap-summary returns cached summary without AI call
      const existingReq = new NextRequest("http://localhost:3000/api/ai/soap-summary", {
        method: "POST",
        body: JSON.stringify({
          targetType: "soap_note",
          targetId: "soap-marcus-01",
          forceRegenerate: false,
        }),
      });
      const existingRes = await postSoapSummary(existingReq);
      expect(existingRes.status).toBe(200);
      const existingData = await existingRes.json();
      expect(existingData.cached).toBe(true);
      expect(existingData.source).toBe("database_cache");
      expect(existingData.summary).toContain("Marcus");

      // 2. GET /api/ai/soap-summary returns the cached summary
      const getCachedReq = new NextRequest(
        "http://localhost:3000/api/ai/soap-summary?targetType=soap_note&targetId=soap-marcus-01"
      );
      const getCachedRes = await getSoapSummary(getCachedReq);
      expect(getCachedRes.status).toBe(200);
      const getCachedData = await getCachedRes.json();
      expect(getCachedData.cached).toBe(true);
      expect(getCachedData.summary).toBe(existingData.summary);

      // 3. When summary is not yet generated, it synthesizes plain English and caches it into the DB
      // Create a new note without summary
      const newNoteReq = new NextRequest("http://localhost:3000/api/therapist/soap-notes", {
        method: "POST",
        body: JSON.stringify({
          patientId: DEMO_PATIENT_ID,
          therapistId: DEMO_THERAPIST_ID,
          sessionDate: "2026-10-31",
          sessionTitle: "Session Needing AI Summary",
          subjective: "Client reports resting shoulder when fatigue reached 4/10.",
          objective: "Completed 10 cup lifts with cylindrical grasp and neutral wrist alignment.",
          assessment: "Great functional progress in distal grip strength.",
          plan: "Keep chair close to table and practice daily.",
          clientSummary: "", // deliberately empty
        }),
      });
      const newNoteRes = await postTherapistSoapNotes(newNoteReq);
      const newNoteData = await newNoteRes.json();
      const newNoteId = newNoteData.soapNote.id;

      // Call AI soap-summary to generate and cache
      const genReq = new NextRequest("http://localhost:3000/api/ai/soap-summary", {
        method: "POST",
        body: JSON.stringify({
          targetType: "soap_note",
          targetId: newNoteId,
          subjective: "Client reports resting shoulder when fatigue reached 4/10.",
          objective: "Completed 10 cup lifts with cylindrical grasp and neutral wrist alignment.",
          assessment: "Great functional progress in distal grip strength.",
          plan: "Keep chair close to table and practice daily.",
          clientName: "Marcus Vance",
        }),
      });
      const genRes = await postSoapSummary(genReq);
      expect(genRes.status).toBe(200);
      const genData = await genRes.json();
      expect(genData.newlyGenerated).toBe(true);
      expect(genData.summary).toBeTruthy();

      // Subsequent call to See Summary hits database cache immediately (cached: true, 0 AI credits!)
      const subsequentReq = new NextRequest("http://localhost:3000/api/ai/soap-summary", {
        method: "POST",
        body: JSON.stringify({
          targetType: "soap_note",
          targetId: newNoteId,
          forceRegenerate: false,
        }),
      });
      const subsequentRes = await postSoapSummary(subsequentReq);
      expect(subsequentRes.status).toBe(200);
      const subsequentData = await subsequentRes.json();
      expect(subsequentData.cached).toBe(true);
      expect(subsequentData.source).toBe("database_cache");
      expect(subsequentData.summary).toBe(genData.summary);
    });
  });
});


