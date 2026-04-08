import { json } from '../../_shared/response';
import { bearerToken, sha256Hex } from '../../_shared/security';
import type { Env } from '../../_shared/types';

export async function onRequestGet({ request, env }: { request: Request; env: Env }) {
  const token = bearerToken(request);

  if (!token) {
    return json({ ok: false, error: 'Sessão não informada.' }, { status: 401 });
  }

  if (!env.DB) {
    return json({ ok: true, session: null });
  }

  const tokenHash = await sha256Hex(token);
  const session = await env.DB.prepare(
    'SELECT users.name, users.role, users.document, users.pin_must_change FROM sessions JOIN users ON users.id = sessions.user_id WHERE sessions.token_hash = ? AND sessions.expires_at > CURRENT_TIMESTAMP LIMIT 1'
  )
    .bind(tokenHash)
    .first<{ name: string; role: string; document: string; pin_must_change: number }>();

  if (!session) {
    return json({ ok: false, error: 'Sessão inválida ou expirada.' }, { status: 401 });
  }

  return json({
    ok: true,
    session: {
      name: session.name,
      role: session.role,
      document: session.document,
      mustChangePin: Boolean(session.pin_must_change)
    }
  });
}
