import { json } from '../../_shared/response';
import { getSession } from '../../_shared/session';
import type { Env } from '../../_shared/types';
import { sendWebPush } from '../../_shared/webpush';

type DispatchBody = {
  title?: string;
  body?: string;
  targetRole?: string;
  targetUserId?: number;
};

export async function onRequestPost({ request, env }: { request: Request; env: Env }) {
  const session = await getSession(request, env);
  const payload = (await request.json().catch(() => ({}))) as DispatchBody;

  if (!session) {
    return json({ ok: false, error: 'Sessão inválida.' }, { status: 401 });
  }

  if (!['gerente', 'administrador', 'operador'].includes(session.role)) {
    return json({ ok: false, error: 'Sem permissão para disparar notificações.' }, { status: 403 });
  }

  if (!payload.title || !payload.body) {
    return json({ ok: false, error: 'Título e mensagem são obrigatórios.' }, { status: 400 });
  }

  if (env.DB) {
    await env.DB.prepare(
      `INSERT INTO notification_events (title, body, target_role, target_user_id, created_by_role, created_by_name)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
      .bind(
        payload.title,
        payload.body,
        payload.targetRole ?? null,
        payload.targetUserId ?? null,
        session.role,
        session.name
      )
      .run();
    const rows = await env.DB.prepare(
      `SELECT endpoint, p256dh, auth
       FROM push_subscriptions
       WHERE (? IS NULL OR role = ?)
       AND (? IS NULL OR user_id = ?)`
    )
      .bind(payload.targetRole ?? null, payload.targetRole ?? null, payload.targetUserId ?? null, payload.targetUserId ?? null)
      .all();

    const subscriptions = (rows.results ?? []).map((row) => ({
      endpoint: String(row.endpoint),
      keys: {
        p256dh: String(row.p256dh),
        auth: String(row.auth)
      }
    }));

    const vapidPublicKey = env.VAPID_PUBLIC_KEY;
    const vapidPrivateKey = env.VAPID_PRIVATE_KEY;
    const vapidSubject = env.VAPID_SUBJECT ?? 'mailto:admin@transporter.app';

    if (vapidPublicKey && vapidPrivateKey && subscriptions.length) {
      await Promise.all(
        subscriptions.map((subscription) =>
          sendWebPush(
            subscription,
            {
              title: payload.title,
              body: payload.body,
              data: { url: '/' }
            },
            {
              vapidPublicKey,
              vapidPrivateKey,
              vapidSubject
            }
          ).catch(() => null)
        )
      );
    }
  }

  return json({ ok: true });
}
