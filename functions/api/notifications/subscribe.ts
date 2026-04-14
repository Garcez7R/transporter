import { json } from '../../_shared/response';
import { getSession } from '../../_shared/session';
import type { Env } from '../../_shared/types';

type SubscribeBody = {
  endpoint?: string;
  keys?: {
    p256dh?: string;
    auth?: string;
  };
  userAgent?: string;
};

export async function onRequestPost({ request, env }: { request: Request; env: Env }) {
  const session = await getSession(request, env);
  const body = (await request.json().catch(() => ({}))) as SubscribeBody;

  if (!session) {
    return json({ ok: false, error: 'Sessão inválida.' }, { status: 401 });
  }

  if (!env.DB) {
    return json({ ok: true });
  }

  if (!body.endpoint || !body.keys?.p256dh || !body.keys?.auth) {
    return json({ ok: false, error: 'Subscription inválida.' }, { status: 400 });
  }

  await env.DB.prepare(
    `
      INSERT INTO push_subscriptions (user_id, role, endpoint, p256dh, auth, user_agent)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(endpoint) DO UPDATE SET
        user_id = excluded.user_id,
        role = excluded.role,
        p256dh = excluded.p256dh,
        auth = excluded.auth,
        user_agent = excluded.user_agent,
        updated_at = CURRENT_TIMESTAMP
    `
  )
    .bind(
      session.user_id ?? null,
      session.role,
      body.endpoint,
      body.keys.p256dh,
      body.keys.auth,
      body.userAgent ?? request.headers.get('user-agent') ?? null
    )
    .run();

  return json({ ok: true });
}
