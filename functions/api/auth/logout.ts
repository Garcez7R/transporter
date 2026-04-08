import { json } from '../../_shared/response';
import { bearerToken, sha256Hex } from '../../_shared/security';
import type { Env } from '../../_shared/types';

export async function onRequestPost({ request, env }: { request: Request; env: Env }) {
  const token = bearerToken(request);

  if (!token) {
    return json({ ok: true });
  }

  if (!env.DB) {
    return json({ ok: true });
  }

  const tokenHash = await sha256Hex(token);
  await env.DB.prepare('DELETE FROM sessions WHERE token_hash = ?').bind(tokenHash).run();

  return json({ ok: true });
}
