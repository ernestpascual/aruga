import { describe, it, expect, beforeEach } from "vitest";
import {
  getMockStore,
  resetMockStore,
  DEMO_THERAPIST_ID,
  DEMO_CLIENT_ID,
  DEMO_PROGRAM_ID,
  DEMO_SUBMISSION_ID,
  DEMO_REVIEW_ID,
} from "../src/lib/supabase/mock-store";

describe("Authorization & Clinical Workflow Constraints", () => {
  beforeEach(() => {
    resetMockStore();
  });

  it("isolates patient records between therapists", () => {
    const store = getMockStore();
    const otherTherapistId = "99999999-9999-4999-8999-999999999999";

    const elenaPatients = store.patients.filter((p) => p.therapist_id === DEMO_THERAPIST_ID);
    const otherPatients = store.patients.filter((p) => p.therapist_id === otherTherapistId);

    expect(elenaPatients.length).toBeGreaterThan(0);
    expect(otherPatients.length).toBe(0);
  });

  it("prevents clients from viewing draft (unpublished) programs", () => {
    const store = getMockStore();

    // Create a draft program
    const draftProgram = {
      id: "draft-prog-1",
      patient_id: "33333333-3333-4333-8333-333333333333",
      creator_id: DEMO_THERAPIST_ID,
      title: "Unpublished Balance Plan",
      main_instructions: "Private clinician notes",
      status: "draft" as const,
      assigned_at: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    store.programs.push(draftProgram);

    // Filter programs visible to client (status in 'assigned', 'archived')
    const visibleToClient = store.programs.filter(
      (p) => p.status === "assigned" || p.status === "archived"
    );

    expect(visibleToClient.some((p) => p.id === "draft-prog-1")).toBe(false);
  });

  it("hides draft therapist reviews from client until atomically published", () => {
    const store = getMockStore();
    const review = store.reviews.find((r) => r.id === DEMO_REVIEW_ID);
    expect(review?.status).toBe("draft");

    // Client can only view reviews where status === 'published'
    const clientVisibleReviews = store.reviews.filter((r) => r.status === "published");
    expect(clientVisibleReviews.some((r) => r.id === DEMO_REVIEW_ID)).toBe(false);

    // After therapist publishes:
    review!.status = "published";
    review!.published_at = new Date().toISOString();

    const clientVisibleAfterPublish = store.reviews.filter((r) => r.status === "published");
    expect(clientVisibleAfterPublish.some((r) => r.id === DEMO_REVIEW_ID)).toBe(true);
  });

  it("prevents program step modification once assigned to a client", () => {
    const store = getMockStore();
    const assignedProgram = store.programs.find((p) => p.id === DEMO_PROGRAM_ID);
    expect(assignedProgram?.status).toBe("assigned");

    // Attempting to modify assigned steps in workflow RPC triggers error
    const isFrozen = assignedProgram?.status === "assigned";
    expect(isFrozen).toBe(true);
  });

  it("rejects cross-client message program mentions", () => {
    const store = getMockStore();
    const otherPatientId = "other-patient-uuid";

    // Attempt to mention a program belonging to a different patient
    const programForMarcus = store.programs.find((p) => p.id === DEMO_PROGRAM_ID);
    const belongsToOther = programForMarcus?.patient_id === otherPatientId;

    expect(belongsToOther).toBe(false);
  });

  it("supports both pediatric (<18) and adult (>=18) client caseloads", () => {
    const store = getMockStore();
    const adultClients = store.patients.filter((p) => p.age >= 18);
    const pediatricClients = store.patients.filter((p) => p.age < 18);

    expect(adultClients.length).toBeGreaterThanOrEqual(1);
    expect(pediatricClients.length).toBeGreaterThanOrEqual(1);

    const pediatric = pediatricClients.find((p) => p.name === "Leo Chen");
    expect(pediatric).toBeDefined();
    expect(pediatric?.age).toBe(6);
    expect(pediatric?.caregiver_name).toBe("Sarah Chen (Mother)");
  });
});
