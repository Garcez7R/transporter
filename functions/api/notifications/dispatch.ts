import { json } from '../../_shared/response';
import { getSession } from '../../_shared/session';
import type { Env } from '../../_shared/types';

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
  }

  return json({ ok: true });
}
