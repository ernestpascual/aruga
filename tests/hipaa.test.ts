import { describe, it, expect, beforeEach } from "vitest";
import { deidentifyClinicalText, anonymizePatientName } from "@/lib/hipaa/de-identify";
import { logAuditEvent } from "@/lib/hipaa/audit";
import { getMockStore } from "@/lib/supabase/mock-store";

describe("HIPAA Compliance Safeguards", () => {
  beforeEach(() => {
    const store = getMockStore();
    store.auditEvents = [];
  });

  describe("Safe Harbor ePHI De-identification (§ 164.514(b))", () => {
    it("anonymizes specific patient names with consistent handles", () => {
      const handle = anonymizePatientName("Eleanor Vance");
      expect(handle).toBe("Client");
      expect(anonymizePatientName("")).toBe("Client");
    });

    it("strips direct identifiers: SSNs, emails, and phone numbers from clinical text", () => {
      const input = "Client John Vance (SSN: 123-45-6789, email: j.vance@example.com, phone: 555-123-4567) completed grasping tasks.";
      const deidentified = deidentifyClinicalText(input, "John Vance");

      expect(deidentified).not.toContain("123-45-6789");
      expect(deidentified).not.toContain("j.vance@example.com");
      expect(deidentified).not.toContain("555-123-4567");
      expect(deidentified).not.toContain("John Vance");
      expect(deidentified).toContain("[REDACTED_SSN]");
      expect(deidentified).toContain("[REDACTED_EMAIL]");
      expect(deidentified).toContain("[REDACTED_PHONE]");
      expect(deidentified).toContain("Client");
    });
  });

  describe("Central Audit Logging (§ 164.312(b))", () => {
    it("successfully creates and stores audit events in the mock store", async () => {
      const event = await logAuditEvent({
        actorId: "therapist-1",
        userRole: "therapist",
        action: "EPHI_READ",
        affectedResource: "soap_notes",
        resourceId: "soap-101",
        patientId: "patient-202",
        details: { count: 1 },
      });

      expect(event).toBeDefined();
      expect(event?.action).toBe("EPHI_READ");
      expect(event?.affected_resource).toBe("soap_notes");
      expect(event?.resource_id).toBe("soap-101");

      const store = getMockStore();
      expect(store.auditEvents).toHaveLength(1);
      expect(store.auditEvents[0].actor_id).toBe("therapist-1");
      expect(store.auditEvents[0].metadata.patientId).toBe("patient-202");
    });

    it("logs ePHI AI synthesis dispatches with stripped telemetry", async () => {
      await logAuditEvent({
        actorId: "therapist-1",
        action: "EPHI_AI_SYNTHESIS",
        affectedResource: "soap_notes",
        patientId: "patient-555",
        details: { model: "gemini-2.5-flash", deidentified: true },
      });

      const store = getMockStore();
      const aiEvent = store.auditEvents.find((e) => e.action === "EPHI_AI_SYNTHESIS");
      expect(aiEvent).toBeDefined();
      expect(aiEvent?.metadata.deidentified).toBe(true);
    });
  });
});
