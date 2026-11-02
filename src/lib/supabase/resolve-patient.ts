import { createAdminClient } from "./admin";

/**
 * Resolve a raw patient identifier that may be either:
 * - patients.id (therapist flow, URL param)
 * - patients.client_user_id / profiles.id (client dashboard passes user.id)
 * Returns the canonical patients.id or null if not found.
 */
export async function resolvePatientId(
  admin: NonNullable<ReturnType<typeof createAdminClient>>,
  raw: string
): Promise<string | null> {
  if (!raw) return null;
  const { data: byId } = await admin.from("patients").select("id").eq("id", raw).maybeSingle();
  if (byId?.id) return byId.id;
  const { data: byClient } = await admin.from("patients").select("id").eq("client_user_id", raw).maybeSingle();
  if (byClient?.id) return byClient.id;
  // No mock fallback — return null so callers can surface a proper error (404 / not found).
  return null;
}
