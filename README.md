# Transporter

Plataforma web com suporte a PWA para gestão de transporte e logística de passageiros ou pequenas cargas.

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
```

## Acesso inicial

- O PIN inicial de todos os perfis é `0000`.
- No primeiro acesso, o sistema exige troca obrigatória do PIN.
- Os perfis de demonstração estão disponíveis na tela de login.

## Próximos passos sugeridos

1. Ligar o projeto a um banco `D1` real.
2. Implementar autenticação por `CPF/CNPJ + PIN`.
3. Criar as telas de `operador`, `gerente`, `motorista` e `cliente`.
4. Adicionar rotas de mensagens, histórico e auditoria.
