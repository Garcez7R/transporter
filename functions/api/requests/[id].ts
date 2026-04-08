import { json } from '../../_shared/response';
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
  message?: string;
};

export async function onRequestPatch({
  request,
  env,
  params
}: {
  request: Request;
  env: Env;
  params: { id: string };
}) {
  const body = (await request.json().catch(() => ({}))) as UpdateBody;
  const requestId = Number(params.id);
  const db = env.DB;

  if (!requestId) {
    return json({ ok: false, error: 'ID inválido.' }, { status: 400 });
  }

  if (!db) {
    return json({ ok: true, id: requestId, patch: body });
  }

  const current = await db.prepare('SELECT * FROM trip_requests WHERE id = ? LIMIT 1')
    .bind(requestId)
    .first<{ status: string }>();

  if (!current) {
    return json({ ok: false, error: 'Solicitação não encontrada.' }, { status: 404 });
  }

  const updates: string[] = [];
  const values: unknown[] = [];

  const setField = (field: string, value: unknown) => {
    updates.push(`${field} = ?`);
    values.push(value);
  };

  const resolveUserId = async (value: string | undefined) => {
    if (!value) return null;
    const numeric = Number(value);
    if (Number.isFinite(numeric) && numeric > 0) return numeric;

    const user = await db.prepare('SELECT id FROM users WHERE name = ? LIMIT 1').bind(value).first<{ id: number }>();
    return user?.id ?? null;
  };

  const resolveVehicleId = async (value: string | undefined) => {
    if (!value) return null;
    const numeric = Number(value);
    if (Number.isFinite(numeric) && numeric > 0) return numeric;

    const vehicle = await db.prepare('SELECT id FROM vehicles WHERE plate = ? OR model = ? LIMIT 1')
      .bind(value, value)
      .first<{ id: number }>();
    return vehicle?.id ?? null;
  };

  if (body.status) setField('status', body.status);
  if (body.driver !== undefined) setField('driver_id', await resolveUserId(body.driver));
  if (body.vehicle !== undefined) setField('vehicle_id', await resolveVehicleId(body.vehicle));
  if (body.notes !== undefined) setField('notes', body.notes);
  if (body.companions !== undefined) setField('companions', body.companions);
  if (body.boardingPoint !== undefined) setField('boarding_point', body.boardingPoint);
  if (body.departureAt !== undefined) setField('departure_at', body.departureAt);
  if (body.arrivalEta !== undefined) setField('arrival_eta', body.arrivalEta);
  if (body.phoneVisible !== undefined) setField('phone_visible', body.phoneVisible ? 1 : 0);

  if (!updates.length) {
    return json({ ok: false, error: 'Nenhuma alteração enviada.' }, { status: 400 });
  }

  setField('updated_at', new Date().toISOString());
  values.push(requestId);

  await db.prepare(`UPDATE trip_requests SET ${updates.join(', ')} WHERE id = ?`)
    .bind(...values)
    .run();

  if (body.message) {
    await db.prepare(
      'INSERT INTO messages (trip_request_id, author_role, author_name, body, is_internal) VALUES (?, ?, ?, ?, ?)'
    )
      .bind(requestId, 'gerente', 'Painel Gerencial', body.message, 1)
      .run();
  }

  return json({ ok: true });
}
