import type { Env } from './types';

type SplunkEvent = {
  tripRequestId?: number | null;
  entityType: string;
  action: string;
  details?: string;
  actorRole?: string | null;
  actorName?: string | null;
  actorId?: number | null;
};

function maskCpf(value?: string) {
  if (!value) return value;
  return value
    .replace(/\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/g, '***.***.***-**')
    .replace(/\b\d{11}\b/g, '***CPF***');
}

export async function sendSplunkEvent(env: Env, payload: SplunkEvent) {
  if (!env.SPLUNK_HEC_URL || !env.SPLUNK_HEC_TOKEN) return;

  const event = {
    time: Math.floor(Date.now() / 1000),
    host: 'transporter',
    source: 'worker',
    sourcetype: 'transporter',
    event: {
      tripRequestId: payload.tripRequestId ?? null,
      entityType: payload.entityType,
      action: payload.action,
      details: maskCpf(payload.details),
      actorRole: payload.actorRole ?? null,
      actorName: payload.actorName ?? null,
      actorId: payload.actorId ?? null
    }
  };

  try {
    await fetch(env.SPLUNK_HEC_URL, {
      method: 'POST',
      headers: {
        Authorization: `Splunk ${env.SPLUNK_HEC_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(event)
    });
  } catch {
    // ignore splunk failures
  }
}
