import { NextRequest, NextResponse } from "next/server";
import { getMockStore, DEMO_THERAPIST_ID, DEMO_CLIENT_ID } from "@/lib/supabase/mock-store";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const clientUserId = searchParams.get("clientUserId");
    const isDemo = searchParams.get("isDemo") === "true";
    let patientId = searchParams.get("patientId");

    const admin = createAdminClient();

    if (admin) {
      if (clientUserId && !patientId) {
        let { data: patientRecord } = await admin
          .from("patients")
          .select("id")
          .eq("client_user_id", clientUserId)
          .maybeSingle();

        if (!patientRecord) {
          try {
            const { data: authUser } = await admin.auth.admin.getUserById(clientUserId);
            const email = authUser?.user?.email?.toLowerCase().trim();
            if (email) {
              const { data: byEmail } = await admin
                .from("patients")
                .select("id")
                .eq("email", email)
                .maybeSingle();
              if (byEmail) {
                patientRecord = byEmail;
              }
            }
          } catch {
            // ignore
          }
        }

        if (patientRecord) {
          patientId = patientRecord.id;
        } else if (!isDemo) {
          return NextResponse.json({ messages: [], availablePrograms: [] });
        }
      }

      if (!patientId && isDemo) {
        patientId = "33333333-3333-4333-8333-333333333333";
      }

      if (patientId) {
        const { data: dbMessages, error: mErr } = await admin
          .from("messages")
          .select("*, sender_profile:profiles(*), referenced_program:home_programs(id, title, status)")
          .eq("patient_id", patientId)
          .order("created_at", { ascending: true });

        const { data: dbPrograms } = await admin
          .from("home_programs")
          .select("id, title, status")
          .eq("patient_id", patientId)
          .neq("status", "draft");

        if (!mErr && dbMessages && dbMessages.length > 0) {
          if (isDemo && dbMessages.length < 4) {
            const store = getMockStore();
            const storeThread = store.messages
              .filter((m) => m.patient_id === patientId)
              .map((m) => {
                const sender = store.profiles.find((p) => p.id === m.sender_id);
                const refProg = m.referenced_program_id
                  ? store.programs.find((pr) => pr.id === m.referenced_program_id)
                  : null;
                return {
                  ...m,
                  sender_profile: sender,
                  referenced_program: refProg
                    ? { id: refProg.id, title: refProg.title, status: refProg.status }
                    : null,
                };
              });

            if (storeThread.length > dbMessages.length) {
              const knownIds = new Set(storeThread.map((m) => m.id));
              const extraDbMessages = dbMessages.filter((m) => !knownIds.has(m.id));
              const merged = [...storeThread, ...extraDbMessages].sort(
                (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
              );
              return NextResponse.json({
                messages: merged,
                availablePrograms:
                  dbPrograms && dbPrograms.length > 0
                    ? dbPrograms
                    : store.programs.filter((p) => p.patient_id === patientId) || [],
              });
            }
          }

          return NextResponse.json({
            messages: dbMessages,
            availablePrograms: dbPrograms || [],
          });
        } else if (!isDemo && !mErr && dbMessages) {
          return NextResponse.json({
            messages: dbMessages,
            availablePrograms: dbPrograms || [],
          });
        }
      }
    }

    if (!isDemo) {
      return NextResponse.json({ messages: [], availablePrograms: [] });
    }

    // Fallback store (only in demo bypass mode)
    const effectivePatientId = patientId || "33333333-3333-4333-8333-333333333333";
    const store = getMockStore();
    const threadMessages = store.messages
      .filter((m) => m.patient_id === effectivePatientId)
      .map((m) => {
        const sender = store.profiles.find((p) => p.id === m.sender_id);
        const refProg = m.referenced_program_id
          ? store.programs.find((pr) => pr.id === m.referenced_program_id)
          : null;

        return {
          ...m,
          sender_profile: sender,
          referenced_program: refProg
            ? {
                id: refProg.id,
                title: refProg.title,
                status: refProg.status,
              }
            : null,
        };
      })
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

    const availablePrograms = store.programs
      .filter((pr) => pr.patient_id === effectivePatientId && pr.status !== "draft")
      .map((pr) => ({ id: pr.id, title: pr.title, status: pr.status }));

    return NextResponse.json({
      messages: threadMessages,
      availablePrograms,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { patientId: inputPatientId, clientUserId, senderRole, text, referencedProgramId, senderId: customSenderId } = body;
    const store = getMockStore();
    const admin = createAdminClient();

    let patientId = inputPatientId;

    if (!patientId && clientUserId && admin) {
      const { data: patientRecord } = await admin
        .from("patients")
        .select("id")
        .eq("client_user_id", clientUserId)
        .maybeSingle();

      if (patientRecord) {
        patientId = patientRecord.id;
      } else {
        // Auto-create patient row for newly registered client
        const { data: userProfile } = await admin.from("profiles").select("*").eq("id", clientUserId).maybeSingle();
        const { data: newPatient } = await admin
          .from("patients")
          .insert({
            client_user_id: clientUserId,
            name: userProfile?.display_name || "Client",
            age: userProfile?.client_category === "pedia" ? 6 : 40,
            condition: "Occupational Therapy Rehabilitation",
            client_category: userProfile?.client_category || "adult",
          })
          .select("id")
          .single();

        if (newPatient) {
          patientId = newPatient.id;
        }
      }
    }

    if (!patientId || !text || typeof text !== "string" || text.trim().length === 0) {
      return NextResponse.json(
        { error: "patientId (or valid clientUserId) and text are required" },
        { status: 400 }
      );
    }

    const defaultSenderId = senderRole === "client" ? DEMO_CLIENT_ID : DEMO_THERAPIST_ID;
    const senderId = customSenderId || defaultSenderId;

    // Sanitize plain-text body
    const sanitizedBody = text
      .trim()
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");

    if (admin) {
      // Check for accidental duplicate send within 3 seconds
      const recentWindow = new Date(Date.now() - 3000).toISOString();
      const { data: duplicate } = await admin
        .from("messages")
        .select("*, sender_profile:profiles(*), referenced_program:home_programs(id, title, status)")
        .eq("patient_id", patientId)
        .eq("sender_id", senderId)
        .eq("body", sanitizedBody)
        .gte("created_at", recentWindow)
        .maybeSingle();

      if (duplicate) {
        return NextResponse.json({ message: duplicate, deduplicated: true }, { status: 200 });
      }

      const { data: inserted, error: insErr } = await admin
        .from("messages")
        .insert({
          patient_id: patientId,
          sender_id: senderId,
          body: sanitizedBody,
          referenced_program_id: referencedProgramId || null,
        })
        .select("*, sender_profile:profiles(*), referenced_program:home_programs(id, title, status)")
        .single();

      if (!insErr && inserted) {
        return NextResponse.json({ message: inserted }, { status: 201 });
      }
    }

    // Fallback in-memory duplicate check
    const recentDuplicate = store.messages.find(
      (m) =>
        m.patient_id === patientId &&
        m.sender_id === senderId &&
        m.body === sanitizedBody &&
        Date.now() - new Date(m.created_at).getTime() < 3000
    );
    if (recentDuplicate) {
      return NextResponse.json({ message: recentDuplicate, deduplicated: true }, { status: 200 });
    }

    // Fallback store
    let verifiedProgramId: string | null = null;
    if (referencedProgramId) {
      const prog = store.programs.find(
        (p) => p.id === referencedProgramId && p.patient_id === patientId
      );
      if (prog && prog.status !== "draft") {
        verifiedProgramId = prog.id;
      }
    }

    const newMessage = {
      id: `msg-${Date.now()}`,
      patient_id: patientId,
      sender_id: senderId,
      body: sanitizedBody,
      referenced_program_id: verifiedProgramId,
      created_at: new Date().toISOString(),
    };

    store.messages.push(newMessage);

    const sender = store.profiles.find((p) => p.id === senderId);
    const refProg = verifiedProgramId
      ? store.programs.find((pr) => pr.id === verifiedProgramId)
      : null;

    return NextResponse.json(
      {
        message: {
          ...newMessage,
          sender_profile: sender,
          referenced_program: refProg
            ? { id: refProg.id, title: refProg.title, status: refProg.status }
            : null,
        },
      },
      { status: 201 }
    );
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    let messageId = searchParams.get("id") || searchParams.get("messageId");

    if (!messageId) {
      try {
        const body = await req.json();
        messageId = body?.id || body?.messageId;
      } catch {
        // no JSON body
      }
    }

    if (!messageId) {
      return NextResponse.json({ error: "Message id is required" }, { status: 400 });
    }

    const admin = createAdminClient();
    if (admin) {
      const { error: delErr } = await admin
        .from("messages")
        .delete()
        .eq("id", messageId);

      if (delErr) {
        console.warn("Database message deletion error note:", delErr);
      }
    }

    // Always remove from mock store as well
    const store = getMockStore();
    const idx = store.messages.findIndex((m) => m.id === messageId);
    if (idx !== -1) {
      store.messages.splice(idx, 1);
    }

    return NextResponse.json({ success: true, deletedId: messageId });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

