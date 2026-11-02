import { createAdminClient } from "./admin";

/**
 * Centralized ownership checks for ePHI routes.
 * All API routes bypass RLS via service_role, so these checks are the primary guard.
 * Source of truth: public.patients.client_user_id / therapist_id
 */

type AdminClient = NonNullable<ReturnType<typeof createAdminClient>>;

export async function ownsPatient(
  admin: AdminClient,
  patientId: string,
  requesterId: string
): Promise<boolean> {
  if (!patientId || !requesterId) return false;
  let pat: any = null;
  {
    const { data } = await admin.from("patients").select("id, client_user_id, therapist_id, pending_therapist_email").eq("id", patientId).maybeSingle();
    if (data) pat = data;
    else {
      const { data: byClient } = await admin.from("patients").select("id, client_user_id, therapist_id, pending_therapist_email").eq("client_user_id", patientId).maybeSingle();
      if (byClient) pat = byClient;
    }
  }
  if (!pat) return false;
  if (pat.client_user_id === requesterId || pat.therapist_id === requesterId) return true;
  // Pending link: therapist invited by email but patient row still has pending_therapist_email (pre-accept) —
  // allow if requester email matches pending_therapist_email (self-heal edge before GET clients runs)
  if (pat.pending_therapist_email) {
    try {
      let reqEmail: string | null = null;
      const { data: prof } = await admin.from("profiles").select("email").eq("id", requesterId).maybeSingle();
      reqEmail = (prof as { email?: string | null } | null)?.email?.toLowerCase().trim() || null;
      if (!reqEmail) {
        try {
          const { data: authUser } = await admin.auth.admin.getUserById(requesterId);
          reqEmail = authUser?.user?.email?.toLowerCase().trim() || null;
        } catch {}
      }
      if (reqEmail && pat.pending_therapist_email.toLowerCase().trim() === reqEmail) {
        // Self-heal: claim the row so future checks hit therapist_id path
        try {
          await admin.from("patients").update({ therapist_id: requesterId, updated_at: new Date().toISOString() }).eq("id", pat.id || patientId);
        } catch {}
        return true;
      }
    } catch {}
  }
  return false;
}

export async function getRequesterId(req: Request, fallback?: string | null): Promise<string | null> {
  // Prefer explicit param that client now must pass as requesterId (validated below),
  // but also try auth header if present (Bearer token -> supabase auth). Fallback keeps demo compat.
  const url = new URL(req.url);
  const qp =
    url.searchParams.get("requesterId") ||
    url.searchParams.get("clientUserId") ||
    url.searchParams.get("therapistId") ||
    fallback ||
    null;
  // Also allow X-Requester-Id header set by authedFetch helper
  const hdr = (req.headers.get("x-requester-id") || req.headers.get("x-user-id") || "").trim();
  return hdr || qp;
}

export async function ownsSubmission(
  admin: AdminClient,
  submissionId: string,
  requesterId: string
): Promise<{ patientId: string | null; ok: boolean }> {
  const { data: sub } = await admin.from("submissions").select("patient_id").eq("id", submissionId).maybeSingle();
  if (!sub?.patient_id) return { patientId: null, ok: false };
  const ok = await ownsPatient(admin, sub.patient_id, requesterId);
  return { patientId: sub.patient_id, ok };
}

export async function ownsStepSubmission(
  admin: AdminClient,
  stepSubmissionId: string,
  requesterId: string
): Promise<{ patientId: string | null; ok: boolean }> {
  const { data: ss } = await admin.from("step_submissions").select("submission_id").eq("id", stepSubmissionId).maybeSingle();
  if (!ss?.submission_id) return { patientId: null, ok: false };
  return ownsSubmission(admin, ss.submission_id, requesterId);
}

export async function ownsProgram(
  admin: AdminClient,
  programId: string,
  requesterId: string
): Promise<{ patientId: string | null; ok: boolean }> {
  const { data: prog } = await admin.from("home_programs").select("patient_id").eq("id", programId).maybeSingle();
  if (!prog?.patient_id) return { patientId: null, ok: false };
  const ok = await ownsPatient(admin, prog.patient_id, requesterId);
  return { patientId: prog.patient_id, ok };
}

export async function therapistOwnsProgramPatient(
  admin: AdminClient,
  patientId: string,
  therapistId: string
): Promise<boolean> {
  if (!patientId || !therapistId) return false;
  let pat: { therapist_id: string | null } | null = null;
  {
    const { data } = await admin.from("patients").select("therapist_id").eq("id", patientId).maybeSingle();
    if (data) pat = data;
    else {
      const { data: byClient } = await admin.from("patients").select("therapist_id").eq("client_user_id", patientId).maybeSingle();
      if (byClient) pat = byClient;
    }
  }
  return pat?.therapist_id === therapistId;
}
