import type { Env } from './types';
import { sendSplunkEvent } from './logging';

type AuditEntry = {
  tripRequestId?: number | null;
  entityType: string;
  action: string;
  details?: string;
  actorRole?: string | null;
  actorName?: string | null;
  actorId?: number | null;
};

export async function logAudit(env: Env, entry: AuditEntry) {
  if (!env.DB) return;

  try {
    await env.DB.prepare(
      `INSERT INTO audit_log (
        trip_request_id,
        entity_type,
        action,
        details,
        actor_role,
        actor_name,
        actor_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
      .bind(
        entry.tripRequestId ?? null,
        entry.entityType,
        entry.action,
        entry.details ?? null,
        entry.actorRole ?? null,
        entry.actorName ?? null,
        entry.actorId ?? null
      )
      .run();

    await sendSplunkEvent(env, entry);
  } catch {
    // ignore audit logging failures to avoid breaking the main flow
  }
}
