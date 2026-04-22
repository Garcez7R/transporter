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

type TripRow = {
  vehicle_id: number;
  departure_at: string;
  destination: string;
  driver: string;
};

type MaintenanceRow = {
  vehicle_id: number;
  maintenance_type: string;
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
    return json({ ok: true, snapshot: { generatedAt: new Date().toISOString(), vehicles: [] } });
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
    `SELECT trip_requests.vehicle_id, trip_requests.departure_at, trip_requests.destination, COALESCE(users.name, '') AS driver
     FROM trip_requests
     LEFT JOIN users ON users.id = trip_requests.driver_id
     WHERE trip_requests.vehicle_id IS NOT NULL
     ORDER BY trip_requests.departure_at DESC`
  ).all<TripRow>();

  const maintenanceResult = await env.DB.prepare(
    `SELECT vehicle_id, maintenance_type, notes, scheduled_for, completed_at, created_at
     FROM vehicle_maintenance_logs
     ORDER BY COALESCE(completed_at, scheduled_for, created_at) DESC`
  ).all<MaintenanceRow>().catch(() => ({ results: [] }));

  const activeTripsResult = await env.DB.prepare(
    `SELECT vehicle_id, COUNT(*) AS total
     FROM trip_requests
     WHERE vehicle_id IS NOT NULL AND status IN ('agendada', 'em_rota', 'em_atendimento')
     GROUP BY vehicle_id`
  ).all<{ vehicle_id: number; total: number }>();

  const fuelRows = (fuelResult.results ?? []) as FuelRow[];
  const tripRows = (tripsResult.results ?? []) as TripRow[];
  const maintenanceRows = (maintenanceResult.results ?? []) as MaintenanceRow[];
  const activeTripRows = (activeTripsResult.results ?? []) as Array<{ vehicle_id: number; total: number }>;

  const vehicles = ((vehiclesResult.results ?? []) as Array<Record<string, unknown>>).map((vehicle) => {
    const vehicleId = Number(vehicle.id);
    const fuelLogs = fuelRows.filter((item) => item.vehicle_id === vehicleId);
    const lastFuel = fuelLogs[0];
    const trips = tripRows
      .filter((item) => item.vehicle_id === vehicleId)
      .slice(0, 8)
      .map((trip, index, list) => ({
        date: String(trip.departure_at).slice(0, 10),
        driver: trip.driver || 'Sem motorista',
        km:
          index < list.length - 1 && fuelLogs[0]
            ? Math.max(0, Number(fuelLogs[0].odometer_km) - Number(fuelLogs[Math.min(index + 1, fuelLogs.length - 1)]?.odometer_km ?? fuelLogs[0].odometer_km))
            : 0,
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

    const activeTripsCount = activeTripRows.find((item) => item.vehicle_id === vehicleId)?.total ?? 0;
    const derivedOdometer = lastFuel ? Number(lastFuel.odometer_km) : 0;
    const avgLiters = fuelLogs.length ? fuelLogs.reduce((sum, item) => sum + Number(item.liters), 0) / fuelLogs.length : 0;
    const autonomyKm = avgLiters ? Math.round(avgLiters * 8.5) : 0;

    return {
      id: String(vehicle.id),
      name: String(vehicle.model),
      plate: String(vehicle.plate),
      fuel: lastFuel?.fuel_type || 'Não informado',
      status: String(vehicle.status ?? 'available'),
      odometer: derivedOdometer,
      autonomyKm,
      lastFuel: {
        date: lastFuel?.created_at ? String(lastFuel.created_at) : 'Sem registro',
        liters: lastFuel ? Number(lastFuel.liters) : 0,
        km: derivedOdometer
      },
      oil: {
        lastKm: Math.max(0, derivedOdometer - 5000),
        nextKm: Math.max(0, derivedOdometer + 5000)
      },
      maintenance,
      trips,
      fuelLogsCount: fuelLogs.length,
      activeTripsCount
    };
  });

  return json({
    ok: true,
    snapshot: {
      generatedAt: new Date().toISOString(),
      vehicles
    }
  });
}
