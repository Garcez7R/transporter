import { json } from '../_shared/response';
import { getSession } from '../_shared/session';
import { sha256Hex } from '../_shared/security';
import { logAudit } from '../_shared/audit';
import type { Env } from '../_shared/types';

type ClientBody = {
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

export async function onRequestGet({ request, env }: { request: Request; env: Env }) {
  const session = await getSession(request, env);
  if (!env.DB) return json({ ok: true, rows: [] });
  if (!canManage(session)) {
    return json({ ok: false, error: 'Sem permissão.' }, { status: 403 });
  }

  const url = new URL(request.url);
  const q = url.searchParams.get('q')?.trim() ?? '';
  const where = q ? 'WHERE name LIKE ? OR document LIKE ? OR phone LIKE ? OR cep LIKE ?' : '';
  const params = q ? [`%${q}%`, `%${normalizeDocument(q)}%`, `%${q}%`, `%${normalizeCep(q)}%`] : [];

  const result = await env.DB.prepare(
    `SELECT id, name, document, phone, cep, address, created_at AS createdAt
     FROM clients
     ${where}
     ORDER BY created_at DESC
     LIMIT 200`
  )
    .bind(...params)
    .all();

  return json({ ok: true, rows: result.results ?? [] });
}

export async function onRequestPost({ request, env }: { request: Request; env: Env }) {
  const session = await getSession(request, env);
  const body = (await request.json().catch(() => ({}))) as ClientBody;

  if (!env.DB) return json({ ok: true, row: null });
  if (!canManage(session)) {
    return json({ ok: false, error: 'Sem permissão.' }, { status: 403 });
  }

  if (!body.name || !body.document) {
    return json({ ok: false, error: 'Nome e CPF são obrigatórios.' }, { status: 400 });
  }

  const document = normalizeDocument(body.document);
  const existing = await env.DB.prepare('SELECT id FROM clients WHERE document = ? LIMIT 1')
    .bind(document)
    .first<{ id: number }>();

  if (existing) {
    return json({ ok: false, error: 'Já existe um paciente com esse CPF.' }, { status: 409 });
  }

  const result = await env.DB.prepare(
    'INSERT INTO clients (name, document, phone, cep, address) VALUES (?, ?, ?, ?, ?)'
  )
    .bind(body.name, document, body.phone ?? '', body.cep ? normalizeCep(body.cep) : '', body.address ?? '')
    .run();

  const existingUser = await env.DB.prepare('SELECT id FROM users WHERE document = ? LIMIT 1')
    .bind(document)
    .first<{ id: number }>();

  if (!existingUser) {
    await env.DB.prepare(
      'INSERT INTO users (role, name, document, pin_hash, pin_must_change) VALUES (?, ?, ?, ?, 1)'
    )
      .bind('cliente', body.name, document, await sha256Hex('0000'))
      .run();
  }

  await logAudit(env, {
    entityType: 'client',
    action: 'patient.created',
    details: `Paciente ${body.name} cadastrado.`,
    actorRole: session?.role ?? null,
    actorName: session?.name ?? null,
    actorId: session?.user_id ?? null
  });

  return json({
    ok: true,
    row: {
      id: result.meta.last_row_id,
      name: body.name,
      document,
      phone: body.phone ?? '',
      cep: body.cep ?? '',
      address: body.address ?? ''
    }
  });
}
