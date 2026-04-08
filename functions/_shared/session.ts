import { bearerToken, sha256Hex } from './security';
import type { Env } from './types';

export type SessionRecord = {
  user_id: number;
  name: string;
  role: string;
  document: string;
  pin_must_change: number;
};

export async function getSession(request: Request, env: Env) {
  const token = bearerToken(request);
  if (!token || !env.DB) return null;

  const tokenHash = await sha256Hex(token);
  const session = await env.DB.prepare(
    'SELECT users.id AS user_id, users.name, users.role, users.document, users.pin_must_change FROM sessions JOIN users ON users.id = sessions.user_id WHERE sessions.token_hash = ? AND sessions.expires_at > CURRENT_TIMESTAMP LIMIT 1'
  )
    .bind(tokenHash)
    .first<SessionRecord>();

  return session ?? null;
}

export async function requireSession(request: Request, env: Env) {
  const session = await getSession(request, env);
  if (!session) {
    throw new Response(JSON.stringify({ ok: false, error: 'Sessão inválida ou expirada.' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json; charset=utf-8' }
    });
  }

  return session;
}
