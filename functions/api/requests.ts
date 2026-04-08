import { json } from '../_shared/response';
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

function normalizeDocument(value: string) {
  return value.replace(/\D/g, '');
}

function createProtocol(prefix: string, id: number) {
  return `${prefix}-${String(id).padStart(5, '0')}`;
}

export async function onRequestGet({ env }: { env: Env }) {
  if (!env.DB) {
    return json({ ok: true, rows: [] });
  }

  const result = await env.DB.prepare(
    `
      SELECT
        trip_requests.id,
        trip_requests.protocol,
        trip_requests.destination,
        trip_requests.boarding_point AS boardingPoint,
        trip_requests.departure_at AS departureAt,
        trip_requests.arrival_eta AS arrivalEta,
        trip_requests.status,
        trip_requests.client_phone AS phone,
        trip_requests.phone_visible AS phoneVisible,
        trip_requests.notes,
        trip_requests.companions,
        trip_requests.client_pin_status AS pinStatus,
        trip_requests.client_confirmed_at AS clientConfirmedAt,
        clients.name AS clientName,
        clients.document AS document,
        users.name AS driver,
        vehicles.plate AS vehicle
      FROM trip_requests
      JOIN clients ON clients.id = trip_requests.client_id
      LEFT JOIN users ON users.id = trip_requests.driver_id
      LEFT JOIN vehicles ON vehicles.id = trip_requests.vehicle_id
      ORDER BY trip_requests.created_at DESC
      LIMIT 50
    `
  ).all();

  return json({ ok: true, rows: result.results ?? [] });
}

export async function onRequestPost({ request, env }: { request: Request; env: Env }) {
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

  const clientId =
    existingClient?.id ??
    (
      await env.DB.prepare(
        'INSERT INTO clients (name, document, phone, address) VALUES (?, ?, ?, ?)'
      )
        .bind(body.clientName, clientDocument, body.phone ?? '', body.boardingPoint ?? '')
        .run()
    ).meta.last_row_id!;

  const requestId = (
    await env.DB.prepare(
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
        createProtocol('TRP-2026', Date.now() % 100000),
        clientId,
        body.phone ?? '',
        body.destination,
        body.boardingPoint,
        body.departureAt,
        body.arrivalEta ?? '',
        body.notes ?? '',
        body.companions ?? ''
      )
      .run()
  ).meta.last_row_id;

  return json({ ok: true, id: requestId });
}
