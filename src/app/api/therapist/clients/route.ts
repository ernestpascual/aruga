import { NextRequest, NextResponse } from "next/server";
import { getMockStore, DEMO_THERAPIST_ID } from "@/lib/supabase/mock-store";
import { createAdminClient } from "@/lib/supabase/admin";
import { z } from "zod";

const AddClientSchema = z.object({
  name: z.string().min(2).max(150),
  age: z.number().int().min(1, "Client age must be at least 1 year old").max(125),
  gender: z.string().min(1),
  condition: z.string().min(3).max(255),
  email: z.string().email(),
  caregiverName: z.string().optional().nullable(),
});

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const therapistId = searchParams.get("therapistId");
    const isDemo = searchParams.get("isDemo") === "true";
    const admin = createAdminClient();

    // If a specific real therapist is querying (not demo), only return their patients
    const isExplicitRealTherapist = therapistId && therapistId !== DEMO_THERAPIST_ID && !isDemo;

    if (admin) {
      let query = admin.from("patients").select("*").order("created_at", { ascending: false });
      if (isExplicitRealTherapist) {
        query = query.eq("therapist_id", therapistId);
      } else if (isDemo || therapistId === DEMO_THERAPIST_ID) {
        // In demo bypass mode, include demo patients
      }

      const { data: dbPatients, error } = await query;

      if (!error && dbPatients) {
        // If real therapist and no patients added yet, return empty list (no dummy data)
        if (isExplicitRealTherapist && dbPatients.length === 0) {
          return NextResponse.json({ clients: [] });
        }

        if (dbPatients.length > 0) {
          const enriched = dbPatients.map((p) => ({
            ...p,
            active_programs_count: 1,
            awaiting_review_count: 0,
            last_activity: p.updated_at,
          }));
          return NextResponse.json({ clients: enriched });
        }
      }
    }

    // If real newly signed therapist, return empty caseload
    if (isExplicitRealTherapist) {
      return NextResponse.json({ clients: [] });
    }

    // Fallback store (only for demo bypass)
    const store = getMockStore();
    const demoTherapistId = DEMO_THERAPIST_ID;

    const clientsWithStats = store.patients
      .filter((p) => p.therapist_id === demoTherapistId)
      .map((patient) => {
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

    return NextResponse.json({ clients: clientsWithStats });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const validation = AddClientSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.issues.map((i) => i.message).join(", ") },
        { status: 400 }
      );
    }

    const { name, age, gender, condition, email, caregiverName } = validation.data;
    const admin = createAdminClient();
    const category: "adult" | "adolescent" | "pedia" =
      age < 12 ? "pedia" : age < 18 ? "adolescent" : "adult";

    const normalizedEmail = email.toLowerCase().trim();

    if (admin) {
      // Check if a patient with this email already exists
      const { data: existing } = await admin
        .from("patients")
        .select("id, name, email")
        .eq("email", normalizedEmail)
        .maybeSingle();

      if (existing) {
        return NextResponse.json(
          { error: `A patient record with email "${normalizedEmail}" already exists.` },
          { status: 409 }
        );
      }

      const creatingTherapistId = body.therapistId || DEMO_THERAPIST_ID;
      const tempPassword = `Aruga-${Math.floor(100000 + Math.random() * 900000)}!`;
      let clientAuthUserId: string | null = null;
      let isNewUser = true;

      // Provision Auth user in Supabase
      try {
        const { data: authUserData, error: authUserError } = await admin.auth.admin.createUser({
          email: normalizedEmail,
          password: tempPassword,
          email_confirm: true,
          user_metadata: {
            name,
            display_name: name,
            role: "client",
            client_category: category,
          },
        });

        if (authUserData?.user) {
          clientAuthUserId = authUserData.user.id;

          // Upsert client profile
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
          // If auth user already exists, retrieve ID
          const { data: usersList } = await admin.auth.admin.listUsers();
          const existingAuthUser = usersList?.users?.find(
            (u) => u.email?.toLowerCase() === normalizedEmail
          );
          if (existingAuthUser) {
            clientAuthUserId = existingAuthUser.id;
            isNewUser = false;
          }
        }
      } catch (authErr) {
        console.warn("Could not provision Supabase auth user:", authErr);
      }

      const { data: inserted, error: insertError } = await admin
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
          invitation_status: "accepted",
          invitation_sent_at: new Date().toISOString(),
          temporary_password: isNewUser ? tempPassword : null,
          first_login_at: null,
          credentials_cleared_at: null,
        })
        .select()
        .single();

      if (!insertError && inserted) {
        return NextResponse.json(
          {
            client: {
              ...inserted,
              active_programs_count: 0,
              awaiting_review_count: 0,
              last_activity: inserted.updated_at,
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
      return NextResponse.json(
        { error: `A patient record with email "${normalizedEmail}" already exists.` },
        { status: 409 }
      );
    }
    const tempPassword = `Aruga-${Math.floor(100000 + Math.random() * 900000)}!`;
    const newPatient = {
      id: `pat-${Date.now()}`,
      therapist_id: DEMO_THERAPIST_ID,
      client_user_id: `user-${Date.now()}`,
      name,
      age,
      gender,
      condition,
      email,
      caregiver_name: caregiverName || null,
      client_category: category,
      invitation_status: "accepted" as const,
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
