import { logAudit } from './audit';
import type { Env } from './types';

export type BackendConflict = {
  id: string;
  category: 'driver_overlap' | 'vehicle_maintenance' | 'daily_overload' | 'vehicle_overlap';
  title: string;
  detail: string;
  tone: 'warning' | 'danger';
  relatedRequestIds: string[];
  date?: string;
};

export type BackendSuggestion = {
  id: string;
  title: string;
  detail: string;
  count: number;
  requestIds: string[];
  date: string;
  destination: string;
  facility: string;
  recommendedDriver: string;
  recommendedVehicle: string;
};

export type MonitoringRequestRow = {
  id: number;
  protocol: string;
  destination: string;
  destinationFacility?: string;
  departureAt: string;
  arrivalEta?: string | null;
  routeDate?: string | null;
  routeOrder?: number | null;
  status: string;
  driver: string;
  vehicle: string;
  vehicleStatus?: string | null;
};

function parseOperationalDateTime(value?: string | null) {
  if (!value) return null;
  const parsed = new Date(value);
  if (!Number.isNaN(parsed.getTime())) return parsed;

  const [datePart = '', timePart = ''] = value.split(' ');
  if (datePart.includes('/')) {
    const [day, month, year] = datePart.split('/').map(Number);
    const [hours = 0, minutes = 0] = timePart.split(':').map(Number);
    if (!day || !month || !year) return null;
    return new Date(year, month - 1, day, hours || 0, minutes || 0, 0, 0);
  }

  if (datePart.includes('-')) {
    const [year, month, day] = datePart.split('-').map(Number);
    const [hours = 0, minutes = 0] = timePart.split(':').map(Number);
    if (!year || !month || !day) return null;
    return new Date(year, month - 1, day, hours || 0, minutes || 0, 0, 0);
  }

  return null;
}

function rangesOverlap(startA: Date, endA: Date, startB: Date, endB: Date) {
  return startA <= endB && startB <= endA;
}

function getIsoDate(value?: string | null) {
  if (!value) return '';
  if (value.includes('T')) return value.slice(0, 10);
  if (value.includes(' ')) return value.split(' ')[0] ?? '';
  return value;
}

export function detectOperationalConflicts(
  rows: MonitoringRequestRow[],
  role: 'gerente' | 'administrador' | 'operador' = 'gerente'
) {
  const conflicts: BackendConflict[] = [];
  const relevantRows = rows.filter((row) => !['cancelada', 'concluida'].includes(row.status));

  const overlapCandidates = relevantRows
    .map((row) => {
      const start = parseOperationalDateTime(row.departureAt);
      const end = parseOperationalDateTime(row.arrivalEta) ?? (start ? new Date(start.getTime() + 90 * 60 * 1000) : null);
      return { row, start, end };
    })
    .filter((item) => item.start && item.end);

  for (let index = 0; index < overlapCandidates.length; index += 1) {
    const current = overlapCandidates[index];
    if (!current?.start || !current?.end) continue;

    for (let nextIndex = index + 1; nextIndex < overlapCandidates.length; nextIndex += 1) {
      const next = overlapCandidates[nextIndex];
      if (!next?.start || !next?.end) continue;
      if (!rangesOverlap(current.start, current.end, next.start, next.end)) continue;

      if (
        current.row.driver &&
        next.row.driver &&
        current.row.driver.toLowerCase() === next.row.driver.toLowerCase()
      ) {
        conflicts.push({
          id: `driver-${current.row.id}-${next.row.id}`,
          category: 'driver_overlap',
          title: `Motorista duplicado: ${current.row.driver}`,
          detail: `${current.row.protocol} e ${next.row.protocol} estão sobrepostos no mesmo período.`,
          tone: 'danger',
          relatedRequestIds: [String(current.row.id), String(next.row.id)],
          date: getIsoDate(current.row.routeDate || current.row.departureAt)
        });
      }

      if (
        current.row.vehicle &&
        next.row.vehicle &&
        current.row.vehicle.toLowerCase() === next.row.vehicle.toLowerCase()
      ) {
        conflicts.push({
          id: `vehicle-${current.row.id}-${next.row.id}`,
          category: 'vehicle_overlap',
          title: `Veículo duplicado: ${current.row.vehicle}`,
          detail: `${current.row.protocol} e ${next.row.protocol} competem pelo mesmo veículo.`,
          tone: 'danger',
          relatedRequestIds: [String(current.row.id), String(next.row.id)],
          date: getIsoDate(current.row.routeDate || current.row.departureAt)
        });
      }
    }
  }

  relevantRows.forEach((row) => {
    const vehicleStatus = (row.vehicleStatus ?? '').toLowerCase();
    if (!row.vehicle || !vehicleStatus) return;
    if (!vehicleStatus.includes('manut')) return;
    conflicts.push({
      id: `maintenance-${row.id}`,
      category: 'vehicle_maintenance',
      title: `Veículo com restrição: ${row.vehicle}`,
      detail: `${row.protocol} está alocado em veículo marcado em manutenção.`,
      tone: 'warning',
      relatedRequestIds: [String(row.id)],
      date: getIsoDate(row.routeDate || row.departureAt)
    });
  });

  const loadMap = new Map<string, MonitoringRequestRow[]>();
  relevantRows.forEach((row) => {
    const date = getIsoDate(row.routeDate || row.departureAt);
    if (!date) return;
    const list = loadMap.get(date) ?? [];
    list.push(row);
    loadMap.set(date, list);
  });

  loadMap.forEach((dayRows, date) => {
    const threshold = role === 'gerente' ? 8 : 10;
    if (dayRows.length <= threshold) return;
    conflicts.push({
      id: `load-${date}`,
      category: 'daily_overload',
      title: `Carga elevada em ${date}`,
      detail: `${dayRows.length} solicitações no mesmo dia exigem revisão de capacidade.`,
      tone: 'warning',
      relatedRequestIds: dayRows.map((row) => String(row.id)),
      date
    });
  });

  return conflicts.slice(0, 10);
}

export function buildRouteSuggestions(rows: MonitoringRequestRow[]) {
  const pool = rows.filter((row) => ['aguardando_distribuicao', 'agendada', 'em_atendimento'].includes(row.status));
  const grouped = new Map<string, MonitoringRequestRow[]>();

  pool.forEach((row) => {
    const date = getIsoDate(row.routeDate || row.departureAt);
    const destination = row.destination.trim();
    const facility = (row.destinationFacility || row.destination).trim();
    const key = [date, destination, facility].join('|');
    const list = grouped.get(key) ?? [];
    list.push(row);
    grouped.set(key, list);
  });

  return Array.from(grouped.entries())
    .map(([key, items]) => {
      const [date = '', destination = '', facility = ''] = key.split('|');
      const history = rows.filter(
        (row) =>
          row.destination.trim().toLowerCase() === destination.toLowerCase() &&
          row.driver &&
          row.vehicle
      );

      const driverCounts = new Map<string, number>();
      const vehicleCounts = new Map<string, number>();
      history.forEach((row) => {
        driverCounts.set(row.driver, (driverCounts.get(row.driver) ?? 0) + 1);
        vehicleCounts.set(row.vehicle, (vehicleCounts.get(row.vehicle) ?? 0) + 1);
      });

      const recommendedDriver = [...driverCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? '';
      const recommendedVehicle = [...vehicleCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? '';

      return {
        id: key,
        title: facility || destination,
        detail: `${date || 'Sem data'} · ${destination || 'Destino não definido'}`,
        count: items.length,
        requestIds: items.map((item) => String(item.id)),
        date,
        destination,
        facility,
        recommendedDriver,
        recommendedVehicle
      } satisfies BackendSuggestion;
    })
    .filter((item) => item.count > 1)
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);
}

export async function logOperationalEvent(
  env: Env,
  entry: {
    tripRequestId?: number | null;
    vehicleId?: number | null;
    driverId?: number | null;
    eventType: string;
    severity?: 'info' | 'warning' | 'danger';
    payload?: Record<string, unknown>;
    actorRole?: string | null;
    actorName?: string | null;
    actorId?: number | null;
  }
) {
  if (!env.DB) return;

  await env.DB.prepare(
    `INSERT INTO operational_events (
      trip_request_id,
      vehicle_id,
      driver_id,
      event_type,
      severity,
      payload,
      actor_role,
      actor_name,
      actor_id
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(
      entry.tripRequestId ?? null,
      entry.vehicleId ?? null,
      entry.driverId ?? null,
      entry.eventType,
      entry.severity ?? 'info',
      entry.payload ? JSON.stringify(entry.payload) : null,
      entry.actorRole ?? null,
      entry.actorName ?? null,
      entry.actorId ?? null
    )
    .run();

  await logAudit(env, {
    tripRequestId: entry.tripRequestId ?? null,
    entityType: 'operational_event',
    action: entry.eventType,
    details: entry.payload ? JSON.stringify(entry.payload) : undefined,
    actorRole: entry.actorRole ?? null,
    actorName: entry.actorName ?? null,
    actorId: entry.actorId ?? null
  });
}

export async function syncConflictEvents(
  env: Env,
  requestId: number,
  rows: MonitoringRequestRow[],
  actor: { role?: string | null; name?: string | null; id?: number | null }
) {
  if (!env.DB) return [];

  await env.DB.prepare(
    `DELETE FROM operational_events
     WHERE trip_request_id = ?
     AND event_type LIKE 'conflict.%'`
  )
    .bind(requestId)
    .run();

  const conflicts = detectOperationalConflicts(rows)
    .filter((conflict) => conflict.relatedRequestIds.includes(String(requestId)));

  for (const conflict of conflicts) {
    await logOperationalEvent(env, {
      tripRequestId: requestId,
      eventType: `conflict.${conflict.category}`,
      severity: conflict.tone === 'danger' ? 'danger' : 'warning',
      payload: {
        title: conflict.title,
        detail: conflict.detail,
        relatedRequestIds: conflict.relatedRequestIds,
        date: conflict.date ?? null
      },
      actorRole: actor.role ?? null,
      actorName: actor.name ?? null,
      actorId: actor.id ?? null
    });
  }

  return conflicts;
}
