# NailBook — Plataforma de Marcações Online

Sistema profissional de marcações online para profissionais de unhas e manicure.

## Visão Geral

A plataforma permite que as clientes marquem horários online, consultem serviços e preços, e gerem marcações sem necessidade de conta. A profissional gere tudo através de um dashboard administrativo.

## Stack Tecnológico

| Componente | Tecnologia |
|------------|------------|
| **Frontend** | HTML, CSS, JavaScript (Cloudflare Pages) |
| **Backend** | Node.js + Express (Render) |
| **Database** | PostgreSQL (Render) |
| **Deploy** | GitHub → Cloudflare Pages + Render |
| **Email** | Resend |
| **Timezone** | Europe/Lisbon |

## Estrutura do Projeto

```
nailbook/
├── frontend/          # Site público + Dashboard (Cloudflare Pages)
├── backend/           # API REST (Render)
├── .env.example       # Template de variáveis de ambiente
├── .gitignore
└── README.md
```

## Configuração Inicial

### 1. Pré-requisitos

- Node.js 18+
- PostgreSQL 15+
- npm ou pnpm

### 2. Backend Setup

```bash
cd backend

# Copiar variáveis de ambiente
cp .env.example .env
# Editar .env com os seus valores

# Instalar dependências
npm install

# Executar migrações
npm run migrate

# Seed de dados iniciais
npm run seed

# Iniciar servidor
npm start
```

### 3. Frontend Setup

```bash
cd frontend

# Opcional: instalar live-server para desenvolvimento local
npm install -g live-server
live-server --port=5173
```

### 4. Base de Dados

Crie o database no Render PostgreSQL ou localmente:

```sql
CREATE DATABASE nailbook;
```

### 5. Environment Variables

Copie `.env.example` para `.env` e preencha:

```bash
DATABASE_URL=postgresql://user:password@host:5432/nailbook
JWT_SECRET=sua-string-secreta
JWT_REFRESH_SECRET=outra-string-secreta
CORS_ORIGIN=https://seu-dominio.com
API_URL=https://api.seu-dominio.com
EMAIL_API_KEY=re_xxxxxxxxx
```

## Deploy

### Backend (Render)

1. Criar conta no [Render](https://render.com)
2. Criar Web Service → ligar ao GitHub
3. Configurar:
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Environment Variables**: todas as variáveis de `.env`
4. Criar PostgreSQL Database → obter `DATABASE_URL`

### Frontend (Cloudflare Pages)

1. Criar conta no [Cloudflare](https://cloudflare.com)
2. Criar Pages → ligar ao repositório frontend
3. Configurar variável `API_URL` para apontar para o backend
4. Deploy automático no push para `main`

### Domínio

- Configurar `www.exemplo.com` no Cloudflare
- Apontar para o frontend
- Se necessário, `api.exemplo.com` → backend (CORS configurado)

## API

Documentação completa em desenvolvimento.

### Endpoints Públicos

```
GET  /api/health
GET  /api/services
GET  /api/availability
POST /api/appointments
GET  /api/appointments/:token
POST /api/appointments/:token/cancel
```

### Endpoints Administrativos

```
POST   /api/admin/login
POST   /api/admin/logout
GET    /api/admin/me
GET    /api/admin/appointments
PATCH  /api/admin/appointments/:id
GET    /api/admin/customers
GET    /api/admin/services
POST   /api/admin/services
PATCH  /api/admin/services/:id
DELETE /api/admin/services/:id
GET    /api/admin/business-hours
PATCH  /api/admin/business-hours
GET    /api/admin/blocked-periods
POST   /api/admin/blocked-periods
DELETE /api/admin/blocked-periods/:id
GET    /api/admin/settings
PATCH  /api/admin/settings
```

## Database

Documentação completa: [DATABASE.md](DATABASE.md)

### Schema

10 tabelas com integridade referencial completa:
- `admin_users` — Autenticação profissional
- `customers` — Dados das clientes
- `services` — Serviços com preços e duração
- `appointments` — Marcações com proteção double booking
- `business_hours` — Horários de funcionamento por dia
- `breaks` — Pausas no horário de funcionamento
- `blocked_periods` — Períodos bloqueados (férias, feriados)
- `settings` — Configurações do negócio
- `booking_tokens` — Tokens seguros para clientes
- `notification_logs` — Registo de notificações

### Double Booking Prevention

Proteção em 3 camadas:
1. Validação em memória (UX rápida)
2. Transação SERIALIZABLE com retry
3. Constraint EXCLUDE USING gist no PostgreSQL

### Migrations

```bash
# Criar database
createdb nailbook

# Executar migrações
npm run migrate

# Seed de dados
npm run seed
```

## Phase Status

- **Fase 1** ✅ — Arquitetura concluída
- **Fase 2** ✅ — PostgreSQL e Modelo de Dados concluído
- **Fase 3** ✅ — Backend e API REST concluída
- **Fase 4** ✅ — Motor de Disponibilidade concluído
- **Fase 5** ✅ — Dashboard Administrativo concluído
- **Fase 6** ✅ — Website Público e Experiência de Marcação concluído
- **Fase 7** ✅ — Notificações, Lembretes e Integração com Calendário concluído

## Fase 7 — Notificações, Lembretes e Calendário

### Funcionalidades

| Funcionalidade | Descrição |
|----------------|-----------|
| **Email de Confirmação** | Enviado quando a marcação é criada |
| **Email de Cancelamento** | Enviado quando a marcação é cancelada |
| **Lembrete 24h** | Automático, 24h antes da marcação |
| **Lembrete 2h** | Automático, 2h antes da marcação |
| **Notificação ao Admin** | Email ao profissional para nova marcação |
| **Ficheiro .ics** | Download para Google Calendar, Apple, Outlook |
| **Google Calendar URL** | Redirecionamento direto para Google Calendar |
| **Job de Notificações** | Processa notificações pendentes via cron |
| **Idempotência** | Chave única impede notificações duplicadas |
| **Retry** | Backoff controlado em caso de falha |
| **Cancelamento de Lembretes** | Lembretes cancelados quando marcação é cancelada |
| **Recalculo de Lembretes** | Ao alterar marcação, lembretes atualizados |

### Ficheiros Criados/Modificados

| Categoria | Ficheiro | Descrição |
|-----------|----------|-----------|
| **Migration** | `database/migrations/004_notifications.sql` | Campos para retry, scheduling, idempotência |
| **Migration** | `database/migrations/005_calendar.sql` | Campos de calendário nas settings |
| **Model** | `models/notificationLog.js` | Modelo completo de notificações |
| **Service** | `services/notificationService.js` | Serviço central de notificações |
| **Service** | `services/emailProvider.js` | Abstração de email provider |
| **Service** | `services/icsGenerator.js` | Geração de ficheiros .ics |
| **Job** | `jobs/notificationJob.js` | Job de processamento de notificações |
| **Controller** | `controllers/notificationController.js` | Endpoints admin de notificações |
| **Controller** | `controllers/appointmentController.js` | Atualizado para disparar notificações |
| **Route** | `routes/public.js` | ICS e Google Calendar endpoints |
| **Route** | `routes/admin.js` | Notificações admin endpoints |
| **Test** | `tests/notification.test.js` | Testes automatizados |
| **Frontend** | `frontend/js/booking.js` | Links de calendário na página de sucesso |
| **Config** | `.env.example` | Novas variáveis de ambiente |

### Endpoints Novos

```
GET    /api/appointments/:token/calendar.ics   # Download .ics (protegido por token)
GET    /api/appointments/:token/calendar        # Google Calendar URL
GET    /api/appointments/:token/google-calendar # Redirect para Google Calendar
GET    /api/admin/notifications                 # Listar notificações (admin)
GET    /api/admin/notifications/stats           # Estatísticas (admin)
```

### Segurança

- ICS protegido por token seguro de gestão
- Nenhuma secret no frontend
- Idempotência impede notificações duplicadas
- SKIP LOCKED para concorrência segura no PostgreSQL
- Falha do email NÃO afeta a marcação
- Email opcional — cliente sem email pode marcar normalmente

### Configuração

```env
EMAIL_PROVIDER=resend
EMAIL_API_KEY=re_xxxxxxxxxxxxxxxxxxxxxxxx
EMAIL_FROM=noemail@nailbook.com
EMAIL_REPLY_TO=noemail@nailbook.com
NOTIFICATION_MAX_ATTEMPTS=3
NOTIFICATION_RETRY_DELAY_MS=60000
REMINDER_24H_ENABLED=true
REMINDER_2H_ENABLED=true
ADMIN_NOTIFICATION_EMAIL=admin@exemplo.com
ICS_ENABLED=true
CALENDAR_LOCATION=Rua Exemplo, Lisboa
```

### Job/Cron

```bash
# Executar a cada minuto
node jobs/notificationJob.js

# Ou via Render Cron Job
*/1 * * * * node jobs/notificationJob.js
```

### ICS

- Compatível com Google Calendar, Apple Calendar, Outlook
- Timezone Europe/Lisbon
- UID estável por marcação
- Campos DTSTART/DTEND corretos
- Formato VCALENDAR 2.0
- Download automático via `Content-Disposition`

### Testes

- Modelo de notificação (criar, marcar sent, falhar, cancelar)
- Idempotência (duplicatas impedidas)
- ICS válido (campos obrigatórios, timezone, escape)
- Timezone e DST
- Marcação sem email (skip de notificação)
- Falha do email não cancela marcação
- Concorrência (SKIP LOCKED)

### Critérios de Aceitação

- ✅ Confirmação de marcação funciona
- ✅ Cancelamento gera notificação
- ✅ Lembrete de 24h funciona
- ✅ Lembrete de 2h funciona
- ✅ Marcações canceladas não recebem lembretes
- ✅ Emails duplicados são evitados
- ✅ Retries funcionam
- ✅ Falhas ficam registadas
- ✅ Job é seguro em concorrência
- ✅ .ics é válido
- ✅ Timezone funciona corretamente
- ✅ DST foi considerado
- ✅ Cliente sem email continua podendo marcar
- ✅ Falha do email não cancela marcação
- ✅ Tokens continuam seguros
- ✅ Nenhuma secret aparece no frontend
- ✅ Não existe WhatsApp falso
- ✅ Testes automatizados passam
- ✅ Documentação está atualizada

## Segurança Geral

### Páginas Criadas

| Página | URL | Descrição |
|--------|-----|-----------|
| Início | `/` | Landing page com hero, serviços, como funciona |
| Serviços | `/servicos` | Lista de serviços ativos com preços |
| Marcação | `/marcacao` | Fluxo completo de marcação em 5 passos |
| Sucesso | `/marcacao/sucesso` | Página de confirmação |
| Gestão | `/marcacao/:token` | Gerir/cancelar marcação por token |
| Privacidade | `/privacidade` | Política de privacidade RGPD |
| Termos | `/termos` | Termos de utilização |
| 404 | `/404` | Página não encontrada |

### Funcionalidades do Fluxo de Marcação

1. **Escolher Serviço** — Lista de serviços ativos da API
2. **Escolher Data** — Calendário mobile-friendly com datas válidas
3. **Escolher Horário** — Slots disponíveis da API
4. **Dados da Cliente** — Formulário com validação frontend + backend
5. **Confirmar** — Resumo + POST `/api/appointments`

### Segurança

- Sem secrets no frontend
- CSRF protection
- API valida disponibilidade na confirmação
- Tratamento de conflitos (409)
- Token seguro para gestão de marcação
- XSS prevention (escapeHtml)
- Cookies httpOnly separados da experiência pública

### SEO

- `<title>`, meta description, Open Graph em todas as páginas
- `<link rel="preconnect">` para Google Fonts
- `<meta name="theme-color">`
- `<meta name="viewport">` mobile-first
- `sitemap.xml` e `robots.txt`
- Canonical URLs

### Acessibilidade

- Skip link
- ARIA labels e roles
- Focus visible
- Navegação por teclado
- Labels em todos os inputs
- Botões com área de toque ≥44px

### Ficheiros da Fase 6

```
frontend/
├── index.html              # Página inicial
├── servicos.html           # Página de serviços
├── marcacao.html           # Fluxo de marcação + gestão
├── marcacao/
│   └── sucesso.html        # Página de sucesso
├── privacidade.html        # Política de privacidade
├── termos.html             # Termos de utilização
├── 404.html                # Página 404
├── sitemap.xml             # Sitemap
├── robots.txt              # Robots
├── assets/
│   └── favicon.svg         # Favicon
├── css/
│   ├── style.css           # Estilos globais (atualizados)
│   ├── admin.css           # Estilos admin
│   └── public.css          # Estilos do site público
└── js/
    ├── api.js              # Cliente API
    ├── components.js       # Componentes reutilizáveis
    ├── public.js           # JS do site público
    ├── booking.js          # Fluxo de marcação
    ├── calendar.js         # Utilitários de calendário
    ├── appointment.js      # Gestão de marcação
    └── admin/              # Módulos do dashboard admin
```

## Segurança Geral

- Passwords com bcrypt (custo 12)
- JWT em httpOnly cookies
- CORS estrito
- Rate limiting em todas as rotas
- Parameterized queries (SQL injection prevention)
- EXCLUDE constraint contra double booking
- Headers de segurança (Helmet.js)
- Tokens de marcação com hash bcrypt
- CSRF protection (cookie + header)
- Sessão expirada → redirecionamento

## Deploy em Produção

### Arquitetura

```
Frontend → Cloudflare Pages (https://www.meudominio.pt)
Backend → Render Web Service (https://api.meudominio.pt)
Database → Render PostgreSQL
Cron Job → Render Cron Job (notificações)
```

### Documentação Completa

| Documento | Descrição |
|-----------|-----------|
| [Architecture](docs/architecture.md) | Arquitetura completa do sistema |
| [API](docs/api.md) | Documentação de todos os endpoints |
| [Deployment](docs/deployment.md) | Guia passo a passo para deploy |
| [Production Checklist](docs/production-checklist.md) | Checklist final de produção |

### Scripts Disponíveis

```bash
npm install    # Instalar dependências
npm run dev    # Modo desenvolvimento
npm start      # Modo produção
npm run migrate # Executar migrações
npm run seed   # Seed de dados (desenvolvimento)
npm test       # Executar testes
```

### Passos para Deploy

1. **GitHub**: Push para `main`
2. **Cloudflare Pages**: Auto-deploy do frontend
3. **Render**: Auto-deploy do backend + PostgreSQL + Cron Job
4. **DNS**: Configurar domínio no Cloudflare
5. **HTTPS**: Automático (Cloudflare + Let's Encrypt)
6. **Smoke Test**: Verificar `/health`, `/api/services`, website

## Segurança Geral

## Licença
