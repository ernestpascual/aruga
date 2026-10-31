/**
 * HIPAA Technical Safeguards: Central Audit Logging (45 CFR § 164.312(b))
 *
 * Implements hardware/software procedural recording of access and modifications
 * to electronic Protected Health Information (ePHI).
 */

import { createAdminClient } from "@/lib/supabase/admin";
import { getMockStore } from "@/lib/supabase/mock-store";
import { AuditEvent } from "@/types/database";

export type HipaaAuditAction =
  | "EPHI_READ"
  | "EPHI_CREATE"
  | "EPHI_UPDATE"
  | "EPHI_DELETE"
  | "EPHI_TRANSFER"
  | "EPHI_AI_SYNTHESIS"
  | "EPHI_EXPORT"
  | "AUTH_LOGIN"
  | "AUTH_LOGOUT"
  | "AUTH_TIMEOUT";

export interface LogAuditParams {
  actorId?: string | null;
  userId?: string | null;
  userRole?: string | null;
  action: HipaaAuditAction | string;
  affectedResource?: string;
  resourceType?: string;
  resourceId?: string | null;
  patientId?: string | null;
  details?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  ipAddress?: string | null;
  userAgent?: string | null;
}

/**
 * Logs an ePHI audit event to the immutable public.audit_events table
 * and to the in-memory fallback store for offline/demo verification.
 */
export async function logAuditEvent(params: LogAuditParams): Promise<AuditEvent | null> {
  const effectiveActorId = params.actorId || params.userId || null;
  const effectiveResource = params.affectedResource || params.resourceType || "ephi_general";
  const mergedMetadata: Record<string, unknown> = {
    ...(params.metadata || {}),
    ...(params.details || {}),
    userRole: params.userRole || undefined,
    patientId: params.patientId || undefined,
    ip: params.ipAddress || undefined,
    ua: params.userAgent || undefined,
    auditTimestamp: new Date().toISOString(),
  };

  const eventPayload: AuditEvent = {
    id: `audit-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    actor_id: effectiveActorId,
    action: params.action,
    affected_resource: effectiveResource,
    resource_id: params.resourceId || null,
    metadata: mergedMetadata,
    created_at: new Date().toISOString(),
  };

  try {
    const admin = createAdminClient();
    if (admin) {
      await admin.from("audit_events").insert({
        actor_id: eventPayload.actor_id,
        action: eventPayload.action,
        affected_resource: eventPayload.affected_resource,
        resource_id: eventPayload.resource_id,
        metadata: eventPayload.metadata,
      });
    }

    // Always mirror in mock store for predictable test auditing
    const store = getMockStore();
    if (store && Array.isArray(store.auditEvents)) {
      store.auditEvents.push(eventPayload);
    }

    return eventPayload;
  } catch (err) {
    // Fail-open for clinical continuity, but log warning
    console.warn("HIPAA Audit Logging failed to persist event:", err);
    return null;
  }
}
