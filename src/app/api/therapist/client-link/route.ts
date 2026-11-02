import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { z } from "zod";

const LinkClientByEmailSchema = z.object({
  clientEmail: z.string().email("Please enter a valid client email address."),
  therapistId: z.string().optional().nullable(),
  condition: z.string().optional().nullable(),
  clientName: z.string().optional().nullable(),
  autoConfirm: z.boolean().optional(),
  notes: z.string().optional().nullable(),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    // Accept either clientEmail or email
    const rawEmail = body.clientEmail || body.email;
    const validation = LinkClientByEmailSchema.safeParse({
      ...body,
      clientEmail: rawEmail,
    });

    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.issues.map((i) => i.message).join(", ") },
        { status: 400 }
      );
    }

    const { clientEmail, condition, clientName, autoConfirm } = validation.data;
    const normalizedEmail = clientEmail.toLowerCase().trim();

    // 1. Resolve therapist ID
    let currentTherapistId = validation.data.therapistId || body.therapistId || null;
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
        // session lookup fallback
      }
    }
    if (!currentTherapistId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const admin = createAdminClient();
    if (!admin) {
      return NextResponse.json({ error: "Database not configured. Run migrations." }, { status: 503 });
    }

    // Fetch therapist info
    let therapistEmail: string | null = null;
    let therapistName = "Your Clinician";
    try {
      const { data: authTherapist } = await admin.auth.admin.getUserById(currentTherapistId);
      therapistEmail = authTherapist?.user?.email?.toLowerCase().trim() || null;
    } catch {
      // ignore
    }

    const { data: therapistProfile } = await admin
      .from("profiles")
      .select("id, display_name, email")
      .eq("id", currentTherapistId)
      .maybeSingle();

    if (therapistProfile) {
      therapistName = therapistProfile.display_name || therapistName;
      therapistEmail = therapistEmail || therapistProfile.email?.toLowerCase().trim() || null;
    } else {
      // Ensure profile exists for FK constraint
      await admin.from("profiles").upsert({
        id: currentTherapistId,
        role: "therapist",
        display_name: "Occupational Therapist",
      });
    }

    // Guard: Cannot link therapist's own email as client
    if (therapistEmail && normalizedEmail === therapistEmail) {
      return NextResponse.json(
        { error: "You cannot link your own therapist email as a client." },
        { status: 400 }
      );
    }

    // Check if patient row already exists by email
    const { data: existingPatient } = await admin
      .from("patients")
      .select("*")
      .eq("email", normalizedEmail)
      .maybeSingle();

    // Check if client is registered in auth.users
    let clientAuthId: string | null = null;
    let authClientName: string | null = null;
    try {
      const { data: usersList } = await admin.auth.admin.listUsers();
      const found = usersList?.users?.find(
        (u) => u.email?.toLowerCase().trim() === normalizedEmail
      );
      if (found) {
        clientAuthId = found.id;
        authClientName =
          found.user_metadata?.name ||
          found.user_metadata?.display_name ||
          null;
      }
    } catch {
      // ignore
    }

    const invitationStatus = autoConfirm ? "accepted" : "pending";
    const now = new Date().toISOString();
    const resolvedCondition =
      condition?.trim() ||
      existingPatient?.condition ||
      "Personalized Rehabilitation Care";

    let savedPatient = null;

    if (existingPatient) {
      // Case 1: Already actively linked to this therapist
      if (
        existingPatient.therapist_id === currentTherapistId &&
        existingPatient.invitation_status === "accepted"
      ) {
        return NextResponse.json({
          success: true,
          alreadyLinked: true,
          message: `${existingPatient.name} is already active in your caseload.`,
          client: existingPatient,
          invitation_status: "accepted",
        });
      }

      // Case 2: Already pending invitation to this therapist
      if (
        existingPatient.therapist_id === currentTherapistId &&
        existingPatient.invitation_status === "pending"
      ) {
        return NextResponse.json({
          success: true,
          alreadyPending: true,
          message: `A connection request with ${existingPatient.name} is already pending.`,
          client: existingPatient,
          invitation_status: "pending",
        });
      }

      // Case 3: Update existing patient to connect to this therapist
      const updatePayload: Record<string, unknown> = {
        therapist_id: currentTherapistId,
        previous_therapist_id: existingPatient.therapist_id || null,
        invitation_status: invitationStatus,
        invitation_initiated_by: "therapist",
        invitation_sent_at: now,
        condition: resolvedCondition,
        updated_at: now,
      };

      if (!existingPatient.client_user_id && clientAuthId) {
        updatePayload.client_user_id = clientAuthId;
      }

      let updated = null;
      const { data: fullUpdated, error: updateError } = await admin
        .from("patients")
        .update(updatePayload)
        .eq("id", existingPatient.id)
        .select()
        .single();

      if (!updateError && fullUpdated) {
        updated = fullUpdated;
      } else {
        // Retry omitting newer handshake columns
        const { data: retryUpdated, error: retryUpdateErr } = await admin
          .from("patients")
          .update({
            therapist_id: currentTherapistId,
            invitation_status: invitationStatus,
            condition: resolvedCondition,
            updated_at: now,
          })
          .eq("id", existingPatient.id)
          .select()
          .single();

        if (retryUpdateErr) {
          // Minimal update
          const { data: minUpdated, error: minUpdateErr } = await admin
            .from("patients")
            .update({
              therapist_id: currentTherapistId,
              updated_at: now,
            })
            .eq("id", existingPatient.id)
            .select()
            .single();

          if (minUpdateErr) {
            return NextResponse.json(
              { error: minUpdateErr.message || "Failed to update client link record." },
              { status: 500 }
            );
          }
          updated = minUpdated;
        } else {
          updated = retryUpdated;
        }
      }

      savedPatient = updated;
    } else {
      // Case 4: No patient record yet. Create new patient row linked to this therapist
      const resolvedName =
        clientName?.trim() ||
        authClientName ||
        normalizedEmail.split("@")[0].replace(/[._]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

      let inserted = null;
      const { data: fullInserted, error: insertError } = await admin
        .from("patients")
        .insert({
          therapist_id: currentTherapistId,
          client_user_id: clientAuthId || null,
          name: resolvedName,
          email: normalizedEmail,
          age: 30,
          gender: "Unspecified",
          condition: resolvedCondition,
          invitation_status: invitationStatus,
          invitation_initiated_by: "therapist",
          invitation_sent_at: now,
        })
        .select()
        .single();

      if (!insertError && fullInserted) {
        inserted = fullInserted;
      } else {
        // Retry without newer handshake columns
        const { data: retryInserted, error: retryInsertErr } = await admin
          .from("patients")
          .insert({
            therapist_id: currentTherapistId,
            client_user_id: clientAuthId || null,
            name: resolvedName,
            email: normalizedEmail,
            age: 30,
            gender: "Unspecified",
            condition: resolvedCondition,
            invitation_status: invitationStatus,
          })
          .select()
          .single();

        if (retryInsertErr) {
          // Absolute minimal insert
          const { data: minInserted, error: minInsertErr } = await admin
            .from("patients")
            .insert({
              therapist_id: currentTherapistId,
              client_user_id: clientAuthId || null,
              name: resolvedName,
              email: normalizedEmail,
            })
            .select()
            .single();

          if (minInsertErr) {
            return NextResponse.json(
              { error: minInsertErr.message || "Failed to create client link record." },
              { status: 500 }
            );
          }
          inserted = minInserted;
        } else {
          inserted = retryInserted;
        }
      }

      savedPatient = inserted;
    }

    return NextResponse.json({
      success: true,
      message: autoConfirm
        ? `Client (${normalizedEmail}) has been directly connected to your caseload.`
        : `Care connection request sent to client (${normalizedEmail}). Waiting for client to confirm in their portal.`,
      invitation_status: savedPatient?.invitation_status || invitationStatus,
      invitation_initiated_by: "therapist",
      client: savedPatient,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const therapistId = searchParams.get("therapistId");
    if (!therapistId) {
      return NextResponse.json({ error: "therapistId is required" }, { status: 400 });
    }
    const admin = createAdminClient();
    if (!admin) {
      return NextResponse.json({ error: "Database not configured. Run migrations." }, { status: 503 });
    }

    const { data: clients, error } = await admin
      .from("patients")
      .select("*")
      .eq("therapist_id", therapistId)
      .eq("invitation_status", "pending")
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ pendingClients: clients || [] });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
