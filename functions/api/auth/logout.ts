import { json } from '../../_shared/response';
import { bearerToken, sha256Hex } from '../../_shared/security';
import { getSession } from '../../_shared/session';
import { logAudit } from '../../_shared/audit';
import type { Env } from '../../_shared/types';

export async function onRequestPost({ request, env }: { request: Request; env: Env }) {
  const token = bearerToken(request);

  if (!token) {
    return json({ ok: true });
  }

  if (!env.DB) {
    return json({ ok: true });
  }

  const session = await getSession(request, env);
  const tokenHash = await sha256Hex(token);
  await env.DB.prepare('DELETE FROM sessions WHERE token_hash = ?').bind(tokenHash).run();

  if (session) {
    await logAudit(env, {
      entityType: 'session',
      action: 'auth.logout',
      details: `Logout de ${session.name} (${session.role}).`,
      actorRole: session.role,
      actorName: session.name,
      actorId: session.user_id
    });
  }

  return json({ ok: true });
}
