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

export interface BannerState {
  type: 'success' | 'error';
  message: string;
}

export interface ToastState {
  id: string;
  type: 'success' | 'error';
  message: string;
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
  clientCep?: string;
  clientAddress?: string;
  boardingCep?: string;
  destination: string;
  destinationFacility: string;
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
  destinationFacility: string;
  cep: string;
  street: string;
  number: string;
  neighborhood: string;
  city: string;
  departureAt: string;
  arrivalEta: string;
  companions: string;
  notes: string;
}

export interface ClientFormState {
  name: string;
  document: string;
  phone: string;
  cep: string;
  street: string;
  number: string;
  neighborhood: string;
  city: string;
  address: string;
}

export interface ClientRow {
  id: number;
  name: string;
  document: string;
  phone?: string;
  cep?: string;
  address?: string;
  createdAt?: string;
}

export interface UserRow {
  id: number;
  role: AccessRole;
  name: string;
  document: string;
  pinMustChange: boolean;
  createdAt?: string;
  lastLoginAt?: string | null;
}

export type RequestPatch = Partial<
  Pick<
    TripRequest,
    | 'status'
    | 'destination'
    | 'destinationFacility'
    | 'driver'
    | 'vehicle'
    | 'notes'
    | 'companions'
    | 'arrivalEta'
    | 'boardingPoint'
    | 'boardingCep'
    | 'departureAt'
    | 'phoneVisible'
    | 'clientConfirmedAt'
    | 'pinStatus'
  >
> & {
  message?: string;
};

export interface UserFormState {
  name: string;
  document: string;
  role: AccessRole;
}

export interface VehicleTrip {
  date: string;
  driver: string;
  km: number;
  destination: string;
}

export interface VehicleMaintenanceItem {
  date: string;
  type: string;
  notes?: string;
}

export interface VehicleRecord {
  id: string;
  name: string;
  plate: string;
  fuel: string;
  odometer: number;
  autonomyKm: number;
  lastFuel: {
    date: string;
    liters: number;
    km: number;
  };
  oil: {
    lastKm: number;
    nextKm: number;
  };
  maintenance: VehicleMaintenanceItem[];
  trips: VehicleTrip[];
}
