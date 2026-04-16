import { json } from '../_shared/response';
import { getSession } from '../_shared/session';
import { logAudit } from '../_shared/audit';
import type { Env } from '../_shared/types';

export async function onRequestGet({ request, env }: { request: Request; env: Env }) {
  const session = await getSession(request, env);
  if (!session) {
    return json({ ok: false, error: 'Sessão inválida.' }, { status: 401 });
  }

  if (!env.DB) {
    return json({ ok: true, preferences: { themeMode: 'dark', patientFontLarge: false } });
  }

  const row = await env.DB.prepare(
    `SELECT theme_mode AS themeMode, patient_font_large AS patientFontLarge
     FROM user_preferences
     WHERE user_id = ?
     LIMIT 1`
  )
    .bind(session.user_id)
    .first<{ themeMode: string; patientFontLarge: number }>();

  return json({
    ok: true,
    preferences: {
      themeMode: row?.themeMode === 'light' ? 'light' : 'dark',
      patientFontLarge: Boolean(row?.patientFontLarge)
    }
  });
}

export async function onRequestPost({ request, env }: { request: Request; env: Env }) {
  const session = await getSession(request, env);
  if (!session) {
    return json({ ok: false, error: 'Sessão inválida.' }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    themeMode?: 'dark' | 'light';
    patientFontLarge?: boolean;
  };

  if (!env.DB) {
    return json({ ok: true });
  }

  const themeMode = body.themeMode === 'light' ? 'light' : 'dark';
  const patientFontLarge = body.patientFontLarge ? 1 : 0;

  await env.DB.prepare(
    `
      INSERT INTO user_preferences (user_id, theme_mode, patient_font_large, updated_at)
      VALUES (?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(user_id) DO UPDATE SET
        theme_mode = excluded.theme_mode,
        patient_font_large = excluded.patient_font_large,
        updated_at = CURRENT_TIMESTAMP
    `
  )
    .bind(session.user_id, themeMode, patientFontLarge)
    .run();

  await logAudit(env, {
    entityType: 'user_preferences',
    action: 'preferences.updated',
    details: `theme=${themeMode}; fontLarge=${patientFontLarge}`,
    actorRole: session.role,
    actorName: session.name,
    actorId: session.user_id
  });

  return json({ ok: true });
}
