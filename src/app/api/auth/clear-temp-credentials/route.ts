import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getMockStore } from "@/lib/supabase/mock-store";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { userId, email, reason = "first_login" } = body;

    if (!userId && !email) {
      return NextResponse.json(
        { error: "Must provide either userId or email" },
        { status: 400 }
      );
    }

    const normalizedEmail = email ? String(email).toLowerCase().trim() : null;
    const nowIso = new Date().toISOString();
    let wasCleared = false;

    const admin = createAdminClient();
    if (admin) {
      // Find matching patient by client_user_id or email (include linkage columns for auto-accept)
      let query = admin
        .from("patients")
        .select("id, temporary_password, first_login_at, invitation_status, therapist_id, invitation_initiated_by, client_user_id, email");
      if (userId && normalizedEmail) {
        query = query.or(`client_user_id.eq.${userId},email.ilike.${normalizedEmail}`);
      } else if (userId) {
        query = query.eq("client_user_id", userId);
      } else if (normalizedEmail) {
        query = query.ilike("email", normalizedEmail);
      }

      const { data: patient, error: findError } = await query.maybeSingle();

      if (!findError && patient) {
        wasCleared = !!patient.temporary_password;

        const updateData: Record<string, unknown> = {
          temporary_password: null, // Wipe credential permanently from therapist control
          credentials_cleared_at: nowIso,
          updated_at: nowIso,
        };

        if (!patient.first_login_at) {
          updateData.first_login_at = nowIso;
        }

        // Auto-link: therapist-created client (pending) becomes accepted on first login
        const isPendingTherapistInvite =
          patient.invitation_status === "pending" &&
          !!patient.therapist_id &&
          (patient.invitation_initiated_by === "therapist" || !patient.invitation_initiated_by || patient.invitation_initiated_by === null);
        // Also accept any pending with therapist_id on first credential clear (covers invite-before-signup)
        const shouldAutoAccept =
          patient.invitation_status === "pending" && !!patient.therapist_id;
        if (shouldAutoAccept || isPendingTherapistInvite) {
          updateData.invitation_status = "accepted";
        }

        // Self-heal: ensure client_user_id is set to the logging-in user
        if (userId && !patient.client_user_id) {
          updateData.client_user_id = userId;
        }

        await admin
          .from("patients")
          .update(updateData)
          .eq("id", patient.id);
      } else if (!patient && userId && normalizedEmail) {
        // Fallback: patient exists by email but client_user_id not yet linked — heal by email
        const { data: byEmail } = await admin
          .from("patients")
          .select("id, invitation_status, therapist_id, invitation_initiated_by, client_user_id")
          .ilike("email", normalizedEmail)
          .maybeSingle();
        if (byEmail && byEmail.therapist_id) {
          const healUpdate: Record<string, unknown> = {
            client_user_id: userId,
            temporary_password: null,
            credentials_cleared_at: nowIso,
            first_login_at: nowIso,
            updated_at: nowIso,
          };
          if (byEmail.invitation_status === "pending") {
            healUpdate.invitation_status = "accepted";
          }
          await admin.from("patients").update(healUpdate).eq("id", byEmail.id);
        }
      }
    }

    // Also update in mock store for in-memory / demo consistency
    const store = getMockStore();
    const mockPatient = store.patients.find(
      (p) =>
        (userId && p.client_user_id === userId) ||
        (normalizedEmail && p.email.toLowerCase() === normalizedEmail)
    );

    if (mockPatient) {
      wasCleared = wasCleared || !!mockPatient.temporary_password;
      mockPatient.temporary_password = null;
      mockPatient.credentials_cleared_at = nowIso;
      if (!mockPatient.first_login_at) {
        mockPatient.first_login_at = nowIso;
      }
      // Auto-link in mock store as well
      if (mockPatient.invitation_status === "pending" && (mockPatient as any).therapist_id) {
        mockPatient.invitation_status = "accepted";
      }
      if (userId && !(mockPatient as any).client_user_id) {
        (mockPatient as any).client_user_id = userId;
      }
      mockPatient.updated_at = nowIso;
    }

    return NextResponse.json({
      success: true,
      wasCleared,
      clearedAt: nowIso,
      reason,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
