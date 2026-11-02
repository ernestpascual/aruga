import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ownsPatient } from "@/lib/supabase/owner";
import { createClient as createServerClient } from "@/lib/supabase/server";

function maskEmail(e?: string | null): string | undefined {
  if (!e) return undefined;
  const at = e.indexOf("@");
  if (at <= 0) return e;
  const local = e.slice(0, at);
  const domain = e.slice(at + 1);
  return `${local[0]}***@${domain}`;
}

async function ownsPatientCheckNotif(admin: NonNullable<ReturnType<typeof createAdminClient>>, patientId: string, requesterId: string) {
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

export interface AppNotification {
  id: string;
  type: "client_link_request" | "therapist_invitation" | "pending_status" | "info";
  title: string;
  description: string;
  timestamp: string;
  patientId: string;
  patientName?: string;
  patientEmail?: string;
  patientCondition?: string;
  patientAge?: number;
  caregiverName?: string | null;
  therapistId?: string;
  therapistName?: string;
  therapistDiscipline?: string;
  initiatedBy: "therapist" | "client";
  status: "pending" | "accepted" | "declined";
  actionRequired: boolean;
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    let role = searchParams.get("role") as "therapist" | "client" | null;
    let userId = searchParams.get("userId");

    // Attempt to authenticate from session if not explicitly provided
    if (!userId || !role) {
      try {
        const serverClient = await createServerClient();
        if (serverClient) {
          const {
            data: { user },
          } = await serverClient.auth.getUser();
          if (user) {
            userId = userId || user.id;
            role = (role || user.user_metadata?.role || "therapist") as "therapist" | "client";
          }
        }
      } catch {
        // Fallback to query params
      }
    }

    if (!role) {
      role = "therapist";
    }

    const admin = createAdminClient();
    if (!admin) {
      return NextResponse.json({ error: "Database not configured" }, { status: 503 });
    }

    const notifications: AppNotification[] = [];

    // Impersonation guard: if session exists, enforce userId == session user id
    try {
      const serverClient = await createServerClient();
      if (serverClient) {
        const { data: { user } } = await serverClient.auth.getUser();
        if (user?.id && userId && user.id !== userId) {
          return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }
      }
    } catch {}

    if (role === "therapist") {
      // Keep isDemo header handling as optional (no mock fallback)
      const _isDemoNotifTherapist = searchParams.get("isDemo") === "true" || req.headers.get("x-demo-mode") === "true";
      const therapistId = userId;
      if (!therapistId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

      // Resolve therapist's email
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

      // Fetch all pending patients assigned to this therapist ID
      const { data: patientsByTherapistId } = await admin
        .from("patients")
        .select("*")
        .eq("therapist_id", therapistId)
        .eq("invitation_status", "pending")
        .order("created_at", { ascending: false });

      // Also fetch any pending patients by pending_therapist_email
      let patientsByPendingEmail: any[] = [];
      if (therapistEmail) {
        try {
          const { data: byEmail } = await admin
            .from("patients")
            .select("*")
            .ilike("pending_therapist_email", therapistEmail)
            .eq("invitation_status", "pending")
            .order("created_at", { ascending: false });
          if (byEmail) patientsByPendingEmail = byEmail;
        } catch {
          // ignore
        }
      }

      const combinedPatientsMap = new Map<string, any>();
      if (patientsByTherapistId) {
        patientsByTherapistId.forEach((p) => combinedPatientsMap.set(p.id, p));
      }
      if (patientsByPendingEmail.length > 0) {
        for (const p of patientsByPendingEmail) {
          if (!combinedPatientsMap.has(p.id)) {
            if (p.therapist_id !== therapistId) {
              admin.from("patients").update({ therapist_id: therapistId }).eq("id", p.id).then();
              p.therapist_id = therapistId;
            }
            combinedPatientsMap.set(p.id, p);
          }
        }
      }

      const patients = Array.from(combinedPatientsMap.values());

      if (patients.length > 0) {
        for (const p of patients) {
          const isClientInitiated = p.invitation_initiated_by === "client" || (!p.invitation_initiated_by && !!p.pending_therapist_email);
          notifications.push({
            id: `notif-pat-${p.id}`,
            type: isClientInitiated ? "client_link_request" : "pending_status",
            title: isClientInitiated
              ? "Incoming Client Link Request"
              : "Invitation Sent — Awaiting Client Acceptance",
            description: isClientInitiated
              ? `${p.name} (${maskEmail(p.email) || p.email}) requested to connect to your caseload for ${p.condition || "rehabilitation care"}.`
              : `Invitation sent to ${p.name} (${maskEmail(p.email) || p.email}). Waiting for client to confirm in their portal.`,
            timestamp: p.invitation_sent_at || p.created_at || new Date().toISOString(),
            patientId: p.id,
            patientName: p.name,
            patientEmail: maskEmail(p.email),
            patientCondition: p.condition,
            patientAge: p.age,
            caregiverName: p.caregiver_name,
            initiatedBy: (p.invitation_initiated_by as "therapist" | "client") || "client",
            status: "pending",
            actionRequired: isClientInitiated,
          });
        }
      }
    } else {
      // Client role: find patient record for this user
      const _isDemoNotifClient = searchParams.get("isDemo") === "true" || req.headers.get("x-demo-mode") === "true";
      const clientUserId = userId;
      if (!clientUserId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      let patient = null;

      const { data: byUser } = await admin
        .from("patients")
        .select("*")
        .eq("client_user_id", clientUserId)
        .maybeSingle();

      patient = byUser;

      // Try matching by email if not found by client_user_id
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
              patient = byEmail;
            }
          }
        } catch {
          // ignore
        }
      }

      if (patient && patient.invitation_status === "pending" && patient.therapist_id) {
        // Fetch therapist profile info
        const { data: therapistProfile } = await admin
          .from("profiles")
          .select("id, display_name, discipline")
          .eq("id", patient.therapist_id)
          .maybeSingle();

        const therapistName = therapistProfile?.display_name || "Your Clinician";
        const therapistDiscipline = therapistProfile?.discipline || "OT";
        const isTherapistInitiated = patient.invitation_initiated_by === "therapist";

        notifications.push({
          id: `notif-pat-${patient.id}`,
          type: isTherapistInitiated ? "therapist_invitation" : "pending_status",
          title: isTherapistInitiated
            ? "Clinician Care Connection Request"
            : "Connection Request Pending",
          description: isTherapistInitiated
            ? `${therapistName} (${therapistDiscipline}) invited you to link with their rehabilitation caseload.`
            : `Connection request sent to ${therapistName}. Waiting for clinician confirmation.`,
          timestamp: patient.invitation_sent_at || patient.created_at || new Date().toISOString(),
          patientId: patient.id,
          patientName: patient.name,
          patientEmail: maskEmail(patient.email),
          therapistId: patient.therapist_id,
          therapistName,
          therapistDiscipline,
          initiatedBy: (patient.invitation_initiated_by as "therapist" | "client") || "therapist",
          status: "pending",
          actionRequired: isTherapistInitiated,
        });
      }
    }

    const unreadCount = notifications.filter((n) => n.actionRequired).length;
    return NextResponse.json({
      notifications,
      unreadCount,
      role,
      count: notifications.length,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  // Handles in-app approval or declining of link requests / invitations
  try {
    const body = await req.json();
    const { patientId, action, role } = body;

    if (!patientId) {
      return NextResponse.json({ error: "patientId is required" }, { status: 400 });
    }

    if (!action || !["approve", "accept", "decline"].includes(action)) {
      return NextResponse.json(
        { error: "action must be 'approve', 'accept', or 'decline'" },
        { status: 400 }
      );
    }

    const newStatus = action === "decline" ? "declined" : "accepted";
    const admin = createAdminClient();
    if (!admin) {
      return NextResponse.json({ error: "Database not configured" }, { status: 503 });
    }

    let postReqId: string | null = (body.requesterId || body.userId || req.headers.get("x-requester-id")) as string | null;
    if (!postReqId) {
      try {
        const serverClient = await createServerClient();
        if (serverClient) {
          const { data: { user } } = await serverClient.auth.getUser();
          if (user?.id) postReqId = user.id;
        }
      } catch {}
    }
    if (postReqId) {
      const okPost = await ownsPatientCheckNotif(admin, patientId, postReqId);
      if (!okPost) return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    const { data: updatedPatient, error } = await admin
      .from("patients")
      .update({
        invitation_status: newStatus,
        updated_at: new Date().toISOString(),
      })
      .eq("id", patientId)
      .select()
      .single();

    if (error) {
      if (error.code === "PGRST116" || error.message.includes("0 rows")) {
        return NextResponse.json(
          { error: "We couldn't find this care connection request. It may have already been accepted, declined, or canceled." },
          { status: 404 }
        );
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // If accepted and patient has client_user_id, sync clinician_name on client's profile
    if (newStatus === "accepted" && updatedPatient?.client_user_id && updatedPatient?.therapist_id) {
      const { data: therapistProfile } = await admin
        .from("profiles")
        .select("display_name")
        .eq("id", updatedPatient.therapist_id)
        .maybeSingle();

      if (therapistProfile?.display_name) {
        await admin
          .from("profiles")
          .update({ clinician_name: therapistProfile.display_name })
          .eq("id", updatedPatient.client_user_id);
      }
    }

    return NextResponse.json({
      success: true,
      message:
        newStatus === "accepted"
          ? "Care connection confirmed and active."
          : "Connection request declined.",
      status: newStatus,
      patient: updatedPatient,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
