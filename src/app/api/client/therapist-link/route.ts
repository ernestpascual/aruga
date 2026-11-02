import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient as createServerClient } from "@/lib/supabase/server";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    let clientUserId = searchParams.get("clientUserId");

    if (!clientUserId) {
      try {
        const serverClient = await createServerClient();
        if (serverClient) {
          const {
            data: { user },
          } = await serverClient.auth.getUser();
          if (user?.id) clientUserId = user.id;
        }
      } catch {
        // fallback
      }
    }

    if (!clientUserId) {
      return NextResponse.json({ error: "Unauthorized: clientUserId required" }, { status: 401 });
    }

    const admin = createAdminClient();
    if (!admin) {
      return NextResponse.json({ error: "Database not configured" }, { status: 503 });
    }

    let patient = null;
    if (clientUserId) {
      const { data: byUser } = await admin
        .from("patients")
        .select("*")
        .eq("client_user_id", clientUserId)
        .maybeSingle();
      patient = byUser;
    }

    // If patient not matched by client_user_id, self-heal and match by user's email!
    if (!patient && clientUserId) {
      try {
        const { data: authUser } = await admin.auth.admin.getUserById(clientUserId);
        const email = authUser?.user?.email?.toLowerCase().trim();
        if (email) {
          const { data: byEmail } = await admin
            .from("patients")
            .select("*")
            .eq("email", email)
            .maybeSingle();

          if (byEmail) {
            await admin
              .from("patients")
              .update({ client_user_id: clientUserId, updated_at: new Date().toISOString() })
              .eq("id", byEmail.id);
            patient = { ...byEmail, client_user_id: clientUserId };
          }
        }
      } catch {
        // ignore lookup error
      }
    }

    if (!patient || (!patient.therapist_id && !patient.pending_therapist_email)) {
      return NextResponse.json({
        linked: false,
        invitation_status: "unlinked",
        patient: patient || null,
        therapist: null,
      });
    }

    // Fetch therapist profile if therapist_id exists
    let therapistProfile: any = null;
    if (patient.therapist_id) {
      const { data: prof } = await admin
        .from("profiles")
        .select("id, display_name, discipline, facility_name, email")
        .eq("id", patient.therapist_id)
        .maybeSingle();
      therapistProfile = prof;
    }

    // If therapist profile not found but pending_therapist_email is present, look up by email
    if (!therapistProfile && patient.pending_therapist_email) {
      const { data: profByEmail } = await admin
        .from("profiles")
        .select("id, display_name, discipline, facility_name, email")
        .ilike("email", patient.pending_therapist_email)
        .maybeSingle();
      if (profByEmail) {
        therapistProfile = profByEmail;
      }
    }

    const isAccepted = patient.invitation_status === "accepted";

    return NextResponse.json({
      linked: isAccepted,
      invitation_status: patient.invitation_status || "pending",
      invitation_initiated_by: patient.invitation_initiated_by || "therapist",
      pending_therapist_email: patient.pending_therapist_email || null,
      patient,
      therapist: therapistProfile || {
        id: patient.therapist_id || "",
        display_name: therapistProfile?.display_name || "Occupational Therapist",
        discipline: therapistProfile?.discipline || "OT",
        email: patient.pending_therapist_email || undefined,
      },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  // Client requests to link with a therapist by entering therapist email
  try {
    const body = await req.json();
    const therapistEmail = body.therapistEmail?.toLowerCase().trim();
    let clientUserId = body.clientUserId;

    if (!therapistEmail) {
      return NextResponse.json({ error: "Therapist email is required." }, { status: 400 });
    }

    if (!clientUserId) {
      try {
        const serverClient = await createServerClient();
        if (serverClient) {
          const {
            data: { user },
          } = await serverClient.auth.getUser();
          if (user?.id) clientUserId = user.id;
        }
      } catch {
        // fallback
      }
    }
    if (!clientUserId) {
      return NextResponse.json({ error: "Unauthorized: clientUserId required" }, { status: 401 });
    }

    const admin = createAdminClient();
    if (!admin) {
      return NextResponse.json({ error: "Database not configured" }, { status: 503 });
    }

    // Find therapist by email in auth.users or profiles (paginate up to 1000 users)
    let targetTherapistId: string | null = null;
    let targetTherapistName: string = "Occupational Therapist";

    try {
      const { data: usersList } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
      const therapistAuth =
        usersList?.users?.find(
          (u) =>
            u.email?.toLowerCase().trim() === therapistEmail &&
            (u.user_metadata?.role === "therapist" || !u.user_metadata?.role)
        ) ||
        usersList?.users?.find((u) => u.email?.toLowerCase().trim() === therapistEmail);

      if (therapistAuth) {
        targetTherapistId = therapistAuth.id;
        const { data: prof } = await admin
          .from("profiles")
          .select("display_name")
          .eq("id", targetTherapistId)
          .maybeSingle();
        if (prof?.display_name) targetTherapistName = prof.display_name;
      }
    } catch (authListErr) {
      console.warn("auth.admin.listUsers note:", authListErr);
    }

    if (!targetTherapistId) {
      // Also check profiles table directly in case therapist profile has email
      try {
        const { data: profByEmail } = await admin
          .from("profiles")
          .select("id, display_name, role")
          .ilike("email", therapistEmail)
          .maybeSingle();

        if (profByEmail) {
          targetTherapistId = profByEmail.id;
          targetTherapistName = profByEmail.display_name || "Occupational Therapist";
        }
      } catch {
        // ignore column lookup error
      }
    }

    if (!targetTherapistId) {
      return NextResponse.json(
        {
          error: `We couldn't find an occupational therapist registered with "${therapistEmail}". Please check for typos or ask your therapist for the clinic email address they used to register on Aruga.`,
        },
        { status: 404 }
      );
    }

    // Upsert/Update patient record for this client
    let clientEmail = "";
    let clientName = "Client";
    let validClientAuthId: string | null = null;
    try {
      const { data: clientAuth } = await admin.auth.admin.getUserById(clientUserId);
      if (clientAuth?.user) {
        validClientAuthId = clientAuth.user.id;
        clientEmail = clientAuth.user.email?.toLowerCase().trim() || "";
        clientName =
          clientAuth.user.user_metadata?.name ||
          clientAuth.user.user_metadata?.display_name ||
          "Client";
      } else {
        // Try provisioning user in auth.users if valid UUID to satisfy FK
        try {
          const { data: newAuth } = await admin.auth.admin.createUser({
            id: clientUserId,
            email: `client-${clientUserId.slice(0, 8)}@aruga.local`,
            password: "ArugaDemo2026!",
            email_confirm: true,
            user_metadata: { role: "client", name: "Client" },
          });
          if (newAuth?.user) {
            validClientAuthId = newAuth.user.id;
            clientEmail = newAuth.user.email || "";
          }
        } catch {
          validClientAuthId = null;
        }
      }
    } catch {
      validClientAuthId = null;
    }

    // Ensure therapist profile exists for foreign key
    await admin.from("profiles").upsert({
      id: targetTherapistId,
      role: "therapist",
      display_name: targetTherapistName,
    });

    // Check if patient row exists by client_user_id OR by email
    let existingPatient = null;
    if (clientUserId) {
      const { data: byUser } = await admin
        .from("patients")
        .select("id, therapist_id, email, name, client_user_id")
        .eq("client_user_id", clientUserId)
        .maybeSingle();
      existingPatient = byUser;
    }
    if (!existingPatient && clientEmail) {
      const { data: byEmail } = await admin
        .from("patients")
        .select("id, therapist_id, email, name, client_user_id")
        .eq("email", clientEmail)
        .maybeSingle();
      existingPatient = byEmail;
    }

    const effectiveClientUserId = validClientAuthId || existingPatient?.client_user_id || null;

    let savedPatient = null;
    if (existingPatient) {
      // Full update attempt with all handshake fields
      const { data: updated, error: updateError } = await admin
        .from("patients")
        .update({
          therapist_id: targetTherapistId,
          client_user_id: effectiveClientUserId,
          previous_therapist_id: existingPatient.therapist_id || null,
          invitation_status: "pending",
          invitation_initiated_by: "client",
          invitation_sent_at: new Date().toISOString(),
          pending_therapist_email: therapistEmail,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existingPatient.id)
        .select()
        .single();

      if (!updateError && updated) {
        savedPatient = updated;
      } else {
        // Fallback update without pending_therapist_email in case column is not in remote schema
        const { data: retryUpdated, error: retryError } = await admin
          .from("patients")
          .update({
            therapist_id: targetTherapistId,
            client_user_id: effectiveClientUserId,
            invitation_status: "pending",
            updated_at: new Date().toISOString(),
          })
          .eq("id", existingPatient.id)
          .select()
          .single();

        if (retryError) {
          // Absolute minimal update
          const { data: minUpdated, error: minErr } = await admin
            .from("patients")
            .update({
              therapist_id: targetTherapistId,
              client_user_id: effectiveClientUserId,
            })
            .eq("id", existingPatient.id)
            .select()
            .single();

          if (minErr) {
            console.error("Failed to update patient record during therapist link:", minErr);
            return NextResponse.json(
              { error: minErr.message || "Failed to update link request in database." },
              { status: 500 }
            );
          }
          savedPatient = minUpdated;
        } else {
          savedPatient = retryUpdated;
        }
      }
    } else {
      // Insert new patient row for this client
      const { data: inserted, error: insertError } = await admin
        .from("patients")
        .insert({
          therapist_id: targetTherapistId,
          client_user_id: effectiveClientUserId,
          name: clientName,
          email: clientEmail,
          invitation_status: "pending",
          invitation_initiated_by: "client",
          invitation_sent_at: new Date().toISOString(),
          pending_therapist_email: therapistEmail,
        })
        .select()
        .single();

      if (!insertError && inserted) {
        savedPatient = inserted;
      } else {
        // Retry minimal insert without pending_therapist_email
        const { data: retryInserted, error: retryInsertErr } = await admin
          .from("patients")
          .insert({
            therapist_id: targetTherapistId,
            client_user_id: effectiveClientUserId,
            name: clientName,
            email: clientEmail,
            invitation_status: "pending",
          })
          .select()
          .single();

        if (retryInsertErr) {
          // Absolute minimal insert
          const { data: minInserted, error: minInsertErr } = await admin
            .from("patients")
            .insert({
              therapist_id: targetTherapistId,
              client_user_id: effectiveClientUserId,
              name: clientName,
              email: clientEmail,
            })
            .select()
            .single();

          if (minInsertErr) {
            console.error("Failed to insert patient record during therapist link:", minInsertErr);
            return NextResponse.json(
              { error: minInsertErr.message || "Failed to save link request in database." },
              { status: 500 }
            );
          }
          savedPatient = minInserted;
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: `Connection request sent to ${targetTherapistName}. Waiting for your therapist to confirm in their caseload.`,
      invitation_status: savedPatient?.invitation_status || "pending",
      invitation_initiated_by: savedPatient?.invitation_initiated_by || "client",
      patient: savedPatient,
      therapist: {
        id: targetTherapistId,
        name: targetTherapistName,
        email: therapistEmail,
      },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  // Client confirms or declines invitation from a therapist
  try {
    const body = await req.json();
    const action = body.action; // "accept" | "decline"
    let clientUserId = body.clientUserId;

    if (!action || (action !== "accept" && action !== "decline")) {
      return NextResponse.json(
        { error: 'Action must be "accept" or "decline".' },
        { status: 400 }
      );
    }

    if (!clientUserId) {
      try {
        const serverClient = await createServerClient();
        if (serverClient) {
          const {
            data: { user },
          } = await serverClient.auth.getUser();
          if (user?.id) clientUserId = user.id;
        }
      } catch {
        // fallback
      }
    }
    if (!clientUserId) {
      return NextResponse.json({ error: "Unauthorized: clientUserId required" }, { status: 401 });
    }

    const admin = createAdminClient();
    if (!admin) {
      return NextResponse.json({ error: "Database not configured" }, { status: 503 });
    }

    const newStatus = action === "accept" ? "accepted" : "declined";
    let { data: updated, error } = await admin
      .from("patients")
      .update({
        invitation_status: newStatus,
        updated_at: new Date().toISOString(),
      })
      .eq("client_user_id", clientUserId)
      .select()
      .maybeSingle();

    // If not found by client_user_id, try matching by email
    if (!updated && clientUserId) {
      try {
        const { data: authUser } = await admin.auth.admin.getUserById(clientUserId);
        const email = authUser?.user?.email?.toLowerCase().trim();
        if (email) {
          const { data: byEmail, error: emailErr } = await admin
            .from("patients")
            .update({
              client_user_id: clientUserId,
              invitation_status: newStatus,
              updated_at: new Date().toISOString(),
            })
            .eq("email", email)
            .select()
            .maybeSingle();
          updated = byEmail;
          error = emailErr;
        }
      } catch {
        // ignore lookup error
      }
    }

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!updated) {
      return NextResponse.json(
        {
          error: "We couldn't find an active connection invitation for your account. Please check with your therapist to ensure an invitation was sent.",
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message:
        action === "accept"
          ? "Therapy connection confirmed! You are now linked with your clinician."
          : "Connection invitation declined.",
      invitation_status: updated.invitation_status || (action === "accept" ? "accepted" : "declined"),
      patient: updated,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  // Client cancels / withdraws a pending care link request
  try {
    let clientUserId: string | null = null;
    try {
      const { searchParams } = new URL(req.url);
      clientUserId = searchParams.get("clientUserId");
    } catch {
      // ignore
    }

    if (!clientUserId) {
      try {
        const body = await req.json();
        clientUserId = body.clientUserId;
      } catch {
        // body may not be JSON
      }
    }

    if (!clientUserId) {
      try {
        const serverClient = await createServerClient();
        if (serverClient) {
          const {
            data: { user },
          } = await serverClient.auth.getUser();
          if (user?.id) clientUserId = user.id;
        }
      } catch {
        // fallback
      }
    }

    if (!clientUserId) {
      return NextResponse.json({ error: "Unauthorized: clientUserId required" }, { status: 401 });
    }

    const admin = createAdminClient();
    if (!admin) {
      return NextResponse.json({ error: "Database not configured" }, { status: 503 });
    }

    let updatedPatient = null;
    // 1. Try finding by client_user_id
    const { data: byUser } = await admin
      .from("patients")
      .select("id")
      .eq("client_user_id", clientUserId)
      .maybeSingle();

    const targetId = byUser?.id;

    if (targetId) {
      const { data: updated, error } = await admin
        .from("patients")
        .update({
          invitation_status: "unlinked",
          therapist_id: null,
          pending_therapist_email: null,
          invitation_initiated_by: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", targetId)
        .select()
        .maybeSingle();

      if (error) {
        // Retry without optional columns
        const { data: retryUpdated, error: retryErr } = await admin
          .from("patients")
          .update({
            invitation_status: "unlinked",
            therapist_id: null,
            updated_at: new Date().toISOString(),
          })
          .eq("id", targetId)
          .select()
          .maybeSingle();

        if (retryErr) {
          return NextResponse.json({ error: retryErr.message }, { status: 500 });
        }
        updatedPatient = retryUpdated;
      } else {
        updatedPatient = updated;
      }
    }

    return NextResponse.json({
      success: true,
      message: "Care connection request canceled. You can now request a new clinician link.",
      patient: updatedPatient,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
