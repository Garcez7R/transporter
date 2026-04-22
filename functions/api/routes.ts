import { json } from '../_shared/response';
import { getSession } from '../_shared/session';
import { detectOperationalConflicts, logOperationalEvent, syncConflictEvents, type MonitoringRequestRow } from '../_shared/operations';
import type { Env } from '../_shared/types';

type RouteBatchBody = {
  action?: 'save' | 'clear';
  driver?: string;
  vehicle?: string;
  routeDate?: string;
  routeStartTime?: string;
  routeGapMinutes?: number;
  requestIds?: string[];
};

type SelectedRequestRow = {
  id: number;
  protocol: string;
  status: string;
  departureAt: string;
  arrivalEta: string | null;
  driver: string;
  vehicle: string;
  routeDate: string | null;
  routeOrder: number | null;
};

function addMinutesToTime(value: string, minutes: number) {
  const [hoursPart = '0', minutesPart = '0'] = value.split(':');
  const hours = Number(hoursPart);
  const mins = Number(minutesPart);
  if (Number.isNaN(hours) || Number.isNaN(mins)) return '';
  const total = hours * 60 + mins + minutes;
  const normalized = ((total % (24 * 60)) + (24 * 60)) % (24 * 60);
  const nextHours = Math.floor(normalized / 60);
  const nextMinutes = normalized % 60;
  return `${String(nextHours).padStart(2, '0')}:${String(nextMinutes).padStart(2, '0')}`;
}

async function resolveDriverId(env: Env, value: string) {
  const result = await env.DB!.prepare('SELECT id FROM users WHERE name = ? LIMIT 1').bind(value).first<{ id: number }>();
  return result?.id ?? null;
}

async function resolveVehicle(env: Env, value: string) {
  const result = await env.DB!.prepare('SELECT id, plate, model, status FROM vehicles WHERE plate = ? OR model = ? LIMIT 1')
    .bind(value, value)
    .first<{ id: number; plate: string; model: string; status: string | null }>();
  return result ?? null;
}

export async function onRequestPost({ request, env }: { request: Request; env: Env }) {
  const session = await getSession(request, env);
  const body = (await request.json().catch(() => ({}))) as RouteBatchBody;

  if (!session) {
    return json({ ok: false, error: 'Sessão inválida.' }, { status: 401 });
  }

  if (!['gerente', 'administrador'].includes(session.role)) {
    return json({ ok: false, error: 'Sem permissão para publicar rotas em lote.' }, { status: 403 });
  }

  if (!env.DB) {
    return json({ ok: false, error: 'Banco indisponível.' }, { status: 503 });
  }

  const requestIds = (body.requestIds ?? []).map((value) => Number(value)).filter(Boolean);
  if (!requestIds.length) {
    return json({ ok: false, error: 'Selecione pelo menos uma solicitação.' }, { status: 400 });
  }

  const selectedPlaceholder = requestIds.map(() => '?').join(', ');
  const selectedResult = await env.DB.prepare(
    `
      SELECT
        trip_requests.id,
        trip_requests.protocol,
        trip_requests.status,
        trip_requests.departure_at AS departureAt,
        trip_requests.arrival_eta AS arrivalEta,
        trip_requests.route_date AS routeDate,
        trip_requests.route_order AS routeOrder,
        COALESCE(driver.name, '') AS driver,
        COALESCE(vehicle.plate, '') AS vehicle
      FROM trip_requests
      LEFT JOIN users AS driver ON driver.id = trip_requests.driver_id
      LEFT JOIN vehicles AS vehicle ON vehicle.id = trip_requests.vehicle_id
      WHERE trip_requests.id IN (${selectedPlaceholder})
      ORDER BY trip_requests.id
    `
  )
    .bind(...requestIds)
    .all<SelectedRequestRow>();

  const selectedRows = (selectedResult.results ?? []) as SelectedRequestRow[];
  if (selectedRows.length !== requestIds.length) {
    return json({ ok: false, error: 'Uma ou mais solicitações não foram encontradas.' }, { status: 404 });
  }

  if (body.action === 'clear') {
    const statements = selectedRows.flatMap((row) => ([
      env.DB!.prepare(
        `UPDATE trip_requests
         SET driver_id = NULL,
             vehicle_id = NULL,
             status = 'aguardando_distribuicao',
             route_date = NULL,
             route_order = NULL,
             updated_at = ?
         WHERE id = ?`
      ).bind(new Date().toISOString(), row.id)
    ]));

    await env.DB.batch(statements);

    for (const row of selectedRows) {
      await logOperationalEvent(env, {
        tripRequestId: row.id,
        eventType: 'route.cleared',
        severity: 'warning',
        payload: { protocol: row.protocol },
        actorRole: session.role,
        actorName: session.name,
        actorId: session.user_id
      });
    }

    return json({ ok: true, updatedIds: selectedRows.map((row) => String(row.id)) });
  }

  if (body.action !== 'save') {
    return json({ ok: false, error: 'Ação de rota inválida.' }, { status: 400 });
  }

  if (!body.driver || !body.vehicle || !body.routeDate) {
    return json({ ok: false, error: 'Motorista, veículo e data da rota são obrigatórios.' }, { status: 400 });
  }

  const invalidStatus = selectedRows.find((row) => !['aguardando_distribuicao', 'agendada', 'em_atendimento'].includes(row.status));
  if (invalidStatus) {
    return json({ ok: false, error: `A solicitação ${invalidStatus.protocol} não pode entrar em uma nova rota.` }, { status: 409 });
  }

  const driverId = await resolveDriverId(env, body.driver);
  const vehicle = await resolveVehicle(env, body.vehicle);
  if (!driverId || !vehicle?.id) {
    return json({ ok: false, error: 'Motorista ou veículo não encontrados.' }, { status: 404 });
  }

  const allRowsResult = await env.DB.prepare(
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

  const currentRouteRowsResult = await env.DB.prepare(
    `
      SELECT trip_requests.id
      FROM trip_requests
      WHERE trip_requests.driver_id = ?
        AND trip_requests.vehicle_id = ?
        AND trip_requests.route_date = ?
        AND trip_requests.status NOT IN ('cancelada', 'concluida')
    `
  )
    .bind(driverId, vehicle.id, body.routeDate)
    .all<{ id: number }>();

  const currentRouteIds = ((currentRouteRowsResult.results ?? []) as Array<{ id: number }>).map((row) => row.id);

  const currentRows = ((allRowsResult.results ?? []) as MonitoringRequestRow[]).filter(
    (row) => !requestIds.includes(row.id) && !currentRouteIds.includes(row.id)
  );

  const candidateRows: MonitoringRequestRow[] = [
    ...currentRows,
    ...selectedRows.map((row, index) => {
      const scheduledTime = body.routeStartTime
        ? addMinutesToTime(body.routeStartTime, (body.routeGapMinutes ?? 20) * index)
        : '';
      return {
        id: row.id,
        protocol: row.protocol,
        destination: '',
        destinationFacility: '',
        departureAt: scheduledTime ? `${body.routeDate} ${scheduledTime}` : row.departureAt,
        arrivalEta: row.arrivalEta,
        routeDate: body.routeDate,
        routeOrder: index + 1,
        status: 'agendada',
        driver: body.driver ?? '',
        vehicle: vehicle.plate ?? body.vehicle ?? '',
        vehicleStatus: vehicle.status ?? null
      };
    })
  ];

  const hardConflicts = detectOperationalConflicts(candidateRows)
    .filter((conflict) => conflict.relatedRequestIds.some((id) => requestIds.includes(Number(id))))
    .filter((conflict) => conflict.tone === 'danger' || conflict.category === 'vehicle_maintenance');

  if (hardConflicts.length) {
    return json({ ok: false, error: hardConflicts[0]?.detail ?? 'Conflito crítico detectado.' }, { status: 409 });
  }

  const clearStatements = currentRouteIds
    .filter((id) => !requestIds.includes(id))
    .map((id) =>
      env.DB!.prepare(
        `UPDATE trip_requests
         SET driver_id = NULL,
             vehicle_id = NULL,
             status = 'aguardando_distribuicao',
             route_date = NULL,
             route_order = NULL,
             updated_at = ?
         WHERE id = ?`
      ).bind(new Date().toISOString(), id)
    );

  const statements = selectedRows.map((row, index) => {
    const scheduledTime = body.routeStartTime
      ? addMinutesToTime(body.routeStartTime, (body.routeGapMinutes ?? 20) * index)
      : '';
    const departureAt = scheduledTime ? `${body.routeDate} ${scheduledTime}` : row.departureAt;

    return env.DB!.prepare(
      `UPDATE trip_requests
       SET driver_id = ?,
           vehicle_id = ?,
           status = 'agendada',
           departure_at = ?,
           route_date = ?,
           route_order = ?,
           updated_at = ?
       WHERE id = ?`
    ).bind(
      driverId,
      vehicle.id,
      departureAt,
      body.routeDate,
      index + 1,
      new Date().toISOString(),
      row.id
    );
  });

  await env.DB.batch([...clearStatements, ...statements]);

  for (const row of selectedRows) {
    await syncConflictEvents(env, row.id, candidateRows, {
      role: session.role,
      name: session.name,
      id: session.user_id
    });
    await logOperationalEvent(env, {
      tripRequestId: row.id,
      vehicleId: vehicle.id,
      driverId,
      eventType: 'route.published',
      payload: {
        protocol: row.protocol,
        driver: body.driver,
        vehicle: vehicle.plate,
        routeDate: body.routeDate
      },
      actorRole: session.role,
      actorName: session.name,
      actorId: session.user_id
    });
  }

  return json({ ok: true, updatedIds: selectedRows.map((row) => String(row.id)) });
}
