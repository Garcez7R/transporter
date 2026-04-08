import { json } from '../../_shared/response';
import { getSession } from '../../_shared/session';
import { logAudit } from '../../_shared/audit';
import type { Env } from '../../_shared/types';

type UpdateBody = {
  name?: string;
  document?: string;
  phone?: string;
  cep?: string;
  address?: string;
};

function normalizeDocument(value: string) {
  return value.replace(/\D/g, '');
}

function normalizeCep(value: string) {
  return value.replace(/\D/g, '');
}

function canManage(session: { role: string } | null) {
  return session && ['operador', 'gerente', 'administrador'].includes(session.role);
}

export async function onRequestPatch({ request, env, params }: { request: Request; env: Env; params: { id: string } }) {
  const session = await getSession(request, env);
  const body = (await request.json().catch(() => ({}))) as UpdateBody;
  const clientId = Number(params.id);

  if (!env.DB) return json({ ok: true });
  if (!canManage(session)) {
    return json({ ok: false, error: 'Sem permissão.' }, { status: 403 });
  }

  if (!clientId) {
    return json({ ok: false, error: 'ID inválido.' }, { status: 400 });
  }

  const current = await env.DB.prepare('SELECT id, document, name FROM clients WHERE id = ? LIMIT 1')
    .bind(clientId)
    .first<{ id: number; document: string; name: string }>();

  if (!current) {
    return json({ ok: false, error: 'Paciente não encontrado.' }, { status: 404 });
  }

  const updates: string[] = [];
  const values: unknown[] = [];
  const setField = (field: string, value: unknown) => {
    updates.push(`${field} = ?`);
    values.push(value);
  };

  if (body.name !== undefined) setField('name', body.name);
  if (body.document !== undefined) setField('document', normalizeDocument(body.document));
  if (body.phone !== undefined) setField('phone', body.phone);
  if (body.cep !== undefined) setField('cep', normalizeCep(body.cep));
  if (body.address !== undefined) setField('address', body.address);

  if (!updates.length) {
    return json({ ok: true });
  }

  values.push(clientId);
  await env.DB.prepare(`UPDATE clients SET ${updates.join(', ')} WHERE id = ?`)
    .bind(...values)
    .run();

  if (body.document) {
    await env.DB.prepare('UPDATE users SET document = ? WHERE document = ?')
      .bind(normalizeDocument(body.document), current.document)
      .run();
  }

  if (body.name) {
    await env.DB.prepare('UPDATE users SET name = ? WHERE document = ?')
      .bind(body.name, body.document ? normalizeDocument(body.document) : current.document)
      .run();
  }

  await logAudit(env, {
    entityType: 'client',
    action: 'patient.updated',
    details: `Paciente ${current.name} atualizado.`,
    actorRole: session?.role ?? null,
    actorName: session?.name ?? null,
    actorId: session?.user_id ?? null
  });

  return json({ ok: true });
}
