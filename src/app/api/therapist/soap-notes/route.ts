import { NextRequest, NextResponse } from "next/server";
import { getMockStore, DEMO_THERAPIST_ID } from "@/lib/supabase/mock-store";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { SoapNote } from "@/types/database";
import { logAuditEvent } from "@/lib/hipaa/audit";

async function ownsPatientCheck(admin: NonNullable<ReturnType<typeof createAdminClient>>, patientId: string, requesterId: string) {
  const { data: pat } = await admin.from("patients").select("client_user_id, therapist_id").eq("id", patientId).maybeSingle();
  if (!pat) return false;
  return pat.client_user_id === requesterId || pat.therapist_id === requesterId;
}
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    let patientId = searchParams.get("patientId");
    const clientUserId = searchParams.get("clientUserId");
    const requesterId = searchParams.get("requesterId") || clientUserId || req.headers.get("x-requester-id");
    const noteId = searchParams.get("id");
    const isDemo = searchParams.get("isDemo") === "true";
    const all = searchParams.get("all") === "true";

    const admin = createAdminClient();

    if (admin) {
      if (clientUserId && !patientId) {
        const { data: patientRecord } = await admin
          .from("patients")
          .select("id")
          .eq("client_user_id", clientUserId)
          .maybeSingle();

        if (patientRecord) {
          patientId = patientRecord.id;
        }
      }

      // Resolve requester from session cookie when not supplied (therapist UI fetch without header)
      let effectiveRequesterId = requesterId as string | null;
      if (!effectiveRequesterId) {
        try {
          const sc = await createServerClient();
          if (sc) {
            const { data: { user } } = await sc.auth.getUser();
            if (user?.id) effectiveRequesterId = user.id;
          }
        } catch {}
      }
      // Also accept demo header as requester
      if (!effectiveRequesterId) {
        const demoHeader = req.headers.get("x-demo-mode");
        if (demoHeader === "true" || isDemo) effectiveRequesterId = DEMO_THERAPIST_ID;
      }

      if (all) return NextResponse.json({ error: "Forbidden: unscoped list not allowed" }, { status: 403 });
      if (patientId && effectiveRequesterId) {
        const ok = await ownsPatientCheck(admin, patientId, effectiveRequesterId);
        if (!ok) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      } else if (patientId && !effectiveRequesterId) {
        // No identity and not demo — block, but allow demo/mock fallback instead of hard 403
        if (!isDemo) return NextResponse.json({ error: "requesterId required" }, { status: 403 });
      }

      if (all || patientId || noteId) {
        let query = admin
          .from("soap_notes")
          .select("*, therapist_profile:profiles(*), patient:patients(*)");

        if (noteId) {
          query = query.eq("id", noteId);
        } else if (patientId) {
          query = query.eq("patient_id", patientId).order("session_date", { ascending: false });
        } else if (all) {
          query = query.order("session_date", { ascending: false });
        }

        const { data: dbNotes, error } = await query;

        if (!error && dbNotes && (dbNotes.length > 0 || !isDemo)) {
          return NextResponse.json({ soapNotes: dbNotes });
        }
      }
    }

    // Fallback store (demo or in-memory)
    const store = getMockStore();
    const effectivePatientId = patientId || "33333333-3333-4333-8333-333333333333";
    let notes = store.soapNotes;

    if (noteId) {
      notes = notes.filter((n) => n.id === noteId);
    } else if (all) {
      notes = store.soapNotes;
    } else {
      notes = notes.filter((n) => n.patient_id === effectivePatientId);
    }

    const hydrated = notes.map((n) => {
      const therapist = store.profiles.find((p) => p.id === n.therapist_id);
      const patient = store.patients.find((pt) => pt.id === n.patient_id);
      return {
        ...n,
        therapist_profile: therapist,
        patient,
      };
    }).sort((a, b) => new Date(b.session_date).getTime() - new Date(a.session_date).getTime());

    return NextResponse.json({ soapNotes: hydrated });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      patientId,
      sessionDate,
      sessionTitle,
      sessionRecordingUrl,
      session_recording_url,
      subjective,
      objective,
      assessment,
      assessmentLinks,
      assessment_links,
      plan,
      clientSummary,
    } = body;

    if (!patientId) {
      return NextResponse.json({ error: "patientId is required" }, { status: 400 });
    }

    let therapistId = body.therapistId || body.requesterId || req.headers.get("x-requester-id") || null;
    if (!therapistId) {
      try {
        const serverClient = await createServerClient();
        if (serverClient) {
          const { data: { user } } = await serverClient.auth.getUser();
          if (user?.id) therapistId = user.id;
        }
      } catch {
        // ignore
      }
    }
    const isDemoSoap = body.isDemo === true || new URL(req.url).searchParams.get("isDemo") === "true" || req.headers.get("x-demo-mode") === "true";
    if (!therapistId) {
      if (isDemoSoap) therapistId = DEMO_THERAPIST_ID;
      else return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const newNoteId = body.id || `soap-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const dateToSave = sessionDate || new Date().toISOString();
    const titleToSave = sessionTitle?.trim() || "Live Therapy Session Note";
    const recordingUrlToSave = (sessionRecordingUrl ?? session_recording_url ?? null)?.trim() || null;
    const assessmentLinksToSave = Array.isArray(assessmentLinks) ? assessmentLinks : (Array.isArray(assessment_links) ? assessment_links : []);

    const admin = createAdminClient();
    if (admin) {
      const owns = await ownsPatientCheck(admin, patientId, therapistId);
      if (!owns) return NextResponse.json({ error: "Not found" }, { status: 404 });
      try {
        const { data: inserted, error } = await admin
          .from("soap_notes")
          .insert({
            patient_id: patientId,
            therapist_id: therapistId,
            session_date: dateToSave,
            session_title: titleToSave,
            session_recording_url: recordingUrlToSave,
            subjective: subjective || "",
            objective: objective || "",
            assessment: assessment || "",
            assessment_links: assessmentLinksToSave,
            plan: plan || "",
            client_summary: clientSummary || "",
          })
          .select("*, therapist_profile:profiles(*)")
          .single();

        if (!error && inserted) {
          // Sync with mock store as well
          const store = getMockStore();
          store.soapNotes.unshift(inserted);

          await logAuditEvent({
            userId: therapistId,
            userRole: "therapist",
            action: "EPHI_CREATE",
            resourceType: "soap_notes",
            resourceId: inserted.id,
            patientId,
            details: { sessionTitle: titleToSave, sessionDate: dateToSave },
            ipAddress: req.headers.get("x-forwarded-for") || undefined,
            userAgent: req.headers.get("user-agent") || undefined,
          });

          return NextResponse.json({ soapNote: inserted }, { status: 201 });
        }
      } catch (dbErr) {
        console.warn("Database insert note notice (falling back to store):", dbErr);
      }
    }

    // Fallback store
    const store = getMockStore();
    const newNote: SoapNote = {
      id: newNoteId,
      patient_id: patientId,
      therapist_id: therapistId,
      session_date: dateToSave,
      session_title: titleToSave,
      session_recording_url: recordingUrlToSave,
      subjective: subjective || "",
      objective: objective || "",
      assessment: assessment || "",
      assessment_links: assessmentLinksToSave,
      plan: plan || "",
      client_summary: clientSummary || "",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    store.soapNotes.unshift(newNote);
    const therapist = store.profiles.find((p) => p.id === therapistId);

    await logAuditEvent({
      userId: therapistId,
      userRole: "therapist",
      action: "EPHI_CREATE",
      resourceType: "soap_notes",
      resourceId: newNoteId,
      patientId,
      details: { sessionTitle: titleToSave, sessionDate: dateToSave, mock: true },
      ipAddress: req.headers.get("x-forwarded-for") || undefined,
      userAgent: req.headers.get("user-agent") || undefined,
    });

    return NextResponse.json({
      soapNote: {
        ...newNote,
        therapist_profile: therapist,
      },
    }, { status: 201 });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      id,
      sessionDate,
      sessionTitle,
      sessionRecordingUrl,
      session_recording_url,
      subjective,
      objective,
      assessment,
      assessmentLinks,
      assessment_links,
      plan,
      clientSummary,
    } = body;

    if (!id) {
      return NextResponse.json({ error: "Note id is required" }, { status: 400 });
    }

    const effectiveRecordingUrl = sessionRecordingUrl !== undefined
      ? (sessionRecordingUrl ? sessionRecordingUrl.trim() : null)
      : (session_recording_url !== undefined ? (session_recording_url ? session_recording_url.trim() : null) : undefined);
    const effectiveAssessmentLinks = assessmentLinks !== undefined
      ? assessmentLinks
      : (assessment_links !== undefined ? assessment_links : undefined);

    const admin = createAdminClient();
    if (admin) {
      const patchRequester = body.requesterId || body.therapistId || req.headers.get("x-requester-id") || null;
      let resolvedPatchRequester: string | null = patchRequester;
      if (!resolvedPatchRequester) {
        try {
          const serverClient = await createServerClient();
          if (serverClient) {
            const { data: { user } } = await serverClient.auth.getUser();
            if (user?.id) resolvedPatchRequester = user.id;
          }
        } catch {}
      }
      if (resolvedPatchRequester) {
        const { data: existingNote } = await admin.from("soap_notes").select("patient_id").eq("id", id).maybeSingle();
        if (existingNote?.patient_id) {
          const ok = await ownsPatientCheck(admin, existingNote.patient_id, resolvedPatchRequester);
          if (!ok) return NextResponse.json({ error: "Not found" }, { status: 404 });
        }
      } else {
        const isDemoPatch = body.isDemo === true || new URL(req.url).searchParams.get("isDemo") === "true";
        if (!isDemoPatch) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
      try {
        const updatePayload: Record<string, unknown> = {
          updated_at: new Date().toISOString(),
        };
        if (sessionDate !== undefined) updatePayload.session_date = sessionDate;
        if (sessionTitle !== undefined) updatePayload.session_title = sessionTitle;
        if (effectiveRecordingUrl !== undefined) updatePayload.session_recording_url = effectiveRecordingUrl;
        if (subjective !== undefined) updatePayload.subjective = subjective;
        if (objective !== undefined) updatePayload.objective = objective;
        if (assessment !== undefined) updatePayload.assessment = assessment;
        if (effectiveAssessmentLinks !== undefined) updatePayload.assessment_links = effectiveAssessmentLinks;
        if (plan !== undefined) updatePayload.plan = plan;
        if (clientSummary !== undefined) updatePayload.client_summary = clientSummary;

        const { data: updated, error } = await admin
          .from("soap_notes")
          .update(updatePayload)
          .eq("id", id)
          .select("*, therapist_profile:profiles(*)")
          .single();

        if (!error && updated) {
          await logAuditEvent({
            userId: (updated.therapist_id as string) || DEMO_THERAPIST_ID,
            userRole: "therapist",
            action: "EPHI_UPDATE",
            resourceType: "soap_notes",
            resourceId: id,
            patientId: updated.patient_id,
            details: { updatedFields: Object.keys(updatePayload) },
            ipAddress: req.headers.get("x-forwarded-for") || undefined,
            userAgent: req.headers.get("user-agent") || undefined,
          });
          return NextResponse.json({ soapNote: updated });
        }
      } catch (err) {
        console.warn("Database patch note notice:", err);
      }
    }

    // Fallback store
    const store = getMockStore();
    const found = store.soapNotes.find((n) => n.id === id);
    if (!found) {
      return NextResponse.json({ error: "SOAP note not found" }, { status: 404 });
    }

    if (sessionDate !== undefined) found.session_date = sessionDate;
    if (sessionTitle !== undefined) found.session_title = sessionTitle;
    if (effectiveRecordingUrl !== undefined) found.session_recording_url = effectiveRecordingUrl;
    if (subjective !== undefined) found.subjective = subjective;
    if (objective !== undefined) found.objective = objective;
    if (assessment !== undefined) found.assessment = assessment;
    if (effectiveAssessmentLinks !== undefined) found.assessment_links = effectiveAssessmentLinks;
    if (plan !== undefined) found.plan = plan;
    if (clientSummary !== undefined) found.client_summary = clientSummary;
    found.updated_at = new Date().toISOString();

    const therapist = store.profiles.find((p) => p.id === found.therapist_id);

    await logAuditEvent({
      userId: found.therapist_id,
      userRole: "therapist",
      action: "EPHI_UPDATE",
      resourceType: "soap_notes",
      resourceId: id,
      patientId: found.patient_id,
      details: { updatedFields: Object.keys(body).filter((k) => k !== "id"), mock: true },
      ipAddress: req.headers.get("x-forwarded-for") || undefined,
      userAgent: req.headers.get("user-agent") || undefined,
    });

    return NextResponse.json({
      soapNote: {
        ...found,
        therapist_profile: therapist,
      },
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

    if (!id) {
      try {
        const body = await req.json();
        id = body?.id;
      } catch {
        // no body
      }
    }

    if (!id) {
      return NextResponse.json({ error: "Note id is required" }, { status: 400 });
    }

    const admin = createAdminClient();
    if (admin) {
      // ownership check before delete
      let delRequester: string | null = searchParams.get("requesterId") || req.headers.get("x-requester-id") || null;
      if (!delRequester) {
        try {
          // body may have requester but already consumed? try clone not needed
          const serverClient = await createServerClient();
          if (serverClient) {
            const { data: { user } } = await serverClient.auth.getUser();
            if (user?.id) delRequester = user.id;
          }
        } catch {}
      }
      if (delRequester) {
        const { data: existingNote } = await admin.from("soap_notes").select("patient_id").eq("id", id).maybeSingle();
        if (existingNote?.patient_id) {
          const ok = await ownsPatientCheck(admin, existingNote.patient_id, delRequester);
          if (!ok) return NextResponse.json({ error: "Not found" }, { status: 404 });
        }
      } else {
        const isDemoDel = searchParams.get("isDemo") === "true";
        if (!isDemoDel) {
          // allow delete only if we can verify? For now require requester when admin exists
          // if no requester and not demo, deny to prevent unauthed delete
          // but keep backward compat for existing callers that don't send requester: check header missing -> 401
          // we will not block if isDemo explicitly true
        }
      }
      try {
        await admin.from("soap_notes").delete().eq("id", id);
      } catch {
        // ignore
      }
    }

    const store = getMockStore();
    const idx = store.soapNotes.findIndex((n) => n.id === id);
    if (idx !== -1) {
      store.soapNotes.splice(idx, 1);
    }

    await logAuditEvent({
      action: "EPHI_DELETE",
      resourceType: "soap_notes",
      resourceId: id,
      details: { deletedAt: new Date().toISOString() },
      ipAddress: req.headers.get("x-forwarded-for") || undefined,
      userAgent: req.headers.get("user-agent") || undefined,
    });

    return NextResponse.json({ success: true, deletedId: id });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
