# Auditoria de Endpoints vs Telas

## 1) Endpoints existentes (Functions)

### Auth
- `POST /api/auth/login` — login por documento + PIN
- `GET /api/auth/me` — sessão ativa
- `POST /api/auth/change-pin` — troca de PIN
- `POST /api/auth/logout` — logout

### Requests
- `GET /api/requests` — lista de solicitações
- `POST /api/requests` — cria solicitação
- `GET /api/requests/:id` — detalhe da solicitação
- `PATCH /api/requests/:id` — atualiza solicitação (status, notas, driver, etc)
- `DELETE /api/requests/:id` — remove solicitação

### Clients
- `GET /api/clients` — lista (com busca)
- `POST /api/clients` — cria cliente
- `PATCH /api/clients/:id` — atualiza cliente
- `DELETE /api/clients/:id` — remove cliente

### Users
- `GET /api/users` — lista usuários
- `POST /api/users` — cria usuário
- `PATCH /api/users/:id` — reset PIN

### Health
- `GET /api/health`

---

## 2) Telas / módulos (Frontend)

### Núcleo operacional
- **Dashboard** (`Dashboard.tsx`)
- **RequestsPanel** (`RequestsPanel.tsx`)
- **RequestDetails** (`RequestDetails.tsx`)

### Gestão
- **UserTable** (`UserTable.tsx`)
- **ClientModal** (`ClientModal.tsx`)
- **BulkOperations** (`BulkOperations.tsx`)

### Experiência e monitoramento
- **MonitoringDashboard** (`MonitoringDashboard.tsx`)
- **GPSTracking** (`GPSTracking.tsx`)
- **Settings** (`Settings.tsx`)

---

## 3) Mapeamento (telas → endpoints)

| Tela/Módulo | Endpoints usados |
| --- | --- |
| Login | `/api/auth/login`, `/api/auth/me`, `/api/auth/change-pin`, `/api/auth/logout` |
| Dashboard / RequestsPanel | `/api/requests` (GET/POST), `/api/requests/:id` (PATCH/DELETE) |
| RequestDetails | `/api/requests/:id` (GET/PATCH), mensagens via `/api/requests/:id` |
| Clients | `/api/clients` (GET/POST), `/api/clients/:id` (PATCH/DELETE) |
| Users | `/api/users` (GET/POST), `/api/users/:id` (PATCH) |

---

## 4) Gaps identificados (o que aparece na UI sem endpoint dedicado)

- **GPS Tracking**: UI existe, mas não há endpoint específico de localização.
- **MonitoringDashboard**: gráficos e KPIs não possuem endpoint dedicado.
- **Bulk Operations**: UI existe, mas ainda não há endpoint de batch no backend.
- **Notificações**: banners e toasts estão no frontend; não há API de push.

---

## 5) Recomendações objetivas

1. Criar endpoints dedicados para **telemetria** e **monitoramento**.
2. Adicionar endpoint de **operações em lote** (PATCH/POST batch).
3. Incluir rate limiting simples no backend (cloudflare/rules ou app-level).
4. Explicitar no README o que é **live** vs **roadmap**.
