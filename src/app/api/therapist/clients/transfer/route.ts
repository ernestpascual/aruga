import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { getMockStore, DEMO_THERAPIST_ID } from "@/lib/supabase/mock-store";
import { logAuditEvent } from "@/lib/hipaa/audit";
import { z } from "zod";

const TransferCareSchema = z.object({
  patientId: z.string().min(1),
  targetTherapistEmail: z.string().email(),
  handoverNotes: z.string().optional().nullable(),
  originatingTherapistId: z.string().optional().nullable(),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const validation = TransferCareSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.issues.map((i) => i.message).join(", ") },
        { status: 400 }
      );
    }

    const { patientId, targetTherapistEmail, handoverNotes } = validation.data;
    const normalizedTargetEmail = targetTherapistEmail.toLowerCase().trim();

    // Resolve originating therapist ID
    let currentTherapistId = validation.data.originatingTherapistId || null;
    if (!currentTherapistId) {
      try {
        const serverClient = await createServerClient();
        if (serverClient) {
          const {
            data: { user },
          } = await serverClient.auth.getUser();
          if (user?.id) currentTherapistId = user.id;
        }
      } catch {
        // fallback
      }
    }
    if (!currentTherapistId) {
      currentTherapistId = DEMO_THERAPIST_ID;
    }

    const admin = createAdminClient();

    if (admin) {
      // 1. Verify patient exists
      const { data: patient, error: patientError } = await admin
        .from("patients")
        .select("*")
        .eq("id", patientId)
        .maybeSingle();

      if (patientError || !patient) {
        return NextResponse.json(
          { error: "We couldn't find this client record in your caseload. Please refresh your patient list and try again." },
          { status: 404 }
        );
      }

      // 2. Find target therapist
      const { data: usersList } = await admin.auth.admin.listUsers();
      const targetUser =
        usersList?.users?.find(
          (u) =>
            u.email?.toLowerCase() === normalizedTargetEmail &&
            (u.user_metadata?.role === "therapist" || !u.user_metadata?.role)
        ) || usersList?.users?.find((u) => u.email?.toLowerCase() === normalizedTargetEmail);

      let targetTherapistId: string | null = null;
      let targetTherapistName = "Colleague Clinician";

      if (targetUser) {
        targetTherapistId = targetUser.id;
        const { data: prof } = await admin
          .from("profiles")
          .select("display_name")
          .eq("id", targetTherapistId)
          .maybeSingle();
        if (prof?.display_name) targetTherapistName = prof.display_name;
      } else {
        const { data: profByEmail } = await admin
          .from("profiles")
          .select("id, display_name")
          .eq("role", "therapist")
          .ilike("email", normalizedTargetEmail)
          .maybeSingle();

        if (profByEmail) {
          targetTherapistId = profByEmail.id;
          targetTherapistName = profByEmail.display_name || "Colleague Clinician";
        } else {
          return NextResponse.json(
            {
              error: `We couldn't find an occupational therapist registered with "${normalizedTargetEmail}". Please verify the email address with your colleague so they can receive this patient transfer.`,
            },
            { status: 404 }
          );
        }
      }

      if (targetTherapistId === patient.therapist_id) {
        return NextResponse.json(
          { error: "Client is already assigned to this clinician." },
          { status: 400 }
        );
      }

      // Ensure target therapist profile exists
      await admin.from("profiles").upsert({
        id: targetTherapistId,
        role: "therapist",
        display_name: targetTherapistName,
      });

      // 3. Update patient to new therapist with handover audit
      const { data: updatedPatient, error: updateError } = await admin
        .from("patients")
        .update({
          previous_therapist_id: patient.therapist_id || currentTherapistId,
          therapist_id: targetTherapistId,
          handover_notes: handoverNotes ? handoverNotes.trim() : null,
          invitation_status: "pending",
          invitation_initiated_by: "therapist",
          updated_at: new Date().toISOString(),
        })
        .eq("id", patientId)
        .select()
        .single();

      if (updateError) {
        return NextResponse.json({ error: updateError.message }, { status: 500 });
      }

      // 4. Update programs creator or retain access
      await admin
        .from("home_programs")
        .update({ creator_id: targetTherapistId })
        .eq("patient_id", patientId);

      // HIPAA Audit Log: Record client handover & transfer of care
      await logAuditEvent({
        userId: currentTherapistId,
        userRole: "therapist",
        action: "EPHI_TRANSFER",
        resourceType: "patients",
        resourceId: patientId,
        patientId,
        details: {
          previousTherapistId: patient.therapist_id,
          targetTherapistId,
          targetTherapistEmail: normalizedTargetEmail,
          hasHandoverNotes: Boolean(handoverNotes),
        },
        ipAddress: req.headers.get("x-forwarded-for") || undefined,
        userAgent: req.headers.get("user-agent") || undefined,
      });

      return NextResponse.json({
        success: true,
        message: `Client care successfully transferred to ${targetTherapistName}.`,
        patient: updatedPatient,
        transferredTo: {
          id: targetTherapistId,
          name: targetTherapistName,
          email: normalizedTargetEmail,
        },
      });
    }

    // Mock store fallback
    const store = getMockStore();
    const patient = store.patients.find((p) => p.id === patientId);
    if (!patient) {
      return NextResponse.json(
        { error: "We couldn't find this client record in your caseload. Please refresh your patient list and try again." },
        { status: 404 }
      );
    }

    const previousId = patient.therapist_id;
    patient.previous_therapist_id = previousId;
    patient.therapist_id = "th-transferred-colleague";
    patient.handover_notes = handoverNotes ? handoverNotes.trim() : null;
    patient.invitation_status = "pending";
    patient.invitation_initiated_by = "therapist";
    patient.updated_at = new Date().toISOString();

    await logAuditEvent({
      userId: currentTherapistId,
      userRole: "therapist",
      action: "EPHI_TRANSFER",
      resourceType: "patients",
      resourceId: patientId,
      patientId,
      details: {
        previousTherapistId: previousId,
        targetTherapistId: "th-transferred-colleague",
        targetTherapistEmail: normalizedTargetEmail,
        hasHandoverNotes: Boolean(handoverNotes),
        mock: true,
      },
      ipAddress: req.headers.get("x-forwarded-for") || undefined,
      userAgent: req.headers.get("user-agent") || undefined,
    });

    return NextResponse.json({
      success: true,
      message: `Client care transferred to colleague (${normalizedTargetEmail}).`,
      patient,
      transferredTo: {
        id: "th-transferred-colleague",
        name: "Colleague Clinician",
        email: normalizedTargetEmail,
      },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
