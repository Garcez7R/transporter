import { json } from '../../_shared/response';
import { getSession } from '../../_shared/session';
import { sha256Hex } from '../../_shared/security';
import { logAudit } from '../../_shared/audit';
import type { Env } from '../../_shared/types';

type Body = {
  resetPin?: boolean;
};

function canReset(sessionRole: string, targetRole: string) {
  if (sessionRole === 'administrador') return true;
  if (sessionRole === 'gerente') return targetRole === 'operador' || targetRole === 'cliente';
  if (sessionRole === 'operador') return targetRole === 'cliente';
  return false;
}

export async function onRequestPatch({ request, env, params }: { request: Request; env: Env; params: { id: string } }) {
  const session = await getSession(request, env);
  const body = (await request.json().catch(() => ({}))) as Body;
  const userId = Number(params.id);

  if (!session) {
    return json({ ok: false, error: 'Sessão inválida.' }, { status: 401 });
  }

  if (!env.DB) {
    return json({ ok: true });
  }

  if (!userId || !body.resetPin) {
    return json({ ok: false, error: 'Requisição inválida.' }, { status: 400 });
  }

  const target = await env.DB.prepare('SELECT id, name, role, document FROM users WHERE id = ? LIMIT 1')
    .bind(userId)
    .first<{ id: number; name: string; role: string; document: string }>();

  if (!target) {
    return json({ ok: false, error: 'Usuário não encontrado.' }, { status: 404 });
  }

  if (!canReset(session.role, target.role)) {
    return json({ ok: false, error: 'Sem permissão para resetar este PIN.' }, { status: 403 });
  }

  await env.DB.prepare(
    'UPDATE users SET pin_hash = ?, pin_must_change = 1, last_pin_change_at = CURRENT_TIMESTAMP WHERE id = ?'
  )
    .bind(await sha256Hex('0000'), target.id)
    .run();

  await logAudit(env, {
    entityType: 'user',
    action: 'pin.reset',
    details: `PIN resetado para ${target.name} (${target.role}).`,
    actorRole: session.role,
    actorName: session.name,
    actorId: session.user_id
  });

  return json({ ok: true });
}
