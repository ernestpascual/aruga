import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ownsPatient } from "@/lib/supabase/owner";

async function ownsPatientCheck(admin: NonNullable<ReturnType<typeof createAdminClient>>, patientId: string, requesterId: string | null) {
  if (!requesterId) return false;
  let pat: any = null;
  {
    const { data } = await admin.from("patients").select("client_user_id, therapist_id").eq("id", patientId).maybeSingle();
    if (data) pat = data;
    else {
      const { data: byClient } = await admin.from("patients").select("client_user_id, therapist_id").eq("client_user_id", patientId).maybeSingle();
      if (byClient) pat = byClient;
    }
  }
  if (!pat) return false;
  return pat.client_user_id === requesterId || pat.therapist_id === requesterId;
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const clientUserId = searchParams.get("clientUserId");
    let patientId = searchParams.get("patientId");
    const requesterId = searchParams.get("requesterId") || searchParams.get("therapistId") || clientUserId;

    const admin = createAdminClient();
    if (!admin) {
      return NextResponse.json({ error: "Service unavailable: database not configured" }, { status: 503 });
    }

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
      } else {
        return NextResponse.json({ messages: [], availablePrograms: [] });
      }
    }

    if (patientId) {
      // IDOR fix: verify requester owns this patient thread
      if (requesterId) {
        const ok = await ownsPatientCheck(admin, patientId, requesterId);
        if (!ok) return NextResponse.json({ error: "Not found" }, { status: 404 });
      } else {
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

      if (!mErr && dbMessages) {
        for (const msg of dbMessages) {
          const sp = (msg as Record<string, unknown>).attachment_storage_path as string | null;
          if (sp && typeof sp === "string" && sp.length > 0) {
            try {
              const { data: signed } = await admin.storage.from(CHAT_BUCKET).createSignedUrl(sp, 60 * 60);
              if (signed?.signedUrl) (msg as Record<string, unknown>).attachment_url = signed.signedUrl;
            } catch {}
          }
        }
      }

      if (!mErr && dbMessages) {
        return NextResponse.json({
          messages: dbMessages,
          availablePrograms: dbPrograms || [],
        });
      }
      if (mErr) {
        return NextResponse.json({ error: mErr.message }, { status: 500 });
      }
    }

    return NextResponse.json({ messages: [], availablePrograms: [] });
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
    }

    const admin = createAdminClient();
    if (!admin) {
      return NextResponse.json({ error: "Service unavailable: database not configured" }, { status: 503 });
    }

    patientId = await resolvePatientId(patientId, clientUserId, admin);
    // Ownership check before write
    if (patientId && (clientUserId || customSenderId)) {
      const rId = clientUserId || customSenderId;
      if (rId) {
        const ok = await ownsPatientCheck(admin, patientId, rId);
        if (!ok) return NextResponse.json({ error: "Not found" }, { status: 404 });
      }
    }

    const hasText = typeof text === "string" && text.trim().length > 0;
    const hasImage = !!imageFile;

    if (!patientId || (!hasText && !hasImage)) {
      if (!hasText && !hasImage) {
        return NextResponse.json({ error: "patientId and text or image are required" }, { status: 400 });
      }
    }

    const senderId = customSenderId || clientUserId;
    if (!senderId) {
      return NextResponse.json({ error: "senderId or clientUserId is required" }, { status: 400 });
    }
    const sanitizedBody = hasText ? text.trim().replace(/</g, "&lt;").replace(/>/g, "&gt;") : "📷 Photo";

    let attachmentUrl: string | null = null;
    let attachmentStoragePath: string | null = null;
    let attachmentType: string | null = null;
    let attachmentMeta: Record<string, unknown> | null = null;

    if (imageFile) {
      if (!imageFile.type.startsWith("image/") && !imageFile.type.startsWith("video/")) {
        return NextResponse.json({ error: "Only image/video allowed" }, { status: 400 });
      }
      if (imageFile.size > MAX_IMAGE_BYTES) {
        return NextResponse.json({ error: "Image too large (max 6MB after compression)" }, { status: 400 });
      }
      attachmentType = imageFile.type.startsWith("video/") ? "video" : "image";
      attachmentMeta = { size: imageFile.size, mime: imageFile.type };

      try {
        const ext = imageFile.name.split(".").pop() || "jpg";
        const storagePath = `${patientId}/${Date.now()}-${Math.random().toString(36).slice(2, 14)}.${ext}`;
        let uploadPayload: File | Buffer = imageFile;
        if (imageFile.type.startsWith("image/")) {
          try {
            const ab = await imageFile.arrayBuffer();
            let buf: Buffer = Buffer.from(ab);
            const sharp = (eval("require") as unknown as (m: string) => unknown)("sharp") as unknown as (b: Buffer) => { rotate: () => { withMetadata: (o: Record<string, unknown>) => { toBuffer: () => Promise<Buffer> } } };
            const processed = await sharp(buf).rotate().withMetadata({}).toBuffer();
            buf = processed;
            uploadPayload = buf;
          } catch {
            // fallback to original file - client canvas already stripped
          }
        }
        const { error: upErr } = await admin.storage.from(CHAT_BUCKET).upload(storagePath, uploadPayload as File, {
          contentType: imageFile.type,
          cacheControl: "3600",
          upsert: false,
        });
        if (!upErr) {
          attachmentStoragePath = storagePath;
          try {
            const { data: signed } = await admin.storage.from(CHAT_BUCKET).createSignedUrl(storagePath, 60 * 60);
            attachmentUrl = signed?.signedUrl || null;
          } catch {}
          if (!attachmentUrl) {
            try {
              const { data: signedRetry } = await admin.storage.from(CHAT_BUCKET).createSignedUrl(storagePath, 60 * 60);
              if (signedRetry?.signedUrl) attachmentUrl = signedRetry.signedUrl;
            } catch {}
          }
        } else {
          const buf = await imageFile.arrayBuffer();
          const b64 = Buffer.from(buf).toString("base64");
          attachmentUrl = `data:${imageFile.type};base64,${b64}`;
        }
      } catch {
        const buf = await imageFile.arrayBuffer();
        const b64 = Buffer.from(buf).toString("base64");
        attachmentUrl = `data:${imageFile.type};base64,${b64}`;
      }
    }

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

    if (insErr) {
      const errMsg = (insErr as { message?: string })?.message || "Failed to create message";
      return NextResponse.json({ error: errMsg }, { status: 500 });
    }

    return NextResponse.json({ error: "Failed to create message" }, { status: 500 });
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
    if (!admin) {
      return NextResponse.json({ error: "Service unavailable: database not configured" }, { status: 503 });
    }
    // Ownership check before delete: message -> patient -> owner
    const { data: row } = await admin.from("messages").select("patient_id, sender_id").eq("id", messageId).maybeSingle();
    if (row?.patient_id && hdrRequester) {
      const ok = await ownsPatientCheck(admin, row.patient_id as string, hdrRequester);
      if (!ok) return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    try {
      const { data: msgRow } = await admin.from("messages").select("attachment_storage_path").eq("id", messageId).maybeSingle();
      if (msgRow?.attachment_storage_path) {
        await admin.storage.from(CHAT_BUCKET).remove([msgRow.attachment_storage_path as string]);
      }
    } catch {}
    const { error: delErr } = await admin.from("messages").delete().eq("id", messageId);
    if (delErr) console.warn("Database message deletion error note:", delErr);

    return NextResponse.json({ success: true, deletedId: messageId });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
