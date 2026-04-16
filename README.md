# Transporter

Plataforma web para gestão de transporte de pacientes, com foco em operação diária, distribuição de rotas, rastreabilidade e controle de acesso por perfil.

## Estado atual

O projeto já funciona como um app operacional real, com base serverless em Cloudflare Pages Functions + D1 e frontend em React/Vite.

Hoje o Transporter já entrega:
- login por sessão e troca obrigatória de PIN
- perfis separados para paciente, operador, gerente, motorista e administrador
- criação, edição e exclusão de solicitações
- distribuição de rota com motorista, veículo, ordem e data
- sidebar operacional com calendário, filtros rápidos e conflitos
- auditoria central de eventos relevantes
- monitoramento alimentado por backend
- registro operacional de abastecimento e pings de GPS por viagem
- preferências de UI por usuário no backend
- exportação operacional em `JSON` e `CSV`

## Arquitetura

### Frontend
- React 19
- TypeScript
- Vite
- PWA com service worker
- CSS customizado

### Backend
- Cloudflare Pages Functions
- Cloudflare D1
- API REST com sessão por token

### Camadas importantes
- `src/`: UI, hooks e integração com API
- `functions/api/`: endpoints do backend
- `functions/_shared/`: sessão, auditoria, segurança, operações
- `migrations/`: evolução incremental do banco

## Fluxos principais

### Operador
- cadastra paciente e solicitação
- acompanha solicitações recentes
- edita dados operacionais

### Gerente
- filtra agenda por data e localidade
- monta rota por motorista e veículo
- salva ordem operacional da fila
- enxerga conflitos e sugestões de agrupamento

### Motorista
- recebe viagens já distribuídas
- inicia e conclui rota
- registra abastecimento por viagem
- envia rastreio GPS da sessão

### Administrador
- visualiza operação de forma global
- acessa auditoria consolidada
- gerencia usuários e governança

## Banco e migrations

O banco evolui por migrations incrementais. As mais relevantes hoje:
- `0001_init.sql`: estrutura base
- `0004_audit_log.sql`: trilha de auditoria
- `0008_route_order.sql`: ordem e data de rota
- `0009_push_subscriptions.sql`: base para push web
- `0010_operational_sync.sql`: telemetria operacional, preferências e eventos

Para aplicar no D1 remoto:

```bash
npx wrangler d1 migrations apply transporter --remote
```

## Desenvolvimento local

```bash
npm install
npm run dev
```

Build de produção:

```bash
npm run build
```

## Deploy

O projeto está preparado para Cloudflare Pages.

Push normal:

```bash
git push
```

Se precisar deploy manual:

```bash
npm run cf:deploy
```

## Variáveis importantes

Para push web e sessão completa, confira no ambiente:
- `JWT_SECRET`
- `VITE_VAPID_PUBLIC_KEY`
- `VAPID_PUBLIC_KEY`
- `VAPID_PRIVATE_KEY`
- `VAPID_SUBJECT`

## Documentação complementar

- [docs/ARCHITECTURE_MAP.md](./docs/ARCHITECTURE_MAP.md)
- [docs/ENDPOINTS_AUDIT.md](./docs/ENDPOINTS_AUDIT.md)

## Roadmap natural

Os próximos passos mais fortes agora são:
- bloqueio duro de conflitos críticos no salvamento da rota
- manutenção persistida de veículos
- timeline operacional mais rica por viagem e por motorista
- monitoramento com séries históricas reais
- push operacional por perfil com regras mais refinadas

## Resumo

O Transporter já saiu da fase de mock operacional e entrou numa base de produto real. O foco daqui para frente é endurecer regras, enriquecer telemetria e consolidar governança sem perder a clareza do fluxo diário.
