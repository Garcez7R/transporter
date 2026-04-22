import { json } from '../_shared/response';
import { getSession } from '../_shared/session';
import type { Env } from '../_shared/types';

type FuelRow = {
  vehicle_id: number;
  liters: number;
  odometer_km: number;
  fuel_type: string | null;
  created_at: string;
};

type MetricRow = {
  vehicle_id: number;
  odometer_km: number;
  autonomy_km: number;
  fuel_type: string | null;
  oil_last_km: number;
  oil_next_km: number;
  updated_at: string;
};

type TripRow = {
  vehicle_id: number;
  departure_at: string;
  destination: string;
  driver: string;
  distance_km: number | null;
};

type MaintenanceRow = {
  vehicle_id: number;
  maintenance_type: string;
  odometer_km: number | null;
  notes: string | null;
  scheduled_for: string | null;
  completed_at: string | null;
  created_at: string;
};

export async function onRequestGet({ request, env }: { request: Request; env: Env }) {
  const session = await getSession(request, env);
  if (!session) {
    return json({ ok: false, error: 'Sessão inválida.' }, { status: 401 });
  }

  if (!env.DB) {
    return json({ ok: true, snapshot: { generatedAt: new Date().toISOString(), source: 'fallback', vehicles: [] } });
  }

  const vehiclesResult = await env.DB.prepare(
    `SELECT id, plate, model, status FROM vehicles ORDER BY model, plate`
  ).all<Record<string, unknown>>();

  const fuelResult = await env.DB.prepare(
    `SELECT vehicle_id, liters, odometer_km, fuel_type, created_at
     FROM vehicle_fuel_logs
     ORDER BY created_at DESC`
  ).all<FuelRow>().catch(() => ({ results: [] }));

  const tripsResult = await env.DB.prepare(
    `SELECT trip_requests.vehicle_id, trip_requests.departure_at, trip_requests.destination, trip_requests.distance_km, COALESCE(users.name, '') AS driver
     FROM trip_requests
     LEFT JOIN users ON users.id = trip_requests.driver_id
     WHERE trip_requests.vehicle_id IS NOT NULL
     ORDER BY trip_requests.departure_at DESC`
  ).all<TripRow>();

  const maintenanceResult = await env.DB.prepare(
    `SELECT vehicle_id, maintenance_type, odometer_km, notes, scheduled_for, completed_at, created_at
     FROM vehicle_maintenance_logs
     ORDER BY COALESCE(completed_at, scheduled_for, created_at) DESC`
  ).all<MaintenanceRow>().catch(() => ({ results: [] }));

  const activeTripsResult = await env.DB.prepare(
    `SELECT vehicle_id, COUNT(*) AS total
     FROM trip_requests
     WHERE vehicle_id IS NOT NULL AND status IN ('agendada', 'em_rota', 'em_atendimento')
     GROUP BY vehicle_id`
  ).all<{ vehicle_id: number; total: number }>();

  const metricsResult = await env.DB.prepare(
    `SELECT vehicle_id, odometer_km, autonomy_km, fuel_type, oil_last_km, oil_next_km, updated_at
     FROM vehicle_metrics`
  ).all<MetricRow>().catch(() => ({ results: [] }));

  const fuelRows = (fuelResult.results ?? []) as FuelRow[];
  const tripRows = (tripsResult.results ?? []) as TripRow[];
  const maintenanceRows = (maintenanceResult.results ?? []) as MaintenanceRow[];
  const activeTripRows = (activeTripsResult.results ?? []) as Array<{ vehicle_id: number; total: number }>;
  const metricRows = (metricsResult.results ?? []) as MetricRow[];

  const vehicles = ((vehiclesResult.results ?? []) as Array<Record<string, unknown>>).map((vehicle) => {
    const vehicleId = Number(vehicle.id);
    const fuelLogs = fuelRows.filter((item) => item.vehicle_id === vehicleId);
    const lastFuel = fuelLogs[0];
    const metrics = metricRows.find((item) => item.vehicle_id === vehicleId);
    const trips = tripRows
      .filter((item) => item.vehicle_id === vehicleId)
      .slice(0, 8)
      .map((trip) => ({
        date: String(trip.departure_at).slice(0, 10),
        driver: trip.driver || 'Sem motorista',
        km: Number(trip.distance_km ?? 0),
        destination: trip.destination
      }));

    const maintenance = maintenanceRows
      .filter((item) => item.vehicle_id === vehicleId)
      .slice(0, 8)
      .map((item) => ({
        date: item.completed_at ?? item.scheduled_for ?? item.created_at,
        type: item.maintenance_type,
        notes: item.notes ?? undefined
      }));

    const oilMaintenance = maintenanceRows.find(
      (item) =>
        item.vehicle_id === vehicleId &&
        item.odometer_km !== null &&
        item.maintenance_type.toLowerCase().includes('óleo')
    );

    const activeTripsCount = activeTripRows.find((item) => item.vehicle_id === vehicleId)?.total ?? 0;
    const persistedOdometer = Number(metrics?.odometer_km ?? 0);
    const autonomyKm = Math.round(Number(metrics?.autonomy_km ?? 0));
    const oilLastKm = Number(metrics?.oil_last_km ?? oilMaintenance?.odometer_km ?? 0);
    const oilNextKm = Number(metrics?.oil_next_km ?? (oilMaintenance?.odometer_km ? Number(oilMaintenance.odometer_km) + 5000 : 0));

    return {
      id: String(vehicle.id),
      name: String(vehicle.model),
      plate: String(vehicle.plate),
      fuel: metrics?.fuel_type || lastFuel?.fuel_type || 'Não informado',
      status: String(vehicle.status ?? 'available'),
      odometer: persistedOdometer,
      autonomyKm,
      lastFuel: {
        date: lastFuel?.created_at ? String(lastFuel.created_at) : 'Sem registro',
        liters: lastFuel ? Number(lastFuel.liters) : 0,
        km: persistedOdometer
      },
      oil: {
        lastKm: oilLastKm,
        nextKm: oilNextKm
      },
      maintenance,
      trips,
      fuelLogsCount: fuelLogs.length,
      activeTripsCount,
      dataIntegrity: metrics ? 'persisted' : 'partial'
    };
  });

  return json({
    ok: true,
    snapshot: {
      generatedAt: new Date().toISOString(),
      source: 'backend',
      vehicles
    }
  });
}
