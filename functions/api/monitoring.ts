import { json } from '../_shared/response';
import { getSession } from '../_shared/session';
import { buildRouteSuggestions, detectOperationalConflicts, type MonitoringRequestRow } from '../_shared/operations';
import type { Env } from '../_shared/types';

function humanizeAuditLabel(value: string) {
  return value
    .replace(/\./g, ' · ')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export async function onRequestGet({ request, env }: { request: Request; env: Env }) {
  const session = await getSession(request, env);

  if (!session) {
    return json({ ok: false, error: 'Sessão inválida.' }, { status: 401 });
  }

  if (!env.DB) {
    return json({
      ok: true,
      snapshot: {
        generatedAt: new Date().toISOString(),
        summary: {
          activeRequests: 0,
          inRoute: 0,
          pendingDispatch: 0,
          completed: 0,
          clients: 0,
          gpsPings: 0,
          fuelLogs: 0
        },
        topDates: [],
        roleCounts: [],
        conflicts: [],
        suggestions: [],
        recentAudit: []
      }
    });
  }

  const requestsResult = await env.DB.prepare(
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
      ORDER BY trip_requests.departure_at DESC, trip_requests.created_at DESC
    `
  ).all<MonitoringRequestRow>();

  const rows = (requestsResult.results ?? []) as MonitoringRequestRow[];

  const countsByStatus = rows.reduce<Record<string, number>>((acc, row) => {
    acc[row.status] = (acc[row.status] ?? 0) + 1;
    return acc;
  }, {});

  const byDate = rows.reduce<Record<string, number>>((acc, row) => {
    const date = row.routeDate || row.departureAt?.slice(0, 10) || 'sem-data';
    acc[date] = (acc[date] ?? 0) + 1;
    return acc;
  }, {});

  const usersResult = await env.DB.prepare(
    `SELECT role, COUNT(*) AS total FROM users GROUP BY role ORDER BY role`
  ).all<{ role: string; total: number }>();

  const clientsCount = await env.DB.prepare(
    `SELECT COUNT(*) AS total FROM clients`
  ).first<{ total: number }>();

  const gpsCount = await env.DB.prepare(
    `SELECT COUNT(*) AS total FROM gps_logs`
  ).first<{ total: number }>();

  const fuelCount = await env.DB.prepare(
    `SELECT COUNT(*) AS total FROM vehicle_fuel_logs`
  ).first<{ total: number }>();

  const auditResult = await env.DB.prepare(
    `
      SELECT id, action, details, actor_name, actor_role, created_at
      FROM audit_log
      ORDER BY created_at DESC
      LIMIT 12
    `
  ).all<Record<string, unknown>>();

  const conflicts = detectOperationalConflicts(
    rows,
    session.role === 'operador' ? 'operador' : 'gerente'
  );
  const suggestions = buildRouteSuggestions(rows);

  return json({
    ok: true,
    snapshot: {
      generatedAt: new Date().toISOString(),
      summary: {
        activeRequests: rows.filter((row) => ['em_atendimento', 'agendada', 'em_rota'].includes(row.status)).length,
        inRoute: countsByStatus.em_rota ?? 0,
        pendingDispatch: countsByStatus.aguardando_distribuicao ?? 0,
        completed: countsByStatus.concluida ?? 0,
        clients: clientsCount?.total ?? 0,
        gpsPings: gpsCount?.total ?? 0,
        fuelLogs: fuelCount?.total ?? 0
      },
      topDates: Object.entries(byDate)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 6)
        .map(([date, count]) => ({ date, count })),
      roleCounts: ((usersResult.results ?? []) as Array<{ role: string; total: number }>).map((row) => ({
        role: row.role,
        count: row.total
      })),
      conflicts,
      suggestions,
      recentAudit: ((auditResult.results ?? []) as Array<Record<string, unknown>>).map((item) => ({
        id: String(item.id),
        label: humanizeAuditLabel(String(item.action ?? 'audit')),
        details: item.details ? String(item.details) : undefined,
        actor: item.actor_name ? `${String(item.actor_name)}${item.actor_role ? ` (${String(item.actor_role)})` : ''}` : undefined,
        at: String(item.created_at)
      }))
    }
  });
}
