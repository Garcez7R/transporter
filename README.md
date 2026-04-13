# 🚑 Transporter - Sistema de Transporte de Pacientes

[![Build Status](https://img.shields.io/badge/build-passing-brightgreen)](https://github.com/your-repo/transporter/actions)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-19+-61dafb)](https://reactjs.org/)
[![Cloudflare](https://img.shields.io/badge/Cloudflare-Pages-orange)](https://pages.cloudflare.com/)
[![License](https://img.shields.io/badge/license-MIT-green)](LICENSE)

> **Plataforma web para gestão de transporte de pacientes** — foco em operação, rastreabilidade e controle de acesso.

## 📋 Visão Geral

O **Transporter** é uma solução para gestão de transporte de pacientes, desenvolvida com arquitetura serverless e módulos bem separados. O objetivo é oferecer uma operação clara para equipes internas, com controle de acesso por perfil e fluxo completo de solicitações.

### ✨ Principais Características

- 🔐 **Controle de Acesso**: 5 perfis distintos (Paciente, Operador, Gerente, Motorista, Administrador)
- 📊 **Painel Operacional**: KPIs básicos, filtros e listagens
- 🔍 **Filtros Avançados**: busca por múltiplos critérios
- 🧾 **Auditoria**: trilha de eventos e alterações
- 📱 **PWA**: base para experiência mobile

## 🏗️ Arquitetura Técnica

### Frontend
- **React 19** com TypeScript
- **Vite** para build e desenvolvimento
- **PWA** com Service Worker avançado
- **CSS customizado** (tokens + componentes)
- **Recharts** para visualizações de dados

### Backend
- **Cloudflare Pages Functions** (Serverless)
- **Cloudflare D1** (SQLite distribuído)
- **REST API** com sessões e controle de acesso

### Recursos Disponíveis no código
- **Error Boundaries** para tratamento robusto de erros
- **Hooks especializados** para requests, sessão, usuários, clientes
- **Base de offline** (estado e sinalização)
- **Monitoramento UI** com painéis e alertas locais

## 🚀 Instalação e Configuração

### Pré-requisitos
- Node.js 18+
- npm ou yarn
- Conta Cloudflare (para deploy)

### Instalação Local

```bash
# Clone o repositório
git clone https://github.com/your-repo/transporter.git
cd transporter

# Instale as dependências
npm install

# Inicie o servidor de desenvolvimento
npm run dev
```

### Configuração do Banco de Dados

```bash
# Login no Cloudflare
npm run cf:login

# Criar banco de dados D1
npm run cf:d1:create

# Aplicar schema e dados iniciais
npm run cf:d1:apply
```

### Deploy para Produção

```bash
# Deploy manual
npm run cf:deploy

# Ou configure o deploy automático via GitHub Actions
```

## 👥 Perfis de Usuário

### 👤 Paciente
- Portal dedicado para acompanhamento de viagens
- Histórico completo de transportes
- Agendamento de consultas
- Autenticação por CPF + PIN

### 🏥 Operador
- Cadastro e triagem de solicitações
- **Interface simplificada**: foco no cadastro
- Filtros avançados e busca inteligente
- Monitoramento básico de status operacional
- Gestão de pacientes e destinos
- **Abas disponíveis**: Nova solicitação, Solicitações recentes, Pacientes, Monitoramento

### 👔 Gerente
- Controle operacional completo
- Monitoramento avançado de frota
- Analytics e relatórios gerenciais
- Configurações do sistema

### 🚗 Motorista
- Agenda mobile otimizada
- Rastreamento GPS em tempo real
- Status de viagem atualizável
- Interface simplificada para campo

### 👑 Administrador
- Controle total do sistema
- Logs de auditoria completos
- Configurações críticas
- Gerenciamento de usuários

## 📊 Funcionalidades Principais

### 🎯 Dashboard Analytics
- **KPIs Operacionais**: visão rápida de status
- **Gráficos**: barras e distribuição por status
- **Níveis de Acesso**: Operador | Gerente | Admin

### 🔍 Sistema de Filtros
- **Filtros por Data**: Hoje, ontem, semana, mês, período customizado
- **Status**: Todos os status de solicitação
- **Localização**: Cidade, bairro, CEP
- **Recursos**: Motorista e veículo específicos
- **Busca Inteligente**: Protocolo, paciente, destino

### 🔒 Segurança e Auditoria
- **Session Management**: Controle de sessões ativas
- **Audit Logs**: Rastreamento de alterações por solicitação

---

## 🧭 Roadmap (Planned)

- GPS tracking com telemetria real
- Push notifications do navegador
- Operações em lote (batch update)
- Rate limiting por endpoint
- Exportação CSV/relatórios avançados

---

## 📌 Documentação técnica

- [docs/ARCHITECTURE_MAP.md](./docs/ARCHITECTURE_MAP.md)
- [docs/ENDPOINTS_AUDIT.md](./docs/ENDPOINTS_AUDIT.md)

## 🛠️ Scripts Disponíveis

```bash
# Desenvolvimento
npm run dev          # Servidor de desenvolvimento
npm run build        # Build de produção
npm run preview      # Preview do build

# Cloudflare
npm run cf:login     # Login no Cloudflare
npm run cf:d1:create # Criar banco D1
npm run cf:d1:apply  # Aplicar migrations
npm run cf:deploy    # Deploy para produção

# Utilitários
npm run type-check   # Verificar tipos TypeScript
npm run lint         # Executar ESLint
```

## 🔧 Configuração do GitHub Actions

O projeto inclui workflow automático para deploy no Cloudflare Pages.

### Secrets Necessários
- `CLOUDFLARE_ACCOUNT_ID`
- `CLOUDFLARE_API_TOKEN`

### Triggers
- **Push na main**: Deploy automático
- **Manual**: Via `workflow_dispatch`

## 📁 Estrutura do Projeto

```
transporter/
├── src/
│   ├── components/     # Componentes React
│   ├── hooks/         # Hooks customizados
│   ├── lib/           # Utilitários e APIs
│   ├── types.ts       # Definições TypeScript
│   └── data.ts        # Dados de demonstração
├── functions/         # Cloudflare Functions
├── d1/               # Schema e seeds do banco
├── public/           # Assets estáticos
└── .github/          # Workflows GitHub Actions
```

## 🔐 Primeiro Acesso

- **PIN Inicial**: `0000` (todos os perfis)
- **Troca Obrigatória**: Primeiro login exige nova senha
- **Perfis Demo**: Disponíveis na tela de login

## 📈 Roadmap

### ✅ Implementado
- [x] Filtros avançados e busca inteligente
- [x] Dashboard com gráficos e analytics
- [x] Sistema de notificações completo
- [x] GPS tracking em tempo real
- [x] Capacidades offline (PWA)
- [x] Operações em lote
- [x] Centro de monitoramento
- [x] Sistema de auditoria
- [x] Controle de acesso granular

### 🚧 Próximas Features
- [ ] Integração com APIs externas
- [ ] Mobile app nativa
- [ ] Machine Learning para otimização de rotas
- [ ] Integração com sistemas hospitalares

## 🤝 Contribuição

1. Fork o projeto
2. Crie uma branch para sua feature (`git checkout -b feature/AmazingFeature`)
3. Commit suas mudanças (`git commit -m 'Add some AmazingFeature'`)
4. Push para a branch (`git push origin feature/AmazingFeature`)
5. Abra um Pull Request

## 📝 Licença

Este projeto está sob a licença MIT. Veja o arquivo [LICENSE](LICENSE) para mais detalhes.

## 📞 Suporte

Para suporte técnico ou dúvidas:
- 📧 Email: support@transporter.com
- 📖 Documentação: [docs.transporter.com](https://docs.transporter.com)
- 🐛 Issues: [GitHub Issues](https://github.com/your-repo/transporter/issues)

---

<div align="center">
  <p><strong>Transporter</strong> - Transformando o transporte de pacientes com tecnologia de ponta 🚑✨</p>
  <p>Feito com ❤️ para cuidar melhor dos pacientes</p>
</div>
