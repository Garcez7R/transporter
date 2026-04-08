import { json } from '../_shared/response';
import { getSession } from '../_shared/session';
import { sha256Hex } from '../_shared/security';
import { logAudit } from '../_shared/audit';
import type { Env } from '../_shared/types';

type UserRole = 'cliente' | 'operador' | 'gerente' | 'motorista' | 'administrador';

type CreateUserBody = {
  name?: string;
  document?: string;
  role?: UserRole;
  pin?: string;
};

function normalizeDocument(value: string) {
  return value.replace(/\D/g, '');
}

export async function onRequestGet({ request, env }: { request: Request; env: Env }) {
  const session = await getSession(request, env);

  if (!env.DB) {
    return json({ ok: true, rows: [] });
  }

  if (!session || session.role !== 'administrador') {
    return json({ ok: false, error: 'Sem permissão.' }, { status: 403 });
  }

  const result = await env.DB.prepare(
    `SELECT id, role, name, document, pin_must_change AS pinMustChange, created_at AS createdAt, last_login_at AS lastLoginAt
     FROM users
     ORDER BY created_at DESC`
  ).all();

  return json({ ok: true, rows: result.results ?? [] });
}

export async function onRequestPost({ request, env }: { request: Request; env: Env }) {
  const session = await getSession(request, env);
  const body = (await request.json().catch(() => ({}))) as CreateUserBody;

  if (!env.DB) {
    return json({ ok: true, row: null });
  }

  if (!session || session.role !== 'administrador') {
    return json({ ok: false, error: 'Sem permissão.' }, { status: 403 });
  }

  if (!body.name || !body.document || !body.role) {
    return json({ ok: false, error: 'name, document e role são obrigatórios.' }, { status: 400 });
  }

  const document = normalizeDocument(body.document);
  const existing = await env.DB.prepare('SELECT id FROM users WHERE document = ? LIMIT 1')
    .bind(document)
    .first<{ id: number }>();

  if (existing) {
    return json({ ok: false, error: 'Já existe um usuário com esse documento.' }, { status: 409 });
  }

  const pin = body.pin?.trim() || '0000';
  const result = await env.DB.prepare(
    'INSERT INTO users (role, name, document, pin_hash, pin_must_change) VALUES (?, ?, ?, ?, 1)'
  )
    .bind(body.role, body.name, document, await sha256Hex(pin))
    .run();

  await logAudit(env, {
    entityType: 'user',
    action: 'user.created',
    details: `Usuário ${body.name} (${body.role}).`,
    actorRole: session.role,
    actorName: session.name,
    actorId: session.user_id
  });

  return json({
    ok: true,
    row: {
      id: result.meta.last_row_id,
      role: body.role,
      name: body.name,
      document
    }
  });
}
