import { json } from '../../_shared/response';
import { getSession } from '../../_shared/session';
import type { Env } from '../../_shared/types';

type UnsubscribeBody = {
  endpoint?: string;
};

export async function onRequestPost({ request, env }: { request: Request; env: Env }) {
  const session = await getSession(request, env);
  const body = (await request.json().catch(() => ({}))) as UnsubscribeBody;

  if (!session) {
    return json({ ok: false, error: 'Sessão inválida.' }, { status: 401 });
  }

  if (!env.DB) {
    return json({ ok: true });
  }

  if (!body.endpoint) {
    return json({ ok: false, error: 'Endpoint inválido.' }, { status: 400 });
  }

  await env.DB.prepare('DELETE FROM push_subscriptions WHERE endpoint = ?')
    .bind(body.endpoint)
    .run();

  return json({ ok: true });
}
