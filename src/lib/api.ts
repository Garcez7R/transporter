import type { SessionUser, TripRequest, RequestStatus } from '../types';

type ApiSession = Omit<SessionUser, 'token'> & { token?: string };

type ApiEnvelope = {
  ok: boolean;
  error?: string;
  session?: ApiSession | null;
  token?: string;
  mustChangePin?: boolean;
};

type ApiResponse<T = Record<string, never>> = ApiEnvelope & T;

async function request<T>(path: string, init?: RequestInit, token?: string): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init?.headers ?? {})
    }
  });

  const body = (await response.json().catch(() => ({}))) as T & { error?: string };

  if (!response.ok) {
    throw new Error(body.error ?? 'Falha na requisição.');
  }

  return body;
}

export async function login(document: string, pin: string) {
  return request<ApiResponse<{ session: ApiSession }>>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ document, pin })
  });
}

export async function me(token: string) {
  return request<ApiResponse<{ session: ApiSession | null }>>('/api/auth/me', undefined, token);
}

export async function changePin(token: string, newPin: string) {
  return request<ApiResponse<{ mustChangePin: boolean }>>(
    '/api/auth/change-pin',
    {
      method: 'POST',
      body: JSON.stringify({ newPin })
    },
    token
  );
}

export async function logout(token: string) {
  return request<ApiResponse<Record<string, never>>>(
    '/api/auth/logout',
    {
      method: 'POST'
    },
    token
  );
}

export async function listRequests(token?: string) {
  return request<ApiResponse<{ rows: TripRequest[] }>>('/api/requests', undefined, token);
}

export async function createRequest(
  payload: {
    clientName: string;
    document: string;
    phone: string;
    destination: string;
    boardingPoint: string;
    departureAt: string;
    arrivalEta: string;
    notes: string;
    companions: string;
  },
  token?: string
) {
  return request<ApiResponse<{ row: TripRequest }>>(
    '/api/requests',
    {
      method: 'POST',
      body: JSON.stringify(payload)
    },
    token
  );
}

export async function updateRequest(
  id: string,
  payload: {
    status?: RequestStatus;
    destination?: string;
    driver?: string;
    vehicle?: string;
    notes?: string;
    companions?: string;
    boardingPoint?: string;
    departureAt?: string;
    arrivalEta?: string;
    phoneVisible?: boolean;
    clientConfirmedAt?: string;
    pinStatus?: TripRequest['pinStatus'];
    message?: string;
  },
  token?: string
) {
  return request<ApiResponse<Record<string, never>>>(
    `/api/requests/${id}`,
    {
      method: 'PATCH',
      body: JSON.stringify(payload)
    },
    token
  );
}

export async function getRequest(id: string, token?: string) {
  return request<ApiResponse<{ item: TripRequest }>>(`/api/requests/${id}`, undefined, token);
}

export type UserRow = {
  id: number;
  role: string;
  name: string;
  document: string;
  pinMustChange: number;
  createdAt?: string;
  lastLoginAt?: string | null;
};

export type ClientRow = {
  id: number;
  name: string;
  document: string;
  phone?: string;
  cep?: string;
  address?: string;
  createdAt?: string;
};

export async function listUsers(token?: string) {
  return request<ApiResponse<{ rows: UserRow[] }>>('/api/users', undefined, token);
}

export async function createUser(
  payload: {
    name: string;
    document: string;
    role: 'cliente' | 'operador' | 'gerente' | 'motorista' | 'administrador';
  },
  token?: string
) {
  return request<ApiResponse<{ row: UserRow }>>(
    '/api/users',
    {
      method: 'POST',
      body: JSON.stringify(payload)
    },
    token
  );
}

export async function resetUserPin(id: number | string, token?: string) {
  return request<ApiResponse<{ ok: boolean }>>(
    `/api/users/${id}`,
    {
      method: 'PATCH',
      body: JSON.stringify({ resetPin: true })
    },
    token
  );
}

export async function listClients(token?: string, query?: string) {
  const params = query ? `?q=${encodeURIComponent(query)}` : '';
  return request<ApiResponse<{ rows: ClientRow[] }>>(`/api/clients${params}`, undefined, token);
}

export async function createClient(
  payload: {
    name: string;
    document: string;
    phone?: string;
    cep?: string;
    address?: string;
  },
  token?: string
) {
  return request<ApiResponse<{ row: ClientRow }>>(
    '/api/clients',
    {
      method: 'POST',
      body: JSON.stringify(payload)
    },
    token
  );
}

export async function updateClient(
  id: number | string,
  payload: {
    name?: string;
    document?: string;
    phone?: string;
    cep?: string;
    address?: string;
  },
  token?: string
) {
  return request<ApiResponse<{ row: ClientRow }>>(
    `/api/clients/${id}`,
    {
      method: 'PATCH',
      body: JSON.stringify(payload)
    },
    token
  );
}
