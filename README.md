# Transporter

Plataforma web com suporte a PWA para gestão de transporte de pacientes e operação pública, sem vínculo com cidade específica.

## Base do projeto

- `React + TypeScript + Vite`
- `Cloudflare Pages Functions`
- `Cloudflare D1`
- `PWA` com `manifest.webmanifest` e `sw.js`

## Estrutura

- `src/` interface principal
- `functions/` backend serverless
- `d1/` schema e seed iniciais
- `public/` assets da PWA

## Scripts

```bash
npm install
npm run dev
npm run build
npm run cf:login
npm run cf:d1:create
npm run cf:d1:apply
npm run cf:deploy
```

## GitHub Automation

O repositório já vem com um workflow em [`.github/workflows/deploy.yml`](/home/rgarcez/Documentos/transporter/.github/workflows/deploy.yml) que publica automaticamente no Cloudflare Pages sempre que houver `push` na branch `main`.

Secrets necessários no GitHub:

- `CLOUDFLARE_ACCOUNT_ID`
- `CLOUDFLARE_API_TOKEN`

Se quiser disparar manualmente, o workflow também aceita `workflow_dispatch`.

## Acesso inicial

- O PIN inicial de todos os perfis é `0000`.
- No primeiro acesso, o sistema exige troca obrigatória do PIN.
- Os perfis de demonstração estão disponíveis na tela de login.

## Próximos passos sugeridos

1. Rodar `npm run cf:d1:create` e colar o `database_id` gerado em [wrangler.toml](/home/rgarcez/Documentos/transporter/wrangler.toml).
2. Aplicar schema e seed com `npm run cf:d1:apply`.
3. Conectar o repositório GitHub ao projeto Pages no Cloudflare apontando para `main`.
4. Publicar com `npm run cf:deploy` ou deixar o Pages fazer o deploy automático via GitHub.

## Cloudflare

Arquivos já preparados:

- [wrangler.toml](/home/rgarcez/Documentos/transporter/wrangler.toml)
- [functions/](/home/rgarcez/Documentos/transporter/functions)
- [d1/migrations/0001_init.sql](/home/rgarcez/Documentos/transporter/d1/migrations/0001_init.sql)
- [d1/migrations/0002_seed.sql](/home/rgarcez/Documentos/transporter/d1/migrations/0002_seed.sql)
