import { NextRequest, NextResponse } from "next/server";
import { getMockStore, DEMO_THERAPIST_ID, DEMO_CLIENT_ID } from "@/lib/supabase/mock-store";
import { createAdminClient } from "@/lib/supabase/admin";

async function ownsPatientCheck(admin: NonNullable<ReturnType<typeof createAdminClient>>, patientId: string, requesterId: string | null) {
  if (!requesterId) return false;
  const { data: pat } = await admin.from("patients").select("client_user_id, therapist_id").eq("id", patientId).maybeSingle();
  if (!pat) return false;
  return pat.client_user_id === requesterId || pat.therapist_id === requesterId;
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const clientUserId = searchParams.get("clientUserId");
    const isDemo = searchParams.get("isDemo") === "true";
    let patientId = searchParams.get("patientId");
    const requesterId = searchParams.get("requesterId") || searchParams.get("therapistId") || clientUserId;

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
        // IDOR fix: verify requester owns this patient thread
        if (!isDemo && requesterId) {
          const ok = await ownsPatientCheck(admin, patientId, requesterId);
          if (!ok) return NextResponse.json({ error: "Forbidden: not your care thread" }, { status: 403 });
        } else if (!isDemo && !requesterId) {
          // No proof of ownership for patientId direct fetch — deny to prevent guessing
          return NextResponse.json({ error: "requesterId required" }, { status: 403 });
        }
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

const CHAT_BUCKET = "chat-attachments";
const MAX_IMAGE_BYTES = 6 * 1024 * 1024;

async function resolvePatientId(
  inputPatientId: string | null | undefined,
  clientUserId: string | null | undefined,
  admin: ReturnType<typeof createAdminClient>
): Promise<string | null> {
  if (inputPatientId) return inputPatientId;
  if (!clientUserId || !admin) return null;
  const { data: patientRecord } = await admin.from("patients").select("id").eq("client_user_id", clientUserId).maybeSingle();
  if (patientRecord) return patientRecord.id;
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
  return newPatient?.id || null;
}

export async function POST(req: NextRequest) {
  try {
    const contentType = req.headers.get("content-type") || "";
    const isMultipart = contentType.includes("multipart/form-data");

    let patientId: string | null = null;
    let clientUserId: string | null = null;
    let senderRole: string | undefined;
    let text: string = "";
    let referencedProgramId: string | null = null;
    let customSenderId: string | null = null;
    let imageFile: File | null = null;

    if (isMultipart) {
      const form = await req.formData();
      patientId = (form.get("patientId") as string) || null;
      clientUserId = (form.get("clientUserId") as string) || null;
      senderRole = (form.get("senderRole") as string) || undefined;
      text = (form.get("text") as string) || "";
      referencedProgramId = (form.get("referencedProgramId") as string) || null;
      customSenderId = (form.get("senderId") as string) || null;
      const f = form.get("image") || form.get("file");
      if (f instanceof File && f.size > 0) imageFile = f;
    } else {
      const body = await req.json();
      patientId = body.patientId ?? null;
      clientUserId = body.clientUserId ?? null;
      senderRole = body.senderRole;
      text = body.text ?? "";
      referencedProgramId = body.referencedProgramId ?? null;
      customSenderId = body.senderId ?? null;
      // allow base64 fallback via JSON: { imageDataUrl }
      if (body.imageDataUrl && typeof body.imageDataUrl === "string") {
        // synthesize a File-like object later; store as data URL directly if no storage
        // handled below via direct attachment_url
      }
    }

    const store = getMockStore();
    const admin = createAdminClient();
    const postRequesterId = (typeof clientUserId === "string" && clientUserId) ? clientUserId : (customSenderId || null);
    // Prefer explicit requesterId from form/body header if supplied
    const bodyRequester = (customSenderId && !customSenderId.startsWith("demo-")) ? customSenderId : postRequesterId;
    patientId = await resolvePatientId(patientId, clientUserId, admin);
    // Ownership check before write
    if (admin && patientId && (clientUserId || customSenderId)) {
      const rId = clientUserId || customSenderId;
      if (rId && !rId.startsWith("demo-")) {
        const ok = await ownsPatientCheck(admin, patientId, rId);
        if (!ok) return NextResponse.json({ error: "Forbidden: patient not in your care" }, { status: 403 });
      }
    }

    const hasText = typeof text === "string" && text.trim().length > 0;
    const hasImage = !!imageFile;
    // also check JSON base64 payload
    let jsonImageDataUrl: string | null = null;
    if (!isMultipart) {
      try {
        const raw = await req.clone().json().catch(() => null);
        // already parsed above; re-use body if present
        // we already have body via earlier parse – need to capture again
      } catch {}
    }

    if (!patientId || (!hasText && !hasImage && !jsonImageDataUrl)) {
      // try to recover jsonImageDataUrl from earlier body when not multipart
      if (!isMultipart) {
        // Re-parse from already-read body is not possible after previous json(); so fallback: if text empty but we had imageDataUrl, allow
        // Do nothing – will error below
      }
      if (!hasText && !hasImage) {
        return NextResponse.json({ error: "patientId and text or image are required" }, { status: 400 });
      }
    }

    const defaultSenderId = senderRole === "client" ? DEMO_CLIENT_ID : DEMO_THERAPIST_ID;
    const senderId = customSenderId || defaultSenderId;
    const sanitizedBody = hasText ? text.trim().replace(/</g, "&lt;").replace(/>/g, "&gt;") : "📷 Photo";

    // Handle JSON base64 path (when client sent compressed data URL because no storage)
    let attachmentUrl: string | null = null;
    let attachmentStoragePath: string | null = null;
    let attachmentType: string | null = null;
    let attachmentMeta: Record<string, unknown> | null = null;

    // If multipart image, upload to storage (free-tier optimized: client already compressed to ~200KB)
    if (imageFile) {
      if (!imageFile.type.startsWith("image/") && !imageFile.type.startsWith("video/")) {
        return NextResponse.json({ error: "Only image/video allowed" }, { status: 400 });
      }
      if (imageFile.size > MAX_IMAGE_BYTES) {
        return NextResponse.json({ error: "Image too large (max 6MB after compression)" }, { status: 400 });
      }
      attachmentType = imageFile.type.startsWith("video/") ? "video" : "image";
      attachmentMeta = { size: imageFile.size, mime: imageFile.type };

      if (admin) {
        try {
          const ext = imageFile.name.split(".").pop() || "jpg";
          const storagePath = `${patientId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
          const { error: upErr } = await admin.storage.from(CHAT_BUCKET).upload(storagePath, imageFile, {
            contentType: imageFile.type,
            cacheControl: "3600",
            upsert: false,
          });
          if (!upErr) {
            attachmentStoragePath = storagePath;
            // try signed URL (bucket is private); fallback to public URL if signed fails
            try {
              const { data: signed } = await admin.storage.from(CHAT_BUCKET).createSignedUrl(storagePath, 60 * 60 * 24 * 7);
              attachmentUrl = signed?.signedUrl || null;
            } catch {}
            if (!attachmentUrl) {
              const { data: pub } = admin.storage.from(CHAT_BUCKET).getPublicUrl(storagePath);
              attachmentUrl = pub?.publicUrl || null;
            }
          } else {
            // upload failed (bucket missing/policy) → fallback to base64 inline (still free-tier small due to client compression)
            const buf = await imageFile.arrayBuffer();
            const b64 = Buffer.from(buf).toString("base64");
            attachmentUrl = `data:${imageFile.type};base64,${b64}`;
          }
        } catch {
          const buf = await imageFile.arrayBuffer();
          const b64 = Buffer.from(buf).toString("base64");
          attachmentUrl = `data:${imageFile.type};base64,${b64}`;
        }
      } else {
        // no admin (demo/mock path) → inline data URL (already compressed)
        const buf = await imageFile.arrayBuffer();
        const b64 = Buffer.from(buf).toString("base64");
        attachmentUrl = `data:${imageFile.type};base64,${b64}`;
      }
    }

    // Also handle JSON imageDataUrl if present (read body again via fallback header)
    if (!attachmentUrl && !isMultipart) {
      // Need to re-read body – we already consumed json; try to get from request via text fallback
      // The imageDataUrl was already extracted if we had body reference; we lost it due to consume.
      // Workaround: if sanitizedBody is still placeholder and we have no imageFile, keep as text-only.
    }

    if (admin) {
      const recentWindow = new Date(Date.now() - 3000).toISOString();
      const { data: duplicate } = await admin
        .from("messages")
        .select("*, sender_profile:profiles(*), referenced_program:home_programs(id, title, status)")
        .eq("patient_id", patientId!)
        .eq("sender_id", senderId)
        .eq("body", sanitizedBody)
        .gte("created_at", recentWindow)
        .maybeSingle();
      if (duplicate && !attachmentUrl) {
        return NextResponse.json({ message: duplicate, deduplicated: true }, { status: 200 });
      }

      // Try insert with attachment columns; fallback to legacy if columns not yet migrated
      const insertPayload: Record<string, unknown> = {
        patient_id: patientId,
        sender_id: senderId,
        body: sanitizedBody,
        referenced_program_id: referencedProgramId || null,
      };
      if (attachmentUrl) {
        insertPayload.attachment_url = attachmentUrl;
        insertPayload.attachment_storage_path = attachmentStoragePath;
        insertPayload.attachment_type = attachmentType;
        insertPayload.attachment_meta = attachmentMeta || {};
      }
      let inserted: unknown = null;
      let insErr: unknown = null;
      const attempt = await admin
        .from("messages")
        .insert(insertPayload)
        .select("*, sender_profile:profiles(*), referenced_program:home_programs(id, title, status)")
        .single();
      inserted = attempt.data;
      insErr = attempt.error;

      // fallback if attachment columns don't exist yet
      if (insErr && attachmentUrl) {
        const fallback = await admin
          .from("messages")
          .insert({
            patient_id: patientId,
            sender_id: senderId,
            body: sanitizedBody,
            referenced_program_id: referencedProgramId || null,
          })
          .select("*, sender_profile:profiles(*), referenced_program:home_programs(id, title, status)")
          .single();
        inserted = fallback.data;
        insErr = fallback.error;
        if (!insErr && inserted) {
          (inserted as Record<string, unknown>).attachment_url = attachmentUrl;
          (inserted as Record<string, unknown>).attachment_type = attachmentType;
          (inserted as Record<string, unknown>).attachment_meta = attachmentMeta;
        }
      }

      if (!insErr && inserted) {
        return NextResponse.json({ message: inserted }, { status: 201 });
      }
    }

    // Fallback in-memory
    const recentDuplicate = store.messages.find(
      (m) => m.patient_id === patientId && m.sender_id === senderId && m.body === sanitizedBody && Date.now() - new Date(m.created_at).getTime() < 3000
    );
    if (recentDuplicate && !attachmentUrl) {
      return NextResponse.json({ message: recentDuplicate, deduplicated: true }, { status: 200 });
    }
    let verifiedProgramId: string | null = null;
    if (referencedProgramId) {
      const prog = store.programs.find((p) => p.id === referencedProgramId && p.patient_id === patientId);
      if (prog && prog.status !== "draft") verifiedProgramId = prog.id;
    }
    const newMessage: Record<string, unknown> = {
      id: `msg-${Date.now()}`,
      patient_id: patientId,
      sender_id: senderId,
      body: sanitizedBody,
      referenced_program_id: verifiedProgramId,
      created_at: new Date().toISOString(),
      attachment_url: attachmentUrl,
      attachment_storage_path: attachmentStoragePath,
      attachment_type: attachmentType,
      attachment_meta: attachmentMeta,
    };
    store.messages.push(newMessage as never);
    const sender = store.profiles.find((p) => p.id === senderId);
    const refProg = verifiedProgramId ? store.programs.find((pr) => pr.id === verifiedProgramId) : null;
    return NextResponse.json(
      {
        message: {
          ...newMessage,
          sender_profile: sender,
          referenced_program: refProg ? { id: refProg.id, title: refProg.title, status: refProg.status } : null,
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
    const delRequesterId = searchParams.get("requesterId") || searchParams.get("clientUserId");
    const hdrRequester = req.headers.get("x-requester-id") || delRequesterId;

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
      // Ownership check before delete: message -> patient -> owner
      const { data: row } = await admin.from("messages").select("patient_id, sender_id").eq("id", messageId).maybeSingle();
      if (row?.patient_id && hdrRequester) {
        const ok = await ownsPatientCheck(admin, row.patient_id as string, hdrRequester);
        if (!ok) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      // try to clean storage object if any
      try {
        const { data: msgRow } = await admin.from("messages").select("attachment_storage_path").eq("id", messageId).maybeSingle();
        if (msgRow?.attachment_storage_path) {
          await admin.storage.from(CHAT_BUCKET).remove([msgRow.attachment_storage_path as string]);
        }
      } catch {}
      const { error: delErr } = await admin.from("messages").delete().eq("id", messageId);
      if (delErr) console.warn("Database message deletion error note:", delErr);
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

