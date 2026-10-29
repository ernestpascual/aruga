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
      // Find matching patient by client_user_id or email
      let query = admin.from("patients").select("id, temporary_password, first_login_at");
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

        await admin
          .from("patients")
          .update(updateData)
          .eq("id", patient.id);
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
