# NAILBOOK — Arquitetura

## Visão Geral

```
┌─────────────────────┐     ┌─────────────────────────┐     ┌─────────────────────┐
│   Cloudflare Pages   │     │     Render Web Service    │     │   Render PostgreSQL │
│                      │     │                          │     │                     │
│  - index.html        │────▶│  - Node.js + Express     │────▶│  - Tables           │
│  - servicos.html     │     │  - API REST (/api/*)     │     │  - Indexes          │
│  - marcacao.html     │     │  - Auth (/api/admin/auth) │     │  - Constraints      │
│  - privacidade.html  │     │  - Booking (/api/appoint) │     │                     │
│  - termos.html       │     │  - Notifications         │     │                     │
│  - 404.html          │     │  - Admin (/api/admin/*)   │     │                     │
│  - assets/           │     │  - Cron Job              │     │                     │
│  - js/               │     │                          │     │                     │
│  - css/              │     │                          │     │                     │
└─────────────────────┘     └─────────────────────────┘     └─────────────────────┘

┌─────────────────────────┐     ┌─────────────────────┐
│   Render Cron Job       │     │   Email Provider      │
│   (Notification Job)    │────▶│   (Resend/SendGrid)   │
│                        │     │                     │
│  - Process pending      │     │  - Booking confirm   │
│  - Send reminders       │     │  - Cancellation      │
│  - Idempotent           │     │  - Admin notification │
│  - SKIP LOCKED          │     │  - Retry logic       │
└─────────────────────────┘     └─────────────────────┘
```

## Camadas

### Frontend (Cloudflare Pages)
- HTML estático
- CSS com variáveis personalizadas
- JavaScript modular (ESM)
- Consome API via `fetch` com `credentials: 'include'`
- Sem secrets no bundle

### Backend (Render Web Service)
- Express.js
- API REST em `/api/*`
- Autenticação JWT em cookies httpOnly
- Rate limiting
- CORS restrito
- CSRF protection
- Health check em `/health`

### Database (Render PostgreSQL)
- PostgreSQL 15+
- 10 tabelas com integridade referencial
- Constraint EXCLUDE para double booking prevention
- Índices para performance
- Migrations versionadas
- Backups automáticos pelo Render

### Jobs (Render Cron Job)
- Processa notificações pendentes a cada minuto
- SKIP LOCKED para concorrência segura
- Idempotent por `idempotency_key`
- Retry com backoff

## Fluxo de Marcação

```
Cliente (Browser)
    │
    ▼
GET / (index.html)
    │
    ▼
GET /api/services → Lista de serviços
    │
    ▼
GET /api/availability?date=...&service_id=... → Slots disponíveis
    │
    ▼
POST /api/appointments → Criação da marcação
    │
    ▼
Backend: availabilityService.validateBookingAttempt()
    │
    ▼
Backend: doubleBookingService.checkConflict()
    │
    ▼
Backend: Transação SERIALIZABLE
    │
    ▼
Appointment criada + Token gerado
    │
    ▼
Notificação criada (async)
    │
    ▼
Job processa → Email enviado
    │
    ▼
Cliente recebe confirmação + .ics
```

## Fluxo de Notificações

```
Appointment created
    │
    ▼
NotificationLog.create({ type: 'booking_confirmed', status: 'pending' })
    │
    ▼
Cron Job (a cada minuto)
    │
    ▼
NotificationLog.findPending() — SKIP LOCKED
    │
    ▼
EmailProvider.sendBookingConfirmation()
    │
    ├── Success → NotificationLog.markSent()
    │
    └── Failure → NotificationLog.markFailed()
              │
              ├── attempts < max → next_retry_at = now + backoff
              │
              └── attempts >= max → status = 'failed'
```

## Segurança

```
Request
    │
    ▼
Rate Limiter
    │
    ▼
CORS Check
    │
    ▼
CSRF Token (mutating requests)
    │
    ▼
Auth Middleware (admin routes)
    │
    ▼
Validator (Joi schema)
    │
    ▼
Controller → Service → Repository → Database
    │
    ▼
Response (sanitized)
```

## Timezone

```
Frontend: Europe/Lisbon (Intl.DateTimeFormat)
    │
    ▼
Backend: localToUtc() para conversão
    │
    ▼
Database: timestamptz UTC
    │
    ▼
ICS: TZID=Europe/Lisbon
    │
    ▼
Email: formato local Lisbon time
```

Todos os horários são representados corretamente em Europe/Lisbon com DST handling automático via PostgreSQL timestamptz.

## Cookies

```
Set-Cookie: access_token=<jwt>; HttpOnly; Secure; SameSite=Strict; Path=/; Domain=.meudominio.pt; Max-Age=3600
Set-Cookie: csrf_token=<token>; HttpOnly; Secure; SameSite=Strict; Path=/; Domain=.meudominio.pt
```

- `access_token`: JWT administrativo, nunca acessível via JavaScript
- `csrf_token`: Enviado como `X-CSRF-Token` header em requests mutativos
- `refresh_token`: Para rotação de sessão (futuro)
