import type { ClientFormState, RequestFormState, RequestStatus, SessionUser, TripRequest } from '../types';
import { formatCep } from './persistence';

export function splitDateTime(value: string) {
  if (!value) return { date: '', time: '' };
  if (value.includes('T')) {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) {
      return {
        date: parsed.toISOString().slice(0, 10),
        time: parsed.toTimeString().slice(0, 5)
      };
    }
  }
  const [datePart = '', timePart = ''] = value.split(' ');
  if (datePart.includes('/')) {
    const [day, month, year] = datePart.split('/');
    if (day && month && year) {
      return { date: `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`, time: timePart.slice(0, 5) };
    }
  }
  if (datePart.includes('-')) {
    return { date: datePart, time: timePart.slice(0, 5) };
  }
  if (timePart) return { date: '', time: timePart.slice(0, 5) };
  if (datePart.includes(':')) return { date: '', time: datePart.slice(0, 5) };
  return { date: '', time: '' };
}

export function buildDateTime(date: string, time: string) {
  if (!date && !time) return '';
  if (!date) return time;
  if (!time) return date;
  return `${date} ${time}`;
}

export function formatSchedule(value: string) {
  if (!value) return '-';
  const parsed = new Date(value);
  if (!Number.isNaN(parsed.getTime())) {
    const date = parsed.toLocaleDateString('pt-BR');
    const time = parsed.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', hour12: false });
    return `${date} ${time}`;
  }
  return value;
}

export function parseAddress(value: string) {
  const [streetPart = '', rest = ''] = value.split(',');
  const [numberPart = '', tail = ''] = rest.split('-');
  const [neighborhood = '', city = ''] = tail.split(',');
  return {
    street: streetPart.trim(),
    number: numberPart.trim(),
    neighborhood: neighborhood.trim(),
    city: city.trim()
  };
}

export function buildAddressFromFields(fields: { street: string; number: string; neighborhood: string; city: string }) {
  const street = fields.street.trim();
  const number = fields.number.trim();
  const neighborhood = fields.neighborhood.trim();
  const city = fields.city.trim();
  if (!street || !number || !neighborhood || !city) return '';
  return `${street}, ${number} - ${neighborhood}, ${city}`;
}

export function buildCompanionPayload(mode: 'nao' | 'sim', name: string, cpf: string) {
  if (mode === 'nao') return 'Não';
  const trimmedName = name.trim();
  const trimmedCpf = cpf.trim();
  if (!trimmedName || !trimmedCpf) return 'Não';
  return `Sim: ${trimmedName} (${trimmedCpf})`;
}

export function parseCompanion(value: string) {
  if (!value) return { mode: 'nao' as const, name: '', cpf: '' };
  if (!value.toLowerCase().startsWith('sim:')) return { mode: 'nao' as const, name: '', cpf: '' };
  const match = value.match(/sim:\s*(.+)\s+\((.+)\)/i);
  if (!match?.[1] || !match?.[2]) return { mode: 'sim' as const, name: '', cpf: '' };
  return { mode: 'sim' as const, name: match[1].trim(), cpf: match[2].trim() };
}

export function formatAddressDisplay(address: string, cep?: string | null) {
  if (!address) return '-';
  const parsed = parseAddress(address);
  const hasStructured = parsed.street && parsed.number && parsed.neighborhood && parsed.city;
  const base = hasStructured ? `${parsed.street}, ${parsed.number} - ${parsed.neighborhood}, ${parsed.city}` : address;
  const formattedCep = formatCep(cep ?? '');
  return formattedCep ? `${base} · CEP ${formattedCep}` : base;
}

export function buildMapQuery(request: TripRequest) {
  const parts = [request.boardingPoint, request.clientAddress, request.boardingCep, request.clientCep].filter(Boolean);
  if (!parts.length) return '';
  return parts.join(', ');
}

export function getInitials(name: string) {
  const cleaned = name.trim().replace(/\s+/g, ' ');
  if (!cleaned) return '??';
  const parts = cleaned.split(' ');
  const first = parts[0]?.[0] ?? '';
  const last = parts.length > 1 ? parts[parts.length - 1]?.[0] ?? '' : parts[0]?.[1] ?? '';
  return `${first}${last}`.toUpperCase();
}

export function parseDate(value: string) {
  if (!value) return null;
  if (value.includes('T')) {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  const datePart = value.split(' ')[0] ?? '';
  const [day, month, year] = datePart.split('/').map((item) => Number(item));
  if (!day || !month || !year) return null;
  const parsed = new Date(year, month - 1, day);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function isToday(value: string) {
  const parsed = parseDate(value);
  if (!parsed) return false;
  const today = new Date();
  return (
    parsed.getFullYear() === today.getFullYear() &&
    parsed.getMonth() === today.getMonth() &&
    parsed.getDate() === today.getDate()
  );
}

export function filteredRequests(requests: TripRequest[], session: SessionUser | null, filterText = '') {
  const normalizedFilter = filterText.trim().toLowerCase();

  const base = requests.filter((request) => {
    if (!session) return true;
    if (session.role === 'cliente') return normalizeDocument(request.document) === normalizeDocument(session.document);
    if (session.role === 'motorista') return request.driver.toLowerCase() === session.name.toLowerCase();
    return true;
  });

  if (!normalizedFilter) return base;

  return base.filter((request) =>
    [request.protocol, request.clientName, request.destination, request.driver, request.vehicle]
      .join(' ')
      .toLowerCase()
      .includes(normalizedFilter)
  );
}

function normalizeDocument(value: string) {
  return value.replace(/\D/g, '');
}
