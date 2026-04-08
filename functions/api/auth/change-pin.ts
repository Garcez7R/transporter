import { json } from '../../_shared/response';
import { bearerToken, sha256Hex } from '../../_shared/security';
import type { Env } from '../../_shared/types';

type Body = {
  newPin?: string;
};

export async function onRequestPost({ request, env }: { request: Request; env: Env }) {
  const token = bearerToken(request);
  const body = (await request.json().catch(() => ({}))) as Body;
  const newPin = body.newPin?.trim() ?? '';

  if (!token) {
    return json({ ok: false, error: 'Sessão não informada.' }, { status: 401 });
  }

  if (!newPin || newPin.length < 4) {
    return json({ ok: false, error: 'O novo PIN deve ter ao menos 4 dígitos.' }, { status: 400 });
  }

  if (!env.DB) {
    return json({ ok: true, mustChangePin: false });
  }

  const tokenHash = await sha256Hex(token);
  const session = await env.DB.prepare(
    'SELECT sessions.user_id, users.id FROM sessions JOIN users ON users.id = sessions.user_id WHERE sessions.token_hash = ? AND sessions.expires_at > CURRENT_TIMESTAMP LIMIT 1'
  )
    .bind(tokenHash)
    .first<{ user_id: number; id: number }>();

  if (!session) {
    return json({ ok: false, error: 'Sessão inválida ou expirada.' }, { status: 401 });
  }

  await env.DB.batch([
    env.DB.prepare('UPDATE users SET pin_hash = ?, pin_must_change = 0, last_pin_change_at = CURRENT_TIMESTAMP WHERE id = ?').bind(
      await sha256Hex(newPin),
      session.user_id
    ),
  ]);

  return json({ ok: true, mustChangePin: false });
}
