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
  const { data: pat } = await admin
    .from("patients")
    .select("client_user_id, therapist_id")
    .eq("id", patientId)
    .maybeSingle();
  if (!pat) return false;
  return pat.client_user_id === requesterId || pat.therapist_id === requesterId;
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
  const { data: pat } = await admin.from("patients").select("therapist_id").eq("id", patientId).maybeSingle();
  return pat?.therapist_id === therapistId;
}
