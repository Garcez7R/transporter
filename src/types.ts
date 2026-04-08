export type AccessRole = 'cliente' | 'operador' | 'gerente' | 'motorista' | 'administrador';

export type RequestStatus =
  | 'rascunho'
  | 'em_atendimento'
  | 'aguardando_distribuicao'
  | 'agendada'
  | 'em_rota'
  | 'concluida'
  | 'cancelada';

export interface DemoUser {
  name: string;
  document: string;
  role: AccessRole;
  pin: string;
  mustChangePin: boolean;
}

export interface SessionUser {
  name: string;
  document: string;
  role: AccessRole;
  mustChangePin: boolean;
  token: string;
}

export interface MessageItem {
  id: string;
  author: string;
  role: AccessRole | 'sistema';
  body: string;
  at: string;
  internal: boolean;
  readAt?: string | null;
}

export interface AuditItem {
  id: string;
  label: string;
  details?: string;
  actor?: string;
  at: string;
}

export interface TripRequest {
  id: string;
  protocol: string;
  clientName: string;
  document: string;
  phone: string;
  destination: string;
  boardingPoint: string;
  departureAt: string;
  arrivalEta: string;
  status: RequestStatus;
  driver: string;
  vehicle: string;
  notes: string;
  companions: string;
  phoneVisible: boolean;
  pinStatus: 'active' | 'reset' | 'first_access';
  clientConfirmedAt?: string;
  messages: MessageItem[];
  audit: AuditItem[];
}

export interface ProfileSummary {
  role: AccessRole;
  label: string;
  count: number;
  highlight: string;
  description: string;
}

export interface FleetMember {
  name: string;
  role: 'Motorista' | 'Veículo';
  status: 'disponível' | 'em_viagem' | 'manutenção';
  badge: string;
}

export interface RequestFormState {
  clientName: string;
  document: string;
  phone: string;
  destination: string;
  boardingPoint: string;
  departureAt: string;
  arrivalEta: string;
  companions: string;
  notes: string;
}

export interface UserFormState {
  name: string;
  document: string;
  role: AccessRole;
  pin: string;
}
