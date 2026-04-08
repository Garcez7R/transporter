import { json } from '../_shared/response';
import { getSession } from '../_shared/session';
import type { Env } from '../_shared/types';

type CreateRequestBody = {
  clientName?: string;
  document?: string;
  phone?: string;
  destination?: string;
  boardingPoint?: string;
  departureAt?: string;
  arrivalEta?: string;
  notes?: string;
  companions?: string;
};

type RequestRow = {
  id: number;
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
  phoneVisible: number;
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

function normalizeDocument(value: string) {
  return value.replace(/\D/g, '');
}

function createProtocol(index: number) {
  const year = new Date().getFullYear();
  return `TRP-${year}-${String(index).padStart(5, '0')}`;
}

async function mapRequestRows(env: Env, rows: Array<Record<string, unknown>>) {
  const requestIds = rows.map((row) => Number(row.id)).filter(Boolean);

  const messages: Array<Record<string, unknown>> = [];
  const audit: Array<Record<string, unknown>> = [];

  if (env.DB && requestIds.length) {
    const placeholderList = requestIds.map(() => '?').join(', ');

    const messageResult = await env.DB.prepare(
      `SELECT id, trip_request_id, author_name AS author, author_role AS role, body, created_at AS at, is_internal AS internal
       FROM messages
       WHERE trip_request_id IN (${placeholderList})
       ORDER BY created_at DESC`
    )
      .bind(...requestIds)
      .all();

    const auditResult = await env.DB.prepare(
      `SELECT id, trip_request_id, next_status AS label, created_at AS at
       FROM status_history
       WHERE trip_request_id IN (${placeholderList})
       ORDER BY created_at DESC`
    )
      .bind(...requestIds)
      .all();

    messages.push(...((messageResult.results ?? []) as Array<Record<string, unknown>>));
    audit.push(...((auditResult.results ?? []) as Array<Record<string, unknown>>));
  }

  return rows.map((row) => {
    const id = Number(row.id);
    const rowMessages = messages.filter((item) => Number(item.trip_request_id) === id);
    const rowAudit = audit.filter((item) => Number(item.trip_request_id) === id);

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
      phoneVisible: Number(row.phoneVisible ?? 0),
      pinStatus: String(row.pinStatus ?? 'first_access'),
      clientConfirmedAt: (row.clientConfirmedAt as string | null) ?? null,
      messages: rowMessages.map((message) => ({
        id: Number(message.id),
        author: String(message.author),
        role: String(message.role),
        body: String(message.body),
        at: String(message.at),
        internal: Number(message.internal)
      })),
      audit: rowAudit.map((item) => ({
        id: Number(item.id),
        label: String(item.label),
        at: String(item.at)
      }))
    } as unknown as RequestRow;
  });
}

export async function onRequestGet({ request, env }: { request: Request; env: Env }) {
  const session = await getSession(request, env);

  if (!env.DB) {
    return json({ ok: true, rows: [] });
  }

  const baseQuery = `
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
  `;

  const where = session?.role === 'cliente'
    ? ' WHERE clients.document = ?'
    : session?.role === 'motorista'
      ? ' WHERE driver.name = ?'
      : '';

  const query = `${baseQuery}${where} ORDER BY trip_requests.created_at DESC LIMIT 100`;
  const statement = env.DB.prepare(query);
  const result = session?.role === 'cliente' || session?.role === 'motorista'
    ? await statement.bind(session?.role === 'cliente' ? session.document : session?.name ?? '').all()
    : await statement.all();

  const rows = (result.results ?? []) as Array<Record<string, unknown>>;
  const mapped = await mapRequestRows(env, rows);

  return json({ ok: true, rows: mapped });
}

export async function onRequestPost({ request, env }: { request: Request; env: Env }) {
  const session = await getSession(request, env);
  const body = (await request.json().catch(() => ({}))) as CreateRequestBody;

  if (!body.clientName || !body.document || !body.destination || !body.boardingPoint || !body.departureAt) {
    return json(
      { ok: false, error: 'clientName, document, destination, boardingPoint e departureAt são obrigatórios.' },
      { status: 400 }
    );
  }

  if (!env.DB) {
    return json({
      ok: true,
      row: {
        id: 'demo',
        protocol: 'TRP-DEMO-00001',
        clientName: body.clientName,
        document: normalizeDocument(body.document),
        destination: body.destination
      }
    });
  }

  const clientDocument = normalizeDocument(body.document);
  const existingClient = await env.DB.prepare('SELECT id FROM clients WHERE document = ? LIMIT 1')
    .bind(clientDocument)
    .first<{ id: number }>();

  const existingUser = await env.DB.prepare('SELECT id FROM users WHERE document = ? LIMIT 1')
    .bind(clientDocument)
    .first<{ id: number }>();

  const clientId = existingClient?.id ?? (
    await env.DB.prepare(
      'INSERT INTO clients (name, document, phone, address) VALUES (?, ?, ?, ?)'
    )
      .bind(body.clientName, clientDocument, body.phone ?? '', body.boardingPoint ?? '')
      .run()
  ).meta.last_row_id!;

  if (!existingUser) {
    await env.DB.prepare(
      'INSERT INTO users (role, name, document, pin_hash, pin_must_change) VALUES (?, ?, ?, ?, ?)'
    )
      .bind(
        'cliente',
        body.clientName,
        clientDocument,
        '9af15b336e6a9619928537df30b2e6a2376569fcf9d7e773eccede65606529a0',
        1
      )
      .run();
  }

  const countResult = await env.DB.prepare('SELECT COUNT(*) AS total FROM trip_requests').first<{ total: number }>();
  const protocol = createProtocol((countResult?.total ?? 0) + 1);

  const result = await env.DB.prepare(
    `
      INSERT INTO trip_requests (
        protocol,
        client_id,
        client_phone,
        destination,
        boarding_point,
        departure_at,
        arrival_eta,
        status,
        notes,
        companions,
        phone_visible,
        client_pin_status
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, 'em_atendimento', ?, ?, 1, 'first_access')
    `
  )
    .bind(
      protocol,
      clientId,
      body.phone ?? '',
      body.destination,
      body.boardingPoint,
      body.departureAt,
      body.arrivalEta ?? '',
      body.notes ?? '',
      body.companions ?? ''
    )
    .run();

  const requestId = Number(result.meta.last_row_id);

  await env.DB.prepare(
    'INSERT INTO messages (trip_request_id, author_role, author_name, body, is_internal) VALUES (?, ?, ?, ?, ?)'
  )
    .bind(
      requestId,
      session?.role ?? 'operador',
      session?.name ?? 'Equipe Operação',
      'Solicitação criada no sistema.',
      1
    )
    .run();

  await env.DB.prepare(
    'INSERT INTO status_history (trip_request_id, previous_status, next_status, changed_by_role, changed_by_name) VALUES (?, ?, ?, ?, ?)'
  )
    .bind(requestId, null, 'em_atendimento', session?.role ?? 'operador', session?.name ?? 'Equipe Operação')
    .run();

  return json({ ok: true, row: { id: requestId, protocol } });
}
