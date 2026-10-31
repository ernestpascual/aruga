import { NextRequest, NextResponse } from "next/server";
import { getMockStore, DEMO_THERAPIST_ID } from "@/lib/supabase/mock-store";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { Profile } from "@/types/database";
import { z } from "zod";

import { POST as linkClientByEmail } from "../client-link/route";

const AddClientSchema = z.object({
  name: z.string().min(2).max(150),
  age: z.number().int().min(1, "Client age must be at least 1 year old").max(125),
  gender: z.string().min(1),
  condition: z.string().min(3).max(255),
  email: z.string().email(),
  caregiverName: z.string().optional().nullable(),
  therapistId: z.string().optional().nullable(),
});

async function ownsPatientCheck(admin: NonNullable<ReturnType<typeof createAdminClient>>, patientId: string, requesterId: string) {
  const { data: pat } = await admin.from("patients").select("client_user_id, therapist_id").eq("id", patientId).maybeSingle();
  if (!pat) return false;
  return pat.client_user_id === requesterId || pat.therapist_id === requesterId;
}
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const therapistId = searchParams.get("therapistId");
    const requesterId = searchParams.get("requesterId") || therapistId;
    const requestedId = searchParams.get("id") || searchParams.get("patientId");
    const isDemo = searchParams.get("isDemo") === "true";
    const admin = createAdminClient();

    if (admin) {
      if (requestedId) {
        // Single-patient fetch requires ownership proof to prevent IDOR enumeration
        if (requesterId) {
          const ok = await ownsPatientCheck(admin, requestedId, requesterId);
          if (!ok) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }
        const { data: patient, error } = await admin
          .from("patients")
          .select("*")
          .eq("id", requestedId)
          .maybeSingle();

        if (!error && patient) {
          // Fetch real counts from database
          const { count: activeCount } = await admin
            .from("home_programs")
            .select("id", { count: "exact", head: true })
            .eq("patient_id", requestedId)
            .eq("status", "assigned");

          const { count: awaitingCount } = await admin
            .from("submissions")
            .select("id", { count: "exact", head: true })
            .eq("patient_id", requestedId)
            .eq("state", "submitted");

          const enriched = {
            ...patient,
            active_programs_count: activeCount ?? 0,
            awaiting_review_count: awaitingCount ?? 0,
            last_activity: patient.updated_at,
          };
          return NextResponse.json({ client: enriched, clients: [enriched] });
        }

        return NextResponse.json({ client: null, clients: [] });
      }

      if (!therapistId) {
        return NextResponse.json({ clients: [] });
      }

      // Resolve therapist's email for linking matching
      let therapistEmail: string | null = null;
      try {
        const { data: authUser } = await admin.auth.admin.getUserById(therapistId);
        therapistEmail = authUser?.user?.email?.toLowerCase().trim() || null;
      } catch {
        // ignore
      }
      if (!therapistEmail) {
        try {
          const { data: prof } = await admin
            .from("profiles")
            .select("email")
            .eq("id", therapistId)
            .maybeSingle();
          therapistEmail = prof?.email?.toLowerCase().trim() || null;
        } catch {
          // ignore
        }
      }

      // Self-heal: link any unassigned patients whose auth metadata or creation was for this therapist
      try {
        const { data: unassignedPatients } = await admin
          .from("patients")
          .select("id, client_user_id")
          .is("therapist_id", null)
          .not("client_user_id", "is", null);

        if (unassignedPatients && unassignedPatients.length > 0) {
          for (const unassigned of unassignedPatients) {
            if (unassigned.client_user_id) {
              const { data: authUser } = await admin.auth.admin.getUserById(unassigned.client_user_id);
              if (authUser?.user?.user_metadata?.therapist_id === therapistId) {
                await admin
                  .from("patients")
                  .update({ therapist_id: therapistId })
                  .eq("id", unassigned.id);
              }
            }
          }
        }
      } catch (healErr) {
        console.warn("Client self-healing check note:", healErr);
      }

      // Query patients directly linked by therapist_id
      const query = admin
        .from("patients")
        .select("*")
        .eq("therapist_id", therapistId)
        .order("created_at", { ascending: false });

      const { data: byTherapistId, error } = await query;

      // Query patients who requested link using therapist's email
      let byPendingEmail: any[] = [];
      if (therapistEmail) {
        try {
          const { data: pendingPatients } = await admin
            .from("patients")
            .select("*")
            .ilike("pending_therapist_email", therapistEmail)
            .order("created_at", { ascending: false });
          if (pendingPatients) byPendingEmail = pendingPatients;
        } catch {
          // ignore pending_therapist_email column error if not yet present
        }
      }

      // Merge and deduplicate by patient ID
      const combinedMap = new Map<string, any>();
      if (byTherapistId) {
        byTherapistId.forEach((p) => combinedMap.set(p.id, p));
      }
      if (byPendingEmail.length > 0) {
        for (const p of byPendingEmail) {
          if (!combinedMap.has(p.id)) {
            // Self-heal: assign therapist_id to this therapist
            if (p.therapist_id !== therapistId) {
              admin
                .from("patients")
                .update({ therapist_id: therapistId, updated_at: new Date().toISOString() })
                .eq("id", p.id)
                .then();
              p.therapist_id = therapistId;
            }
            combinedMap.set(p.id, p);
          }
        }
      }

      if (isDemo) {
        const store = getMockStore();
        for (const p of store.patients) {
          if (!combinedMap.has(p.id)) {
            combinedMap.set(p.id, p);
          }
        }
      }

      const dbPatients = Array.from(combinedMap.values());

      if (dbPatients.length > 0) {
        const enriched = await Promise.all(
          dbPatients.map(async (p) => {
            const { count: activeCount } = await admin
              .from("home_programs")
              .select("id", { count: "exact", head: true })
              .eq("patient_id", p.id)
              .eq("status", "assigned");

            const { count: awaitingCount } = await admin
              .from("submissions")
              .select("id", { count: "exact", head: true })
              .eq("patient_id", p.id)
              .eq("state", "submitted");

            return {
              ...p,
              active_programs_count: activeCount ?? 0,
              awaiting_review_count: awaitingCount ?? 0,
              last_activity: p.updated_at,
            };
          })
        );
        if (enriched.length > 0 || !isDemo) {
          return NextResponse.json({ clients: enriched });
        }
      }
    }

    // In-memory fallback (only when database credentials are not populated)
    const store = getMockStore();
    if (requestedId) {
      const found = store.patients.find((p) => p.id === requestedId);
      if (found) {
        const clientPrograms = store.programs.filter((pr) => pr.patient_id === found.id);
        const activePrograms = clientPrograms.filter((pr) => pr.status === "assigned").length;
        const awaitingCount = store.submissions.filter(
          (s) => s.patient_id === found.id && s.state === "submitted"
        ).length;

        const enriched = {
          ...found,
          active_programs_count: activePrograms,
          awaiting_review_count: awaitingCount,
          last_activity: found.updated_at,
        };
        return NextResponse.json({ client: enriched, clients: [enriched] });
      }
      return NextResponse.json({ client: null, clients: [] });
    }

    if (therapistId) {
      const therapistProfile = store.profiles.find((pr) => pr.id === therapistId);
      const therapistEmail = (therapistProfile as any)?.email?.toLowerCase();

      const therapistPatients = store.patients.filter(
        (p) =>
          p.therapist_id === therapistId ||
          (therapistEmail && (p as any).pending_therapist_email?.toLowerCase() === therapistEmail)
      );

      const enriched = therapistPatients.map((patient) => {
        const clientPrograms = store.programs.filter((pr) => pr.patient_id === patient.id);
        const activePrograms = clientPrograms.filter((pr) => pr.status === "assigned").length;
        const awaitingCount = store.submissions.filter(
          (s) => s.patient_id === patient.id && s.state === "submitted"
        ).length;

        return {
          ...patient,
          active_programs_count: activePrograms,
          awaiting_review_count: awaitingCount,
          last_activity: patient.updated_at,
        };
      });
      return NextResponse.json({ clients: enriched });
    }

    return NextResponse.json({ clients: [] });
    // List path falls through below with therapistId scoping (not broad dump)
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // Support quick-link by email
    if (body.action === "link_by_email" || body.linkOnly || (body.clientEmail && !body.name)) {
      return linkClientByEmail(
        new NextRequest(req.url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        })
      );
    }

    const validation = AddClientSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.issues.map((i) => i.message).join(", ") },
        { status: 400 }
      );
    }

    const { name, age, gender, condition, email, caregiverName } = validation.data;
    const admin = createAdminClient();
    const category: "adult" | "adolescent" | "pedia" | "old_people" =
      age < 12 ? "pedia" : age < 18 ? "adolescent" : age < 55 ? "adult" : "old_people";

    const normalizedEmail = email.toLowerCase().trim();

    // Resolve creating therapist ID (from body, session cookie, or fallback)
    let creatingTherapistId = validation.data.therapistId || body.therapistId || null;
    if (!creatingTherapistId) {
      try {
        const serverClient = await createServerClient();
        if (serverClient) {
          const {
            data: { user },
          } = await serverClient.auth.getUser();
          if (user?.id) {
            creatingTherapistId = user.id;
          }
        }
      } catch {
        // session lookup fallback
      }
    }
    if (!creatingTherapistId) {
      creatingTherapistId = DEMO_THERAPIST_ID;
    }

    if (admin) {
      // Ensure creating therapist profile exists to satisfy foreign key constraint
      if (creatingTherapistId) {
        const { data: therapistProfile } = await admin
          .from("profiles")
          .select("id")
          .eq("id", creatingTherapistId)
          .maybeSingle();

        if (!therapistProfile) {
          await admin.from("profiles").upsert({
            id: creatingTherapistId,
            role: "therapist",
            display_name: "Occupational Therapist",
          });
        }
      }

      // Check if a patient record with this email already exists
      const { data: existingPatient } = await admin
        .from("patients")
        .select("*")
        .eq("email", normalizedEmail)
        .maybeSingle();

      if (existingPatient) {
        // If patient is already linked to this therapist, update details
        if (existingPatient.therapist_id === creatingTherapistId) {
          const { data: updated, error: updateError } = await admin
            .from("patients")
            .update({
              name,
              age,
              gender,
              condition,
              caregiver_name: caregiverName || null,
              client_category: category,
              updated_at: new Date().toISOString(),
            })
            .eq("id", existingPatient.id)
            .select()
            .single();

          if (updateError) {
            return NextResponse.json({ error: updateError.message }, { status: 500 });
          }

          return NextResponse.json(
            {
              client: {
                ...updated,
                active_programs_count: 0,
                awaiting_review_count: 0,
                last_activity: updated.updated_at,
              },
              credentials: {
                clientName: name,
                email: normalizedEmail,
                temporaryPassword: updated.temporary_password || "(Account active)",
                isNewUser: false,
              },
              message: "Client profile updated and verified in your caseload.",
            },
            { status: 200 }
          );
        }

        // If patient exists but therapist_id is NULL (unassigned or trigger-created orphan), link them now!
        if (!existingPatient.therapist_id) {
          const { data: linked, error: linkError } = await admin
            .from("patients")
            .update({
              therapist_id: creatingTherapistId,
              name,
              age,
              gender,
              condition,
              caregiver_name: caregiverName || null,
              client_category: category,
              invitation_status: "accepted",
              updated_at: new Date().toISOString(),
            })
            .eq("id", existingPatient.id)
            .select()
            .single();

          if (linkError) {
            return NextResponse.json({ error: linkError.message }, { status: 500 });
          }

          if (linked.client_user_id) {
            try {
              await admin.auth.admin.updateUserById(linked.client_user_id, {
                user_metadata: {
                  role: "client",
                  user_type: "client",
                  therapist_id: creatingTherapistId,
                  client_category: category,
                  created_by_therapist: true,
                },
              });
              await admin.from("profiles").upsert({
                id: linked.client_user_id,
                role: "client",
                display_name: name,
                client_category: category,
              });
            } catch {
              // ignore metadata update error
            }
          }

          return NextResponse.json(
            {
              client: {
                ...linked,
                active_programs_count: 0,
                awaiting_review_count: 0,
                last_activity: linked.updated_at,
              },
              credentials: {
                clientName: name,
                email: normalizedEmail,
                temporaryPassword: linked.temporary_password || "(Account registered)",
                isNewUser: false,
              },
              message: "Client successfully linked to your caseload.",
            },
            { status: 200 }
          );
        }

        // If assigned to a different therapist or existing user account: allow linking and send invitation!
        const inviteStatus = body.autoConfirm ? "accepted" : "pending";
        const { data: reassigned, error: reassignErr } = await admin
          .from("patients")
          .update({
            previous_therapist_id: existingPatient.therapist_id,
            therapist_id: creatingTherapistId,
            name,
            age,
            gender,
            condition,
            caregiver_name: caregiverName || existingPatient.caregiver_name || null,
            client_category: category,
            invitation_status: inviteStatus,
            invitation_initiated_by: "therapist",
            invitation_sent_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq("id", existingPatient.id)
          .select()
          .single();

        if (reassignErr) {
          return NextResponse.json({ error: reassignErr.message }, { status: 500 });
        }

        if (reassigned.client_user_id) {
          try {
            await admin.auth.admin.updateUserById(reassigned.client_user_id, {
              user_metadata: {
                role: "client",
                user_type: "client",
                therapist_id: creatingTherapistId,
                client_category: category,
                created_by_therapist: true,
              },
            });
            await admin.from("profiles").upsert({
              id: reassigned.client_user_id,
              role: "client",
              display_name: name,
              client_category: category,
            });
          } catch {
            // ignore metadata update error
          }
        }

        return NextResponse.json(
          {
            client: {
              ...reassigned,
              active_programs_count: 0,
              awaiting_review_count: 0,
              last_activity: reassigned.updated_at,
            },
            credentials: {
              clientName: name,
              email: normalizedEmail,
              temporaryPassword: reassigned.temporary_password || "(Existing account - link invitation sent)",
              isNewUser: false,
            },
            message: body.autoConfirm
              ? "Existing client account found and linked to your caseload."
              : "Existing client account found. Link invitation sent for client to confirm in their portal.",
          },
          { status: 200 }
        );
      }

      // No existing patient row: provision Auth user
      const tempPassword = `Aruga-${Math.floor(100000 + Math.random() * 900000)}!`;
      let clientAuthUserId: string | null = null;
      let isNewUser = true;

      try {
        const { data: authUserData, error: authUserError } = await admin.auth.admin.createUser({
          email: normalizedEmail,
          password: tempPassword,
          email_confirm: true,
          user_metadata: {
            name,
            display_name: name,
            role: "client",
            user_type: "client",
            client_category: category,
            therapist_id: creatingTherapistId,
            created_by_therapist: true,
          },
        });

        if (authUserData?.user) {
          clientAuthUserId = authUserData.user.id;

          // Upsert client profile with guaranteed client role
          await admin.from("profiles").upsert({
            id: clientAuthUserId,
            role: "client",
            display_name: name,
            client_category: category,
            age,
            primary_condition: condition,
            caregiver_name: caregiverName || null,
          });
        } else if (authUserError) {
          // If auth user already exists, retrieve ID and link
          const { data: usersList } = await admin.auth.admin.listUsers();
          const existingAuthUser = usersList?.users?.find(
            (u) => u.email?.toLowerCase() === normalizedEmail
          );
          if (existingAuthUser) {
            clientAuthUserId = existingAuthUser.id;
            isNewUser = false;
            await admin.auth.admin.updateUserById(clientAuthUserId, {
              user_metadata: {
                role: "client",
                user_type: "client",
                therapist_id: creatingTherapistId,
                client_category: category,
                created_by_therapist: true,
              },
            });
            await admin.from("profiles").upsert({
              id: clientAuthUserId,
              role: "client",
              display_name: name,
              client_category: category,
              age,
              primary_condition: condition,
              caregiver_name: caregiverName || null,
            });
          }
        }
      } catch (authErr) {
        console.warn("Could not provision auth user:", authErr);
      }

      // Check if handle_new_user trigger already inserted the row in public.patients
      const { data: postTriggerPatient } = await admin
        .from("patients")
        .select("id")
        .eq("email", normalizedEmail)
        .maybeSingle();

      let finalPatient: any = null;
      let finalError: any = null;

      const inviteStatus = body.autoConfirm ? "accepted" : "pending";

      if (postTriggerPatient) {
        // Trigger inserted row, update it with therapist_id and full clinical info
        const { data: updated, error: updateErr } = await admin
          .from("patients")
          .update({
            therapist_id: creatingTherapistId,
            client_user_id: clientAuthUserId,
            name,
            age,
            gender,
            condition,
            caregiver_name: caregiverName || null,
            client_category: category,
            invitation_status: inviteStatus,
            invitation_initiated_by: "therapist",
            temporary_password: isNewUser ? tempPassword : null,
            updated_at: new Date().toISOString(),
          })
          .eq("id", postTriggerPatient.id)
          .select()
          .single();

        finalPatient = updated;
        finalError = updateErr;
      } else {
        // Direct insert
        const { data: inserted, error: insertErr } = await admin
          .from("patients")
          .insert({
            therapist_id: creatingTherapistId,
            client_user_id: clientAuthUserId,
            name,
            age,
            gender,
            condition,
            email: normalizedEmail,
            caregiver_name: caregiverName || null,
            client_category: category,
            invitation_status: inviteStatus,
            invitation_initiated_by: "therapist",
            invitation_sent_at: new Date().toISOString(),
            temporary_password: isNewUser ? tempPassword : null,
            first_login_at: null,
            credentials_cleared_at: null,
          })
          .select()
          .single();

        finalPatient = inserted;
        finalError = insertErr;
      }

      if (finalError) {
        console.error("Database patient write error:", finalError);
        return NextResponse.json({ error: finalError.message || "Failed to save client in database." }, { status: 500 });
      }

      if (finalPatient) {
        return NextResponse.json(
          {
            client: {
              ...finalPatient,
              active_programs_count: 0,
              awaiting_review_count: 0,
              last_activity: finalPatient.updated_at,
            },
            credentials: {
              clientName: name,
              email: normalizedEmail,
              temporaryPassword: isNewUser ? tempPassword : "(Account already registered)",
              isNewUser,
            },
          },
          { status: 201 }
        );
      }
    }

    // Fallback in-memory
    const store = getMockStore();
    const existingInMemory = store.patients.find(
      (p) => p.email.toLowerCase() === normalizedEmail
    );
    if (existingInMemory) {
      if (!existingInMemory.therapist_id || existingInMemory.therapist_id === creatingTherapistId) {
        existingInMemory.therapist_id = creatingTherapistId;
        existingInMemory.name = name;
        existingInMemory.age = age;
        existingInMemory.condition = condition;
        existingInMemory.gender = gender;
        existingInMemory.caregiver_name = caregiverName || null;
        return NextResponse.json(
          {
            client: existingInMemory,
            credentials: {
              clientName: name,
              email: normalizedEmail,
              temporaryPassword: existingInMemory.temporary_password || "(Account active)",
              isNewUser: false,
            },
          },
          { status: 200 }
        );
      }
      existingInMemory.previous_therapist_id = existingInMemory.therapist_id;
      existingInMemory.therapist_id = creatingTherapistId;
      existingInMemory.name = name;
      existingInMemory.age = age;
      existingInMemory.condition = condition;
      existingInMemory.gender = gender;
      existingInMemory.caregiver_name = caregiverName || existingInMemory.caregiver_name || null;
      existingInMemory.invitation_status = body.autoConfirm ? "accepted" : "pending";
      existingInMemory.invitation_initiated_by = "therapist";
      existingInMemory.updated_at = new Date().toISOString();
      return NextResponse.json(
        {
          client: existingInMemory,
          credentials: {
            clientName: name,
            email: normalizedEmail,
            temporaryPassword: existingInMemory.temporary_password || "(Account active)",
            isNewUser: false,
          },
          message: body.autoConfirm
            ? "Existing client account found and linked to your caseload."
            : "Existing client account found. Link invitation sent for client to confirm in their portal.",
        },
        { status: 200 }
      );
    }
    const tempPassword = `Aruga-${Math.floor(100000 + Math.random() * 900000)}!`;
    const newPatient = {
      id: `pat-${Date.now()}`,
      therapist_id: creatingTherapistId,
      client_user_id: `user-${Date.now()}`,
      name,
      age,
      gender,
      condition,
      email,
      caregiver_name: caregiverName || null,
      client_category: category,
      role: "client" as const,
      user_type: "client" as const,
      invitation_status: (body.autoConfirm ? "accepted" : "pending") as "accepted" | "pending",
      invitation_initiated_by: "therapist" as const,
      invitation_sent_at: new Date().toISOString(),
      temporary_password: tempPassword,
      first_login_at: null,
      credentials_cleared_at: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      active_programs_count: 0,
      awaiting_review_count: 0,
      last_activity: new Date().toISOString(),
    };

    store.patients.unshift(newPatient);

    // Ensure mock store has matching profile with role: 'client'
    const newProfile: Profile = {
      id: newPatient.client_user_id,
      role: "client",
      display_name: name,
      email: normalizedEmail,
      client_category: category,
      discipline: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    store.profiles = store.profiles.filter((p) => p.id !== newPatient.client_user_id && p.email !== normalizedEmail);
    store.profiles.unshift(newProfile);

    return NextResponse.json(
      {
        client: newPatient,
        credentials: {
          clientName: name,
          email: normalizedEmail,
          temporaryPassword: tempPassword,
          isNewUser: true,
        },
      },
      { status: 201 }
    );
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { searchParams } = new URL(req.url);
    const id = body.id || body.clientId || searchParams.get("id");
    const patchRequester = body.requesterId || searchParams.get("requesterId") || req.headers.get("x-requester-id");

    if (!id) {
      return NextResponse.json({ error: "Client id is required for update" }, { status: 400 });
    }

    const { name, age, gender, condition, caregiverName, clientCategory, email, action, invitationStatus } = body;
    const admin = createAdminClient();

    const category =
      clientCategory ||
      (typeof age === "number"
        ? age < 12
          ? "pedia"
          : age < 18
          ? "adolescent"
          : age < 55
          ? "adult"
          : "old_people"
        : undefined);

    const updates: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };
    if (name) updates.name = name.trim();
    if (age !== undefined) updates.age = Number(age);
    if (gender) updates.gender = gender;
    if (condition) updates.condition = condition.trim();
    if (caregiverName !== undefined) updates.caregiver_name = caregiverName ? caregiverName.trim() : null;
    if (category) updates.client_category = category;
    if (email) updates.email = email.toLowerCase().trim();
    if (invitationStatus) updates.invitation_status = invitationStatus;
    if (action === "confirm" || action === "accept") updates.invitation_status = "accepted";
    if (action === "decline") updates.invitation_status = "declined";

    if (admin) {
      if (patchRequester) {
        const ok = await ownsPatientCheck(admin, id, patchRequester);
        if (!ok) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      const { data: updatedPatient, error: updateError } = await admin
        .from("patients")
        .update(updates)
        .eq("id", id)
        .select()
        .single();

      if (updateError) {
        if (updateError.code === "PGRST116" || updateError.message.includes("0 rows")) {
          return NextResponse.json(
            { error: "We couldn't find this client record in your caseload to update. Please refresh your caseload list." },
            { status: 404 }
          );
        }
        return NextResponse.json({ error: updateError.message }, { status: 500 });
      }

      if (updatedPatient) {
        // Sync to profile if patient has client_user_id
        if (updatedPatient.client_user_id) {
          const profileUpdates: Record<string, unknown> = {
            updated_at: new Date().toISOString(),
          };
          if (name) profileUpdates.display_name = name.trim();
          if (age !== undefined) profileUpdates.age = Number(age);
          if (condition) profileUpdates.primary_condition = condition.trim();
          if (caregiverName !== undefined) profileUpdates.caregiver_name = caregiverName ? caregiverName.trim() : null;
          if (category) profileUpdates.client_category = category;

          await admin
            .from("profiles")
            .update(profileUpdates)
            .eq("id", updatedPatient.client_user_id);
        }

        return NextResponse.json({
          client: {
            ...updatedPatient,
            last_activity: updatedPatient.updated_at,
          },
          success: true,
        });
      }
    }

    // Fallback in-memory
    const store = getMockStore();
    const existing = store.patients.find((p) => p.id === id);
    if (!existing) {
      return NextResponse.json(
        { error: "We couldn't find this client record in your caseload. Please refresh your caseload list." },
        { status: 404 }
      );
    }

    Object.assign(existing, updates);
    return NextResponse.json({
      client: {
        ...existing,
        last_activity: existing.updated_at,
      },
      success: true,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    let id = searchParams.get("id");
    const delReq = searchParams.get("requesterId") || req.headers.get("x-requester-id");

    if (!id) {
      try {
        const body = await req.json();
        id = body.id;
      } catch {
        // body may not be JSON
      }
    }

    if (!id) {
      return NextResponse.json({ error: "Client id is required for deletion" }, { status: 400 });
    }

    const admin = createAdminClient();

    if (admin) {
      if (delReq) {
        const ok = await ownsPatientCheck(admin, id!, delReq);
        if (!ok) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      // 1. Delete associated messages
      await admin.from("messages").delete().eq("patient_id", id);

      // 2. Delete programs and their steps
      const { data: progs } = await admin.from("home_programs").select("id").eq("patient_id", id);
      const progIds = progs?.map((p) => p.id) || [];
      if (progIds.length > 0) {
        await admin.from("program_steps").delete().in("program_id", progIds);
      }

      // 3. Delete submissions and their child rows
      const { data: subs } = await admin.from("submissions").select("id").eq("patient_id", id);
      const subIds = subs?.map((s) => s.id) || [];
      if (subIds.length > 0) {
        const { data: reviews } = await admin.from("submission_reviews").select("id").in("submission_id", subIds);
        const reviewIds = reviews?.map((r) => r.id) || [];
        if (reviewIds.length > 0) {
          await admin.from("step_reviews").delete().in("review_id", reviewIds);
        }
        await admin.from("submission_reviews").delete().in("submission_id", subIds);
        await admin.from("step_submissions").delete().in("submission_id", subIds);
        await admin.from("submissions").delete().eq("patient_id", id);
      }

      await admin.from("home_programs").delete().eq("patient_id", id);

      // 4. Delete patient row
      const { error: delError } = await admin.from("patients").delete().eq("id", id);
      if (delError) {
        return NextResponse.json({ error: delError.message }, { status: 500 });
      }

      return NextResponse.json({ success: true, message: "Client deleted successfully from database." });
    }

    // Fallback in-memory
    const store = getMockStore();
    store.patients = store.patients.filter((p) => p.id !== id);
    store.programs = store.programs.filter((pr) => pr.patient_id !== id);
    store.submissions = store.submissions.filter((s) => s.patient_id !== id);
    store.messages = store.messages.filter((m) => m.patient_id !== id);

    return NextResponse.json({ success: true, message: "Client deleted successfully." });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

