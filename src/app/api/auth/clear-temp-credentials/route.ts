import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

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
    if (!admin) {
      return NextResponse.json({ error: "Service unavailable: database not configured" }, { status: 503 });
    }
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
        temporary_password: null,
        credentials_cleared_at: nowIso,
        updated_at: nowIso,
      };

      if (!patient.first_login_at) {
        updateData.first_login_at = nowIso;
      }

      const isPendingTherapistInvite =
        patient.invitation_status === "pending" &&
        !!patient.therapist_id &&
        (patient.invitation_initiated_by === "therapist" || !patient.invitation_initiated_by || patient.invitation_initiated_by === null);
      const shouldAutoAccept =
        patient.invitation_status === "pending" && !!patient.therapist_id;
      if (shouldAutoAccept || isPendingTherapistInvite) {
        updateData.invitation_status = "accepted";
      }

      if (userId && !patient.client_user_id) {
        updateData.client_user_id = userId;
      }

      await admin
        .from("patients")
        .update(updateData)
        .eq("id", patient.id);
    } else if (!patient && userId && normalizedEmail) {
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
