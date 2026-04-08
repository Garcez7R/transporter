import type { SessionUser, TripRequest, RequestStatus } from '../types';

type ApiSession = Omit<SessionUser, 'token'> & { token?: string };

type ApiResponse<T> = {
  ok: boolean;
  error?: string;
  session?: ApiSession | null;
  rows?: TripRequest[];
  row?: TripRequest | { id?: number | string; protocol?: string };
  item?: TripRequest;
  token?: string;
  mustChangePin?: boolean;
};

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
