export const SESSION_KEY = 'transporter:session';
export const REQUESTS_KEY = 'transporter:requests';

export function normalizeDocument(value: string) {
  return value.replace(/\D/g, '');
}

export function formatDocument(value: string) {
  const digits = normalizeDocument(value).slice(0, 14);

  if (digits.length <= 11) {
    if (digits.length <= 3) return digits;
    if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
    if (digits.length <= 9) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
    return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9, 11)}`;
  }

  if (digits.length <= 2) return digits;
  if (digits.length <= 5) return `${digits.slice(0, 2)}.${digits.slice(2)}`;
  if (digits.length <= 8) return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5)}`;
  if (digits.length <= 12) return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8)}`;
  return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(12, 14)}`;
}

export function readJson<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;

  const raw = window.localStorage.getItem(key);
  if (!raw) return fallback;

  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function writeJson(key: string, value: unknown) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(key, JSON.stringify(value));
}

export function removeItem(key: string) {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(key);
}

export function createRequestId() {
  return `req-${crypto.randomUUID().slice(0, 8)}`;
}

export function createProtocol(index: number) {
  const year = new Date().getFullYear();
  return `TRP-${year}-${String(480 + index).padStart(5, '0')}`;
}

export function currentStamp() {
  return new Date().toLocaleString('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short'
  });
}
