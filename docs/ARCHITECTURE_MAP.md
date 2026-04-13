# Transporter — Mapa de Arquitetura (Camadas + Fluxos)

## 1) Camadas principais

```
UI (React)
├─ App.tsx (orquestração)
├─ components/* (UI + módulos)
├─ hooks/* (estado + regras de negócio)
└─ lib/* (API, persistência, utilitários)

API (Cloudflare Functions)
├─ api/auth/* (login, me, change-pin, logout)
├─ api/requests* (CRUD e mensagens)
├─ api/clients* (CRUD)
└─ api/users* (CRUD + reset PIN)

Shared (Functions)
├─ _shared/session.ts (sessão)
├─ _shared/security.ts (hash/token)
├─ _shared/audit.ts (logs)
├─ _shared/response.ts (respostas JSON)
└─ _shared/logging.ts (observabilidade)

Persistência (D1)
├─ d1/schema.sql + seed.sql
└─ migrations/0001..0007 (histórico de evolução)
```

## 2) Fluxos principais (alto nível)

```
[Login] -> /api/auth/login -> session token
             |
             v
        /api/auth/me

[Solicitações]
  list -> /api/requests (GET)
  create -> /api/requests (POST)
  detail -> /api/requests/:id (GET)
  update -> /api/requests/:id (PATCH)
  delete -> /api/requests/:id (DELETE)

[Clientes]
  list -> /api/clients (GET)
  create -> /api/clients (POST)
  update/delete -> /api/clients/:id (PATCH/DELETE)

[Usuários]
  list -> /api/users (GET)
  create -> /api/users (POST)
  reset pin -> /api/users/:id (PATCH)
```

## 3) Módulos do Frontend (sedimentados)

### Núcleo de domínio
- `hooks/useRequests.ts` — requests, filtros, operações e mensagens
- `hooks/useClients.ts` — clientes e cadastros
- `hooks/useUsers.ts` — perfis e controle de acesso
- `hooks/useSession.ts` — sessão, PIN e logout

### Experiência e camada técnica
- `hooks/useOffline.ts` — estado offline/online e feedback
- `hooks/useNotifications.ts` — banners, toasts e estado global
- `lib/api.ts` — cliente HTTP para funções serverless
- `lib/persistence.ts` — normalização de CPF/CEP e helpers

### UI (componentizada)
- `Dashboard`, `RequestsPanel`, `RequestDetails`
- `GPSTracking`, `MonitoringDashboard`, `Settings`
- `UserTable`, `ClientModal`, `BulkOperations`

## 4) Evolução do modelo (migrations)

- `0001_init.sql` — base inicial
- `0002_seed.sql` — dados iniciais
- `0003_client_users.sql` — usuários e clientes
- `0004_audit_log.sql` — auditoria
- `0005_messages_read.sql` — leitura de mensagens
- `0006_client_cep.sql` — CEP cliente
- `0007_boarding_cep.sql` — CEP embarque

## 5) Observações arquiteturais

- Estrutura já separa **UI, estado, API e persistência**.
- `functions/_shared/*` reduz duplicação e concentra políticas.
- Próximo salto: **documentar o que é “live” vs “roadmap”**.
