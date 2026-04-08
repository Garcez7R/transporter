import { json } from '../../_shared/response';
import { getSession } from '../../_shared/session';
import { sha256Hex } from '../../_shared/security';
import type { Env } from '../../_shared/types';

type UpdateBody = {
  status?: string;
  driver?: string;
  vehicle?: string;
  notes?: string;
  companions?: string;
  boardingPoint?: string;
  departureAt?: string;
  arrivalEta?: string;
  phoneVisible?: boolean;
  clientConfirmedAt?: string;
  pinStatus?: string;
  message?: string;
};

type RequestDetail = {
  id: string;
  protocol: string;
  clientName: string;
  document: string;
  phone: string;
  destination: string;
  boardingPoint: string;
  departureAt: string;
  arrivalEta: string;
  status: string;
  driver: string;
  vehicle: string;
  notes: string;
  companions: string;
  phoneVisible: boolean;
  pinStatus: string;
  clientConfirmedAt: string | null;
  messages: Array<{
    id: number;
    author: string;
    role: string;
    body: string;
    at: string;
    internal: number;
  }>;
  audit: Array<{
    id: number;
    label: string;
    at: string;
  }>;
};

function resolveRequestId(params: { id: string }) {
  return Number(params.id);
}

async function fetchDetail(env: Env, requestId: number) {
  const row = await env.DB!.prepare(
    `
      SELECT
        trip_requests.id,
        trip_requests.protocol,
        clients.name AS clientName,
        clients.document AS document,
        trip_requests.client_phone AS phone,
        trip_requests.destination,
        trip_requests.boarding_point AS boardingPoint,
        trip_requests.departure_at AS departureAt,
        trip_requests.arrival_eta AS arrivalEta,
        trip_requests.status,
        COALESCE(driver.name, '') AS driver,
        COALESCE(vehicle.plate, '') AS vehicle,
        COALESCE(trip_requests.notes, '') AS notes,
        COALESCE(trip_requests.companions, '') AS companions,
        trip_requests.phone_visible AS phoneVisible,
        trip_requests.client_pin_status AS pinStatus,
        trip_requests.client_confirmed_at AS clientConfirmedAt
      FROM trip_requests
      JOIN clients ON clients.id = trip_requests.client_id
      LEFT JOIN users AS driver ON driver.id = trip_requests.driver_id
      LEFT JOIN vehicles AS vehicle ON vehicle.id = trip_requests.vehicle_id
      WHERE trip_requests.id = ?
      LIMIT 1
    `
  )
    .bind(requestId)
    .first<Record<string, unknown>>();

  if (!row) return null;

  const messagesResult = await env.DB!.prepare(
    `SELECT id, author_name AS author, author_role AS role, body, created_at AS at, is_internal AS internal
     FROM messages
     WHERE trip_request_id = ?
     ORDER BY created_at DESC`
  )
    .bind(requestId)
    .all();

  const auditResult = await env.DB!.prepare(
    `SELECT id, next_status AS label, created_at AS at
     FROM status_history
     WHERE trip_request_id = ?
     ORDER BY created_at DESC`
  )
    .bind(requestId)
    .all();

  return {
    id: String(row.id),
    protocol: String(row.protocol),
    clientName: String(row.clientName),
    document: String(row.document),
    phone: String(row.phone ?? ''),
    destination: String(row.destination),
    boardingPoint: String(row.boardingPoint),
    departureAt: String(row.departureAt),
    arrivalEta: String(row.arrivalEta ?? ''),
    status: String(row.status),
    driver: String(row.driver ?? ''),
    vehicle: String(row.vehicle ?? ''),
    notes: String(row.notes ?? ''),
    companions: String(row.companions ?? ''),
    phoneVisible: Boolean(row.phoneVisible),
    pinStatus: String(row.pinStatus ?? 'first_access'),
    clientConfirmedAt: (row.clientConfirmedAt as string | null) ?? null,
    messages: (messagesResult.results ?? []).map((item) => ({
      id: Number((item as Record<string, unknown>).id),
      author: String((item as Record<string, unknown>).author),
      role: String((item as Record<string, unknown>).role),
      body: String((item as Record<string, unknown>).body),
      at: String((item as Record<string, unknown>).at),
      internal: Number((item as Record<string, unknown>).internal)
    })),
    audit: (auditResult.results ?? []).map((item) => ({
      id: Number((item as Record<string, unknown>).id),
      label: String((item as Record<string, unknown>).label),
      at: String((item as Record<string, unknown>).at)
    }))
  } as RequestDetail;
}

export async function onRequestGet({ request, env, params }: { request: Request; env: Env; params: { id: string } }) {
  const session = await getSession(request, env);
  const requestId = resolveRequestId(params);

  if (!requestId) {
    return json({ ok: false, error: 'ID inválido.' }, { status: 400 });
  }

  if (!env.DB) {
    return json({ ok: true, item: null });
  }

  const detail = await fetchDetail(env, requestId);
  if (!detail) {
    return json({ ok: false, error: 'Solicitação não encontrada.' }, { status: 404 });
  }

  if (session?.role === 'cliente' && detail.document.replace(/\D/g, '') !== session.document.replace(/\D/g, '')) {
    return json({ ok: false, error: 'Sem permissão para visualizar esta solicitação.' }, { status: 403 });
  }

  return json({ ok: true, item: detail });
}

export async function onRequestPatch({ request, env, params }: { request: Request; env: Env; params: { id: string } }) {
  const session = await getSession(request, env);
  const body = (await request.json().catch(() => ({}))) as UpdateBody;
  const requestId = resolveRequestId(params);

  if (!requestId) {
    return json({ ok: false, error: 'ID inválido.' }, { status: 400 });
  }

  if (!env.DB) {
    return json({ ok: true, id: requestId, patch: body });
  }

  const current = await fetchDetail(env, requestId);
  if (!current) {
    return json({ ok: false, error: 'Solicitação não encontrada.' }, { status: 404 });
  }

  if (session?.role === 'cliente' && current.document.replace(/\D/g, '') !== session.document.replace(/\D/g, '')) {
    return json({ ok: false, error: 'Sem permissão para editar esta solicitação.' }, { status: 403 });
  }

  if (session?.role === 'motorista' && body.status && !['em_rota', 'concluida'].includes(body.status)) {
    return json({ ok: false, error: 'Motorista só pode atualizar status operacional.' }, { status: 403 });
  }

  const updates: string[] = [];
  const values: unknown[] = [];
  const setField = (field: string, value: unknown) => {
    updates.push(`${field} = ?`);
    values.push(value);
  };

  if (body.status) setField('status', body.status);
  if (body.driver !== undefined) setField('driver_id', body.driver ? await resolveDriverId(env, body.driver) : null);
  if (body.vehicle !== undefined) setField('vehicle_id', body.vehicle ? await resolveVehicleId(env, body.vehicle) : null);
  if (body.notes !== undefined) setField('notes', body.notes);
  if (body.companions !== undefined) setField('companions', body.companions);
  if (body.boardingPoint !== undefined) setField('boarding_point', body.boardingPoint);
  if (body.departureAt !== undefined) setField('departure_at', body.departureAt);
  if (body.arrivalEta !== undefined) setField('arrival_eta', body.arrivalEta);
  if (body.phoneVisible !== undefined) setField('phone_visible', body.phoneVisible ? 1 : 0);
  if (body.clientConfirmedAt !== undefined) setField('client_confirmed_at', body.clientConfirmedAt);
  if (body.pinStatus !== undefined) setField('client_pin_status', body.pinStatus);

  if (updates.length) {
    setField('updated_at', new Date().toISOString());
    values.push(requestId);

    await env.DB.prepare(`UPDATE trip_requests SET ${updates.join(', ')} WHERE id = ?`)
      .bind(...values)
      .run();
  }

  if (body.message?.trim()) {
    await env.DB.prepare(
      'INSERT INTO messages (trip_request_id, author_role, author_name, body, is_internal) VALUES (?, ?, ?, ?, ?)'
    )
      .bind(
        requestId,
        session?.role ?? 'operador',
        session?.name ?? 'Equipe Operação',
        body.message.trim(),
        session?.role !== 'cliente' ? 1 : 0
      )
      .run();
  }

  if (body.status && body.status !== current.status) {
    await env.DB.prepare(
      'INSERT INTO status_history (trip_request_id, previous_status, next_status, changed_by_role, changed_by_name) VALUES (?, ?, ?, ?, ?)'
    )
      .bind(requestId, current.status, body.status, session?.role ?? 'operador', session?.name ?? 'Equipe Operação')
      .run();
  }

  if (body.pinStatus === 'reset') {
    await env.DB.prepare(
      'UPDATE users SET pin_hash = ?, pin_must_change = 1, last_pin_change_at = CURRENT_TIMESTAMP WHERE document = ?'
    )
      .bind(
        await sha256Hex('0000'),
        current.document.replace(/\D/g, '')
      )
      .run();
  }

  return json({ ok: true });
}

async function resolveDriverId(env: Env, value: string) {
  const numeric = Number(value);
  if (Number.isFinite(numeric) && numeric > 0) return numeric;

  const result = await env.DB!.prepare('SELECT id FROM users WHERE name = ? LIMIT 1').bind(value).first<{ id: number }>();
  return result?.id ?? null;
}

async function resolveVehicleId(env: Env, value: string) {
  const numeric = Number(value);
  if (Number.isFinite(numeric) && numeric > 0) return numeric;

  const result = await env.DB!.prepare('SELECT id FROM vehicles WHERE plate = ? OR model = ? LIMIT 1')
    .bind(value, value)
    .first<{ id: number }>();
  return result?.id ?? null;
}
