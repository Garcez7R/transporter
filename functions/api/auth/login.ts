import { json } from '../../_shared/response';
import { createSessionToken, sha256Hex } from '../../_shared/security';
import type { Env } from '../../_shared/types';

type LoginBody = {
  document?: string;
  pin?: string;
};

function normalizeDocument(value: string) {
  return value.replace(/\D/g, '');
}

export async function onRequestPost({ request, env }: { request: Request; env: Env }) {
  const body = (await request.json().catch(() => ({}))) as LoginBody;
  const document = normalizeDocument(body.document ?? '');
  const pin = body.pin ?? '';

  if (!document || !pin) {
    return json({ ok: false, error: 'Documento e PIN são obrigatórios.' }, { status: 400 });
  }

  if (!env.DB) {
    return json({
      ok: true,
      session: {
        name: 'Demo',
        role: 'operador',
        document,
        mustChangePin: true,
        token: createSessionToken()
      }
    });
  }

  const user = await env.DB.prepare(
    'SELECT id, role, name, document, pin_hash, pin_must_change FROM users WHERE document = ? LIMIT 1'
  )
    .bind(document)
    .first<{
      id: number;
      role: string;
      name: string;
      document: string;
      pin_hash: string;
      pin_must_change: number;
    }>();

  if (!user) {
    return json({ ok: false, error: 'Usuário não encontrado.' }, { status: 404 });
  }

  const expectedPin = await sha256Hex(pin);
  if (user.pin_hash !== expectedPin) {
    return json({ ok: false, error: 'PIN inválido.' }, { status: 401 });
  }

  const token = createSessionToken();
  const tokenHash = await sha256Hex(token);
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 12).toISOString();

  await env.DB.batch([
    env.DB.prepare('INSERT INTO sessions (user_id, token_hash, expires_at) VALUES (?, ?, ?)').bind(
      user.id,
      tokenHash,
      expiresAt
    ),
    env.DB.prepare('UPDATE users SET last_login_at = CURRENT_TIMESTAMP WHERE id = ?').bind(user.id)
  ]);

  return json({
    ok: true,
    session: {
      name: user.name,
      role: user.role,
      document: user.document,
      mustChangePin: Boolean(user.pin_must_change),
      token
    }
  });
}
