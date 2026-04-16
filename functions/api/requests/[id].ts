import { json } from '../../_shared/response';
import { getSession } from '../../_shared/session';
import { sha256Hex } from '../../_shared/security';
import { logAudit } from '../../_shared/audit';
import { logOperationalEvent, syncConflictEvents, type MonitoringRequestRow } from '../../_shared/operations';
import type { Env } from '../../_shared/types';

type UpdateBody = {
  status?: string;
  destination?: string;
  driver?: string;
  vehicle?: string;
  notes?: string;
  companions?: string;
  boardingPoint?: string;
  boardingCep?: string;
  departureAt?: string;
  arrivalEta?: string;
  phoneVisible?: boolean;
  clientConfirmedAt?: string;
  pinStatus?: string;
  routeDate?: string;
  routeOrder?: number | null;
  message?: string;
  fuelLog?: {
    odometerKm?: number;
    liters?: number;
    fuelType?: string;
    notes?: string;
  };
  gpsPoint?: {
    lat?: number;
    lng?: number;
    accuracy?: number;
    speed?: number;
    recordedAt?: string;
  };
};

type RequestDetail = {
  id: string;
  protocol: string;
  clientName: string;
  document: string;
  phone: string;
  clientCep?: string;
  clientAddress?: string;
  boardingCep?: string;
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
  routeDate?: string;
  routeOrder?: number | null;
  pinStatus: string;
  clientConfirmedAt: string | null;
  telemetry?: {
    fuelLogsCount: number;
    gpsPingsCount: number;
    lastFuel?: {
      id: string;
      odometerKm: number;
      liters: number;
      fuelType?: string;
      notes?: string;
      at: string;
    } | null;
    lastGps?: {
      id: string;
      lat: number;
      lng: number;
      accuracy?: number;
      speed?: number;
      at: string;
    } | null;
  };
  messages: Array<{
    id: number;
    author: string;
    role: string;
    body: string;
    at: string;
    internal: number;
    readAt?: string | null;
  }>;
  audit: Array<{
    id: number;
    label: string;
    details?: string;
    actor?: string;
    at: string;
  }>;
};

function humanizeAuditLabel(value: string) {
  return value
    .replace(/\./g, ' · ')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

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
        clients.cep AS clientCep,
        clients.address AS clientAddress,
        trip_requests.destination,
        trip_requests.boarding_point AS boardingPoint,
        trip_requests.boarding_cep AS boardingCep,
        trip_requests.route_date AS routeDate,
        trip_requests.route_order AS routeOrder,
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
    `SELECT id, author_name AS author, author_role AS role, body, created_at AS at, is_internal AS internal, read_at AS readAt
     FROM messages
     WHERE trip_request_id = ?
     ORDER BY created_at DESC`
  )
    .bind(requestId)
    .all();

  const auditResult = await env.DB!.prepare(
    `SELECT id, next_status AS label, created_at AS at, changed_by_role AS role, changed_by_name AS name
     FROM status_history
     WHERE trip_request_id = ?
     ORDER BY created_at DESC`
  )
    .bind(requestId)
    .all();

  let auditLogResult: { results?: Array<Record<string, unknown>> } = {};
  try {
    auditLogResult = await env.DB!.prepare(
      `SELECT id, action, details, actor_role, actor_name, created_at AS at
       FROM audit_log
       WHERE trip_request_id = ?
       ORDER BY created_at DESC`
    )
      .bind(requestId)
      .all();
  } catch {
    auditLogResult = {};
  }

  let fuelResult: { results?: Array<Record<string, unknown>> } = {};
  try {
    fuelResult = await env.DB!.prepare(
      `SELECT id, odometer_km, liters, fuel_type, notes, created_at
       FROM vehicle_fuel_logs
       WHERE trip_request_id = ?
       ORDER BY created_at DESC`
    )
      .bind(requestId)
      .all();
  } catch {
    fuelResult = {};
  }

  let gpsResult: { results?: Array<Record<string, unknown>> } = {};
  try {
    gpsResult = await env.DB!.prepare(
      `SELECT id, latitude, longitude, accuracy, speed, recorded_at
       FROM gps_logs
       WHERE trip_request_id = ?
       ORDER BY recorded_at DESC`
    )
      .bind(requestId)
      .all();
  } catch {
    gpsResult = {};
  }

  const lastFuel = (fuelResult.results ?? [])[0] as Record<string, unknown> | undefined;
  const lastGps = (gpsResult.results ?? [])[0] as Record<string, unknown> | undefined;

  return {
    id: String(row.id),
    protocol: String(row.protocol),
    clientName: String(row.clientName),
    document: String(row.document),
    phone: String(row.phone ?? ''),
    clientCep: row.clientCep ? String(row.clientCep) : '',
    clientAddress: row.clientAddress ? String(row.clientAddress) : '',
    boardingCep: row.boardingCep ? String(row.boardingCep) : '',
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
    routeDate: row.routeDate ? String(row.routeDate) : '',
    routeOrder: row.routeOrder !== null && row.routeOrder !== undefined ? Number(row.routeOrder) : undefined,
    pinStatus: String(row.pinStatus ?? 'first_access'),
    clientConfirmedAt: (row.clientConfirmedAt as string | null) ?? null,
    telemetry: {
      fuelLogsCount: fuelResult.results?.length ?? 0,
      gpsPingsCount: gpsResult.results?.length ?? 0,
      lastFuel: lastFuel
        ? {
            id: String(lastFuel.id),
            odometerKm: Number(lastFuel.odometer_km ?? 0),
            liters: Number(lastFuel.liters ?? 0),
            fuelType: lastFuel.fuel_type ? String(lastFuel.fuel_type) : undefined,
            notes: lastFuel.notes ? String(lastFuel.notes) : undefined,
            at: String(lastFuel.created_at)
          }
        : null,
      lastGps: lastGps
        ? {
            id: String(lastGps.id),
            lat: Number(lastGps.latitude ?? 0),
            lng: Number(lastGps.longitude ?? 0),
            accuracy: lastGps.accuracy !== null && lastGps.accuracy !== undefined ? Number(lastGps.accuracy) : undefined,
            speed: lastGps.speed !== null && lastGps.speed !== undefined ? Number(lastGps.speed) : undefined,
            at: String(lastGps.recorded_at)
          }
        : null
    },
    messages: (messagesResult.results ?? []).map((item) => ({
      id: Number((item as Record<string, unknown>).id),
      author: String((item as Record<string, unknown>).author),
      role: String((item as Record<string, unknown>).role),
      body: String((item as Record<string, unknown>).body),
      at: String((item as Record<string, unknown>).at),
      internal: Number((item as Record<string, unknown>).internal),
      readAt: (item as Record<string, unknown>).readAt ? String((item as Record<string, unknown>).readAt) : null
    })),
    audit: [
      ...((auditLogResult.results ?? []) as Array<Record<string, unknown>>).map((item) => ({
        id: Number(item.id),
        label: humanizeAuditLabel(String(item.action)),
        details: item.details ? String(item.details) : undefined,
        actor: item.actor_name ? `${String(item.actor_name)} (${String(item.actor_role)})` : undefined,
        at: String(item.at)
      })),
      ...((auditResult.results ?? []) as Array<Record<string, unknown>>).map((item) => ({
        id: Number(item.id),
        label: String(item.label),
        details: undefined,
        actor: item.name ? `${String(item.name)} (${String(item.role)})` : undefined,
        at: String(item.at)
      }))
    ].sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
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

  if (session?.role && env.DB) {
    const isPatient = session.role === 'cliente';
    await env.DB.prepare(
      `UPDATE messages
       SET read_at = COALESCE(read_at, CURRENT_TIMESTAMP)
       WHERE trip_request_id = ?
       AND read_at IS NULL
       AND is_internal = ?
       AND author_role != ?`
    )
      .bind(requestId, isPatient ? 1 : 0, session.role)
      .run();
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

  if (!session) {
    return json({ ok: false, error: 'Sessão inválida.' }, { status: 401 });
  }

  const hasField = (value: unknown) => value !== undefined;
  const fields = {
    status: hasField(body.status),
    destination: hasField(body.destination),
    driver: hasField(body.driver),
    vehicle: hasField(body.vehicle),
    notes: hasField(body.notes),
    companions: hasField(body.companions),
    boardingPoint: hasField(body.boardingPoint),
    boardingCep: hasField(body.boardingCep),
    departureAt: hasField(body.departureAt),
    arrivalEta: hasField(body.arrivalEta),
    phoneVisible: hasField(body.phoneVisible),
    clientConfirmedAt: hasField(body.clientConfirmedAt),
    pinStatus: hasField(body.pinStatus),
    routeDate: hasField(body.routeDate),
    routeOrder: hasField(body.routeOrder),
    message: hasField(body.message),
    fuelLog: hasField(body.fuelLog),
    gpsPoint: hasField(body.gpsPoint)
  };

  const role = session.role;
  const hasDisallowed = (allowed: Array<keyof typeof fields>) =>
    Object.entries(fields).some(([key, enabled]) => enabled && !allowed.includes(key as keyof typeof fields));

  if (role === 'cliente') {
    if (hasDisallowed(['clientConfirmedAt', 'message'])) {
      return json({ ok: false, error: 'Paciente só pode confirmar agenda e enviar mensagens.' }, { status: 403 });
    }
  }

  if (role === 'motorista') {
    const allowed: Array<keyof typeof fields> = ['status', 'message', 'fuelLog', 'gpsPoint'];
    if (hasDisallowed(allowed)) {
      return json({ ok: false, error: 'Motorista só pode atualizar status, mensagens e telemetria operacional.' }, { status: 403 });
    }
    if (body.status && !['em_rota', 'concluida'].includes(body.status)) {
      return json({ ok: false, error: 'Motorista só pode atualizar status operacional.' }, { status: 403 });
    }
  }

  if (role === 'operador') {
    const allowed: Array<keyof typeof fields> = [
      'status',
      'destination',
      'notes',
      'companions',
      'boardingPoint',
      'boardingCep',
      'departureAt',
      'arrivalEta',
      'message',
      'pinStatus'
    ];
    if (hasDisallowed(allowed)) {
      return json({ ok: false, error: 'Operador não pode alterar motorista, veículo ou visibilidade de telefone.' }, { status: 403 });
    }
    if (body.status && !['em_atendimento', 'aguardando_distribuicao'].includes(body.status)) {
      return json({ ok: false, error: 'Operador só pode mover para atendimento ou distribuição.' }, { status: 403 });
    }
  }

  if (role === 'gerente') {
    const allowed: Array<keyof typeof fields> = [
      'status',
      'destination',
      'driver',
      'vehicle',
      'notes',
      'companions',
      'boardingPoint',
      'boardingCep',
      'departureAt',
      'arrivalEta',
      'phoneVisible',
      'routeDate',
      'routeOrder',
      'message'
    ];
    if (hasDisallowed(allowed)) {
      return json({ ok: false, error: 'Gerência não pode alterar confirmação do paciente.' }, { status: 403 });
    }
  }

  if (body.pinStatus !== undefined && !['operador', 'gerente', 'administrador'].includes(role)) {
    return json({ ok: false, error: 'Sem permissão para resetar o PIN do paciente.' }, { status: 403 });
  }

  const updates: string[] = [];
  const values: unknown[] = [];
  const setField = (field: string, value: unknown) => {
    updates.push(`${field} = ?`);
    values.push(value);
  };

  if (body.status) setField('status', body.status);
  if (body.destination !== undefined) setField('destination', body.destination);
  if (body.driver !== undefined) setField('driver_id', body.driver ? await resolveDriverId(env, body.driver) : null);
  if (body.vehicle !== undefined) setField('vehicle_id', body.vehicle ? await resolveVehicleId(env, body.vehicle) : null);
  if (body.notes !== undefined) setField('notes', body.notes);
  if (body.companions !== undefined) setField('companions', body.companions);
  if (body.boardingPoint !== undefined) setField('boarding_point', body.boardingPoint);
  if (body.boardingCep !== undefined) setField('boarding_cep', body.boardingCep.replace(/\D/g, ''));
  if (body.departureAt !== undefined) setField('departure_at', body.departureAt);
  if (body.arrivalEta !== undefined) setField('arrival_eta', body.arrivalEta);
  if (body.phoneVisible !== undefined) setField('phone_visible', body.phoneVisible ? 1 : 0);
  if (body.clientConfirmedAt !== undefined) setField('client_confirmed_at', body.clientConfirmedAt);
  if (body.pinStatus !== undefined) setField('client_pin_status', body.pinStatus);
  if (body.routeDate !== undefined) setField('route_date', body.routeDate);
  if (body.routeOrder !== undefined) setField('route_order', body.routeOrder);

  if (updates.length) {
    setField('updated_at', new Date().toISOString());
    values.push(requestId);

    await env.DB.prepare(`UPDATE trip_requests SET ${updates.join(', ')} WHERE id = ?`)
      .bind(...values)
      .run();
  }

  const nextDriverId = body.driver !== undefined
    ? (body.driver ? await resolveDriverId(env, body.driver) : null)
    : await resolveDriverId(env, current.driver);
  const nextVehicleId = body.vehicle !== undefined
    ? (body.vehicle ? await resolveVehicleId(env, body.vehicle) : null)
    : await resolveVehicleId(env, current.vehicle);

  if (body.fuelLog && body.fuelLog.odometerKm !== undefined && body.fuelLog.liters !== undefined) {
    if (!nextVehicleId) {
      return json({ ok: false, error: 'A viagem precisa ter veículo atribuído antes do registro de abastecimento.' }, { status: 400 });
    }

    await env.DB.prepare(
      `INSERT INTO vehicle_fuel_logs (
        trip_request_id,
        vehicle_id,
        driver_id,
        odometer_km,
        liters,
        fuel_type,
        notes,
        actor_role,
        actor_name,
        actor_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
      .bind(
        requestId,
        nextVehicleId,
        nextDriverId,
        body.fuelLog.odometerKm,
        body.fuelLog.liters,
        body.fuelLog.fuelType ?? null,
        body.fuelLog.notes ?? null,
        session.role,
        session.name,
        session.user_id
      )
      .run();

    await logOperationalEvent(env, {
      tripRequestId: requestId,
      vehicleId: nextVehicleId,
      driverId: nextDriverId,
      eventType: 'fuel.logged',
      payload: {
        odometerKm: body.fuelLog.odometerKm,
        liters: body.fuelLog.liters,
        fuelType: body.fuelLog.fuelType ?? null
      },
      actorRole: session.role,
      actorName: session.name,
      actorId: session.user_id
    });
  }

  if (body.gpsPoint && body.gpsPoint.lat !== undefined && body.gpsPoint.lng !== undefined) {
    await env.DB.prepare(
      `INSERT INTO gps_logs (
        trip_request_id,
        driver_id,
        vehicle_id,
        latitude,
        longitude,
        accuracy,
        speed,
        recorded_at,
        actor_role,
        actor_name,
        actor_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
      .bind(
        requestId,
        nextDriverId,
        nextVehicleId,
        body.gpsPoint.lat,
        body.gpsPoint.lng,
        body.gpsPoint.accuracy ?? null,
        body.gpsPoint.speed ?? null,
        body.gpsPoint.recordedAt ?? new Date().toISOString(),
        session.role,
        session.name,
        session.user_id
      )
      .run();

    await logOperationalEvent(env, {
      tripRequestId: requestId,
      vehicleId: nextVehicleId,
      driverId: nextDriverId,
      eventType: 'gps.logged',
      payload: {
        lat: body.gpsPoint.lat,
        lng: body.gpsPoint.lng,
        accuracy: body.gpsPoint.accuracy ?? null,
        speed: body.gpsPoint.speed ?? null
      },
      actorRole: session.role,
      actorName: session.name,
      actorId: session.user_id
    });
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

    await logAudit(env, {
      tripRequestId: requestId,
      entityType: 'trip_request',
      action: 'message.sent',
      details: session?.role === 'cliente' ? 'Mensagem enviada pelo paciente.' : 'Mensagem enviada pela equipe.',
      actorRole: session?.role ?? null,
      actorName: session?.name ?? null,
      actorId: session?.user_id ?? null
    });
  }

  if (body.status && body.status !== current.status) {
    await env.DB.prepare(
      'INSERT INTO status_history (trip_request_id, previous_status, next_status, changed_by_role, changed_by_name) VALUES (?, ?, ?, ?, ?)'
    )
      .bind(requestId, current.status, body.status, session?.role ?? 'operador', session?.name ?? 'Equipe Operação')
      .run();

    await logAudit(env, {
      tripRequestId: requestId,
      entityType: 'trip_request',
      action: 'status.updated',
      details: `${current.status} → ${body.status}`,
      actorRole: session?.role ?? null,
      actorName: session?.name ?? null,
      actorId: session?.user_id ?? null
    });
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

    await logAudit(env, {
      tripRequestId: requestId,
      entityType: 'trip_request',
      action: 'pin.reset',
      details: 'PIN do paciente resetado para 0000.',
      actorRole: session?.role ?? null,
      actorName: session?.name ?? null,
      actorId: session?.user_id ?? null
    });
  }

  if (body.clientConfirmedAt) {
    await logAudit(env, {
      tripRequestId: requestId,
      entityType: 'trip_request',
      action: 'agenda.confirmed',
      details: 'Paciente confirmou o recebimento da agenda.',
      actorRole: session?.role ?? null,
      actorName: session?.name ?? null,
      actorId: session?.user_id ?? null
    });
  }

  if (body.driver !== undefined || body.vehicle !== undefined || body.departureAt !== undefined || body.arrivalEta !== undefined || body.routeDate !== undefined || body.routeOrder !== undefined) {
    await logAudit(env, {
      tripRequestId: requestId,
      entityType: 'trip_request',
      action: 'dispatch.updated',
      details: 'Distribuição e horários atualizados.',
      actorRole: session?.role ?? null,
      actorName: session?.name ?? null,
      actorId: session?.user_id ?? null
    });

    try {
      const requestRowsResult = await env.DB.prepare(
        `
          SELECT
            trip_requests.id,
            trip_requests.protocol,
            trip_requests.destination,
            '' AS destinationFacility,
            trip_requests.departure_at AS departureAt,
            trip_requests.arrival_eta AS arrivalEta,
            trip_requests.route_date AS routeDate,
            trip_requests.route_order AS routeOrder,
            trip_requests.status,
            COALESCE(driver.name, '') AS driver,
            COALESCE(vehicle.plate, '') AS vehicle,
            vehicle.status AS vehicleStatus
          FROM trip_requests
          LEFT JOIN users AS driver ON driver.id = trip_requests.driver_id
          LEFT JOIN vehicles AS vehicle ON vehicle.id = trip_requests.vehicle_id
          WHERE trip_requests.status NOT IN ('cancelada', 'concluida')
        `
      ).all<MonitoringRequestRow>();

      await syncConflictEvents(
        env,
        requestId,
        (requestRowsResult.results ?? []) as MonitoringRequestRow[],
        { role: session.role, name: session.name, id: session.user_id }
      );
    } catch {
      // conflict telemetry is best-effort
    }
  }

  const changedFields: string[] = [];
  if (body.destination !== undefined) changedFields.push('destino');
  if (body.notes !== undefined) changedFields.push('observações');
  if (body.companions !== undefined) changedFields.push('acompanhantes');
  if (body.boardingPoint !== undefined) changedFields.push('embarque');
  if (body.boardingCep !== undefined) changedFields.push('CEP do embarque');
  if (body.phoneVisible !== undefined) changedFields.push('telefone visível');

  if (changedFields.length) {
    await logAudit(env, {
      tripRequestId: requestId,
      entityType: 'trip_request',
      action: 'details.updated',
      details: `Atualizado: ${changedFields.join(', ')}.`,
      actorRole: session?.role ?? null,
      actorName: session?.name ?? null,
      actorId: session?.user_id ?? null
    });
  }

  return json({ ok: true });
}

export async function onRequestDelete({ request, env, params }: { request: Request; env: Env; params: { id: string } }) {
  const session = await getSession(request, env);
  const requestId = resolveRequestId(params);

  if (!session) {
    return json({ ok: false, error: 'Sessão inválida.' }, { status: 401 });
  }

  if (!env.DB) {
    return json({ ok: true });
  }

  if (!['operador', 'administrador'].includes(session.role)) {
    return json({ ok: false, error: 'Sem permissão para excluir.' }, { status: 403 });
  }

  if (!requestId) {
    return json({ ok: false, error: 'ID inválido.' }, { status: 400 });
  }

  await env.DB.prepare('DELETE FROM messages WHERE trip_request_id = ?').bind(requestId).run();
  await env.DB.prepare('DELETE FROM status_history WHERE trip_request_id = ?').bind(requestId).run();
  await env.DB.prepare('DELETE FROM audit_log WHERE trip_request_id = ?').bind(requestId).run().catch(() => undefined);
  await env.DB.prepare('DELETE FROM operational_events WHERE trip_request_id = ?').bind(requestId).run().catch(() => undefined);
  await env.DB.prepare('DELETE FROM vehicle_fuel_logs WHERE trip_request_id = ?').bind(requestId).run().catch(() => undefined);
  await env.DB.prepare('DELETE FROM gps_logs WHERE trip_request_id = ?').bind(requestId).run().catch(() => undefined);
  await env.DB.prepare('DELETE FROM trip_requests WHERE id = ?').bind(requestId).run();

  await logAudit(env, {
    entityType: 'trip_request',
    action: 'request.deleted',
    details: `Solicitação ${requestId} excluída.`,
    actorRole: session.role,
    actorName: session.name,
    actorId: session.user_id
  });

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
