# Arquitetura — NailBook

## 1. VISÃO GERAL

**NailBook** é uma plataforma de marcações online para profissionais de unhas/manicure.

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐     ┌──────────────┐
│   CLIENTES      │     │   CLOUDFLARE     │     │   RENDER        │     │  POSTGRESQL  │
│  (Browser)      │────▶│   Pages (Frontend)│────▶│   (Backend API) │────▶│  (Database)  │
│  - Site público │     │   - HTML/CSS/JS   │     │   - Node.js     │     │  - Dados     │
│  - Booking      │     │                   │     │   - Express     │     │  - Persistência│
│  - Dashboard    │     │                   │     │                 │     │              │
└─────────────────┘     └──────────────────┘     └─────────────────┘     └──────────────┘
```

**Princípio fundamental**: O backend é a única fonte de verdade para disponibilidade. O frontend nunca decide sozinho se um horário está disponível.

---

## 2. DECISÕES TÉCNICAS

### 2.1 Banco de Dados — PostgreSQL

**Porquê**:
- Confiabilidade e integridade referencial
- Suporte nativo a transações ACID
- Índices GiST para consultas de intervalo de tempo (essencial para evitar double booking)
- `timestamptz` para timezone-aware
- Escalabilidade com Render PostgreSQL

### 2.2 Autenticação — JWT em httpOnly Cookies

**Porquê**:
- Frontend e backend separados → cookies funcionam melhor que localStorage
- `httpOnly` + `Secure` + `SameSite=Strict` → proteção contra XSS e CSRF
- JWT é stateless (escalável)
- bcrypt para hashing de passwords (nunca texto plano)
- Access token curto (15 min) + Refresh token (7 dias)
- Rota de logout invalida refresh token

**Escolha vs. Sessões**: JWT é mais adequado para arquitetura API-first com frontend estático, pois o servidor não mantém estado de sessão, simplificando o deployment no Render.

### 2.3 Prevenção de Double Booking — Combinação de 3 Camadas

```
┌─────────────────────────────────────────────────────────┐
│ CAMADA 1: Validação em memória (UX rápida)              │
│ → Verificar conflitos óbvios antes de chamar o backend  │
│ → Feedback imediato ao utilizador                       │
├─────────────────────────────────────────────────────────┤
│ CAMADA 2: Transação SERIALIZABLE + Retry                │
│ → BEGIN;                                                │
│ → SELECT ... WHERE time_overlaps FOR UPDATE;            │
│ → Se conflito → ROLLBACK + erro                         │
│ → Se sem conflito → INSERT;                             │
│ → COMMIT;                                               │
│ → Se SerializationFailure → retry (máx 3)               │
├─────────────────────────────────────────────────────────┤
│ CAMADA 3: Constraint EXCLUDE (Segurança final)          │
│ → Índice GiST que impede sobreposição real              │
│ → Mesmo que a aplicação falhe, o DB rejeita             │
│ → Erro PostgreSQL 787 (exclusion conflict)              │
└─────────────────────────────────────────────────────────┘
```

**Porquê esta abordagem**:
- **Camada 1** dá feedback rápido ao utilizador
- **Camada 2** garante consistência com transações reais do PostgreSQL
- **Camada 3** é a rede de segurança definitiva — mesmo bugs na aplicação não criam double bookings

### 2.4 Timezone — Europe/Lisbon

**Decisão**:
- Todas as datas/horas no DB são `timestamptz` (UTC)
- O backend converte para `Europe/Lisbon` em toda a lógica de disponibilidade
- O frontend envia datas em formato `YYYY-MM-DD` (sem hora) e o backend calcula
- Todos os horários exibidos são em Lisbon time
- DST é tratado automaticamente pelo PostgreSQL (`timestamptz`)

```
Cliente seleciona: 2025-01-15
Backend: SELECT available_slots WHERE date = '2025-01-15' AT TIME ZONE 'Europe/Lisbon'
Backend: Calcula slots disponíveis (09:00, 09:30, 10:00...)
Backend: Retorna slots em formato {date: "2025-01-15", time: "09:00", ...}
```

### 2.5 Token de Marcação — UUID v4

**Porquê**:
- Não expõe ID numérico interno (segurança por obscuridade leve)
- UUID v4 é praticamente impossível de adivinhar
- Permite que a cliente consulte/cancele sem autenticação
- Cada marcação recebe um token único na criação

```
URL de cancelamento:
/agendamento/abc123-def456-ghi789
```

### 2.6 Validação e Sanitização

| Ameaça | Prevenção |
|--------|-----------|
| SQL Injection | Query parameterizada (node-postgres) |
| XSS | Escape no frontend, validação de input no backend |
| CSRF | SameSite cookies + CORS estrito |
| Rate Limiting | `express-rate-limit` em todas as rotas |
| Headers | `helmet` para headers de segurança |

### 2.7 Estrutura de Ficheiros

```
nailbook/
├── frontend/                    # Cloudflare Pages
│   ├── index.html              # Landing page
│   ├── booking.html            # Fluxo de marcação
│   ├── confirmation.html       # Confirmação + .ics
│   ├── dashboard.html          # Dashboard admin
│   ├── login.html              # Login admin
│   ├── settings.html           # Configurações do negócio
│   ├── css/
│   │   ├── style.css           # Estilos globais
│   │   ├── dashboard.css       # Estilos dashboard
│   │   └── booking.css         # Estilos booking
│   ├── js/
│   │   ├── api.js              # Funções de chamada à API
│   │   ├── booking.js          # Lógica do fluxo de marcação
│   │   ├── dashboard.js        # Lógica do dashboard
│   │   └── auth.js             # Gestão de autenticação
│   └── assets/
│       ├── images/
│       └── icons/
│
├── backend/                     # Render
│   ├── server.js              # Entry point
│   ├── config/
│   │   └── database.js        # Conexão PostgreSQL
│   ├── middleware/
│   │   ├── auth.js            # Middleware de autenticação JWT
│   │   ├── rateLimiter.js     # Rate limiting
│   │   ├── cors.js            # CORS configuration
│   │   ├── security.js        # Headers de segurança
│   │   └── errorHandler.js    # Tratamento centralizado de erros
│   ├── routes/
│   │   ├── public.js          # Rotas públicas (serviços, disponibilidade)
│   │   ├── appointments.js    # CRUD de marcações
│   │   ├── auth.js            # Login/logout admin
│   │   ├── admin.js           # Rotas administrativas
│   │   └── index.js           # Aggregador de rotas
│   ├── controllers/
│   │   ├── availabilityController.js
│   │   ├── appointmentController.js
│   │   ├── adminController.js
│   │   ├── serviceController.js
│   │   ├── customerController.js
│   │   ├── businessHoursController.js
│   │   └── settingsController.js
│   ├── services/
│   │   ├── availabilityService.js     # Motor de disponibilidade
│   │   ├── appointmentService.js      # Lógica de marcações
│   │   ├── doubleBookingService.js    # Prevenção de conflitos
│   │   ├── emailService.js            # Envio de emails
│   │   └── icsService.js             # Geração .ics
│   ├── models/
│   │   ├── index.js                  # Pool do PostgreSQL
│   │   ├── adminUser.js
│   │   ├── customer.js
│   │   ├── service.js
│   │   ├── appointment.js
│   │   ├── businessHour.js
│   │   ├── break.js
│   │   ├── blockedPeriod.js
│   │   ├── setting.js
│   │   ├── bookingToken.js
│   │   └── notificationLog.js
│   ├── validators/
│   │   ├── bookingValidator.js
│   │   ├── adminValidator.js
│   │   ├── serviceValidator.js
│   │   └── appointmentValidator.js
│   ├── utils/
│   │   ├── timezone.js               # Conversões timezone
│   │   ├── token.js                  # Geração de tokens
│   │   ├── jwt.js                    # JWT helpers
│   │   └── logger.js                 # Logging estruturado
│   ├── database/
│   │   ├── migrate.js                # Runner de migrações
│   │   └── seed.js                   # Dados iniciais
│   ├── migrations/
│   │   ├── 001_create_tables.sql
│   │   ├── 002_add_constraints.sql
│   │   └── 003_add_indexes.sql
│   ├── tests/
│   │   ├── availability.test.js
│   │   ├── booking.test.js
│   │   ├── doubleBooking.test.js
│   │   ├── auth.test.js
│   │   └── security.test.js
│   ├── .env.example
│   ├── .env
│   ├── package.json
│   └── .gitignore
│
├── .gitignore
├── .env.example
├── README.md
└── ARQUITETURA.md                  # Este ficheiro
```

---

## 3. ESQUEMA DE BASE DE DADOS

### 3.1 Diagrama Relacional

```
admin_users (1) ── (N) appointments*     * como admin que confirmou
                  │
customers (1) ── (N) appointments
                  │
services (1) ── (N) appointments
                  │
appointments (1) ── (1) booking_tokens
```

### 3.2 Tabelas

#### admin_users
```sql
id              UUID PRIMARY KEY DEFAULT gen_random_uuid()
email           VARCHAR(255) UNIQUE NOT NULL
password_hash   VARCHAR(255) NOT NULL  -- bcrypt
name            VARCHAR(100) NOT NULL
active          BOOLEAN DEFAULT true
created_at      TIMESTAMPTZ DEFAULT NOW()
updated_at      TIMESTAMPTZ DEFAULT NOW()
```

#### customers
```sql
id              UUID PRIMARY KEY DEFAULT gen_random_uuid()
name            VARCHAR(100) NOT NULL
phone           VARCHAR(20) NOT NULL
email           VARCHAR(255) NULL       -- opcional
notes           TEXT NULL
created_at      TIMESTAMPTZ DEFAULT NOW()
updated_at      TIMESTAMPTZ DEFAULT NOW()
```

#### services
```sql
id              UUID PRIMARY KEY DEFAULT gen_random_uuid()
name            VARCHAR(100) NOT NULL
description     TEXT NULL
price_cents     INTEGER NOT NULL       -- Armazenar em cêntimos (ex: 2500 = €25.00)
duration_min    INTEGER NOT NULL       -- Em minutos
active          BOOLEAN DEFAULT true
created_at      TIMESTAMPTZ DEFAULT NOW()
updated_at      TIMESTAMPTZ DEFAULT NOW()
```

**Porquê `price_cents`**: Evitar problemas de ponto flutuante com moedas. `DECIMAL` é aceitável, mas integer em cêntimos é mais preciso e fácil de manipular.

#### appointments
```sql
id              UUID PRIMARY KEY DEFAULT gen_random_uuid()
token           UUID UNIQUE NOT NULL DEFAULT gen_random_uuid()
customer_id     UUID REFERENCES customers(id) ON DELETE SET NULL
service_id      UUID REFERENCES services(id) ON DELETE SET NULL
admin_user_id   UUID REFERENCES admin_users(id) ON DELETE SET NULL
starts_at       TIMESTAMPTZ NOT NULL
duration_min    INTEGER NOT NULL
price_cents     INTEGER NOT NULL
state           VARCHAR(20) NOT NULL DEFAULT 'pending'
                 -- pending | confirmed | cancelled | completed | no_show
notes           TEXT NULL
cancelled_at    TIMESTAMPTZ NULL
completed_at    TIMESTAMPTZ NULL
created_at      TIMESTAMPTZ DEFAULT NOW()
updated_at      TIMESTAMPTZ DEFAULT NOW()

-- EXCLUDE constraint para prevenir double booking
EXCLUDE USING gist (
    service_id WITH =,
    daterange(starts_at, starts_at + (duration_min || ' minutes')::interval) WITH &&
) WHERE (state IN ('pending', 'confirmed'))
```

**Estados**:
- `pending` → Criação inicial, aguarda confirmação
- `confirmed` → Confirmada pela profissional
- `cancelled` → Cancelada (por cliente ou profissional)
- `completed` → Atendimento realizado
- `no_show` → Cliente não apareceu

**Porquê `pending` como estado inicial**: Permite que a profissional veja pedidos pendentes antes de confirmar. Adiciona controlo profissional.

#### business_hours
```sql
id              UUID PRIMARY KEY DEFAULT gen_random_uuid()
day_of_week     SMALLINT NOT NULL       -- 0=Sunday, 1=Monday, ..., 6=Saturday
opens_at        TIME NOT NULL
closes_at       TIME NOT NULL
active          BOOLEAN DEFAULT true
created_at      TIMESTAMPTZ DEFAULT NOW()
updated_at      TIMESTAMPTZ DEFAULT NOW()

-- Exemplo: Segunda 09:00-13:00
-- (1, '09:00', '13:00', true)
-- Exemplo: Segunda 14:00-18:00
-- (1, '14:00', '18:00', true)
```

**Suporte a múltiplos períodos**: Basta criar múltiplos registos para o mesmo `day_of_week`.

#### breaks
```sql
id              UUID PRIMARY KEY DEFAULT gen_random_uuid()
day_of_week     SMALLINT NOT NULL       -- 0=Sunday, ..., 6=Saturday
starts_at       TIME NOT NULL
ends_at         TIME NOT NULL
active          BOOLEAN DEFAULT true
created_at      TIMESTAMPTZ DEFAULT NOW()
```

#### blocked_periods
```sql
id              UUID PRIMARY KEY DEFAULT gen_random_uuid()
starts_at       TIMESTAMPTZ NOT NULL    -- Data/hora início
ends_at         TIMESTAMPTZ NOT NULL    -- Data/hora fim
reason          VARCHAR(255) NULL       -- Ex: "Férias", "Almoço", "Fechado"
created_at      TIMESTAMPTZ DEFAULT NOW()
```

**Suporte a bloqueios**:
- Dia inteiro: `starts_at = '2025-01-15 00:00:00+00'`, `ends_at = '2025-01-16 00:00:00+00'`
- Intervalo: `starts_at = '2025-01-15 12:00:00+00'`, `ends_at = '2025-01-15 14:00:00+00'`
- Vários dias: `starts_at = '2025-01-01 00:00:00+00'`, `ends_at = '2025-01-07 00:00:00+00'`

#### settings
```sql
id              UUID PRIMARY KEY DEFAULT gen_random_uuid()
business_name   VARCHAR(255) NOT NULL
business_phone  VARCHAR(20) NOT NULL
business_email  VARCHAR(255) NULL
timezone        VARCHAR(50) DEFAULT 'Europe/Lisbon'
whatsapp_enabled BOOLEAN DEFAULT false
whatsapp_number VARCHAR(20) NULL
whatsapp_token  TEXT NULL             -- Futuro: WhatsApp Business API
google_calendar_enabled BOOLEAN DEFAULT false
google_calendar_id VARCHAR(255) NULL  -- Futuro: Integração Google Calendar
created_at      TIMESTAMPTZ DEFAULT NOW()
updated_at      TIMESTAMPTZ DEFAULT NOW()
```

**Porquê campos futuros para WhatsApp/Google Calendar**: Preparação sem integração falsa. Quando as credenciais existirem, basta ativar.

#### booking_tokens
```sql
id              UUID PRIMARY KEY DEFAULT gen_random_uuid()
appointment_id  UUID REFERENCES appointments(id) ON DELETE CASCADE
token           UUID UNIQUE NOT NULL DEFAULT gen_random_uuid()
expires_at      TIMESTAMPTZ NOT NULL    -- 30 dias após criação
created_at      TIMESTAMPTZ DEFAULT NOW()
```

**Porquê tabela separada**: Permite rotação de tokens, expiração, múltiplos tokens por marcação no futuro.

#### notification_logs
```sql
id              UUID PRIMARY KEY DEFAULT gen_random_uuid()
appointment_id  UUID REFERENCES appointments(id) ON DELETE SET NULL
type            VARCHAR(50) NOT NULL    -- 'booking_created', 'booking_confirmed', 'booking_cancelled', 'reminder_24h', 'reminder_2h'
status          VARCHAR(20) NOT NULL DEFAULT 'pending'  -- 'pending', 'sent', 'failed'
recipient       VARCHAR(255) NULL       -- Email ou número
subject         VARCHAR(255) NULL
body            TEXT NULL
error_message   TEXT NULL
provider        VARCHAR(50) NULL        -- 'resend', 'whatsapp', 'none'
sent_at         TIMESTAMPTZ NULL
created_at      TIMESTAMPTZ DEFAULT NOW()
```

**Porquê tabela separada**: Auditoria completa de todas as comunicações. Se o email falhar, a marcação permanece intacta e o erro é registado.

### 3.3 Índices Essenciais

```sql
-- Para consulta rápida de marcações por data
CREATE INDEX idx_appointments_date ON appointments USING gist (
    daterange(starts_at, starts_at + (duration_min || ' minutes')::interval)
);

-- Para consulta por cliente
CREATE INDEX idx_appointments_customer ON appointments(customer_id);

-- Para consulta por estado
CREATE INDEX idx_appointments_state ON appointments(state);

-- Para consulta de tokens
CREATE INDEX idx_booking_tokens_token ON booking_tokens(token);

-- Para consulta de negócio por dia
CREATE INDEX idx_business_hours_day ON business_hours(day_of_week);

-- Para consulta de bloqueios por data
CREATE INDEX idx_blocked_periods_dates ON blocked_periods USING gist (
    daterange(starts_at, ends_at)
);
```

---

## 4. DESIGN DA API

### 4.1 API Pública (sem autenticação)

```
GET  /api/health                    # Health check
GET  /api/services                   # Listar serviços ativos
GET  /api/availability               # Consultar horários disponíveis
GET  /api/appointments/:token        # Consultar marcação por token
POST /api/appointments               # Criar marcação
POST /api/appointments/:token/cancel  # Cancelar marcação
```

### 4.2 API Administrativa (com autenticação JWT)

```
POST   /api/admin/login               # Login
POST   /api/admin/logout              # Logout
GET    /api/admin/me                  # Perfil do admin

# Marcações
GET    /api/admin/appointments        # Listar todas (com filtros)
GET    /api/admin/appointments/:id    # Ver detalhes
PATCH  /api/admin/appointments/:id    # Confirmar/cancelar/concluir/no-show

# Clientes
GET    /api/admin/customers           # Listar clientes
GET    /api/admin/customers/:id       # Ver detalhes + histórico

# Serviços
GET    /api/admin/services            # Listar serviços
POST   /api/admin/services            # Criar serviço
PATCH  /api/admin/services/:id        # Atualizar serviço
DELETE /api/admin/services/:id        # Remover serviço

# Horários de funcionamento
GET    /api/admin/business-hours      # Listar horários
PATCH  /api/admin/business-hours      # Atualizar horários

# Períodos bloqueados
GET    /api/admin/blocked-periods     # Listar bloqueios
POST   /api/admin/blocked-periods     # Criar bloqueio
DELETE /api/admin/blocked-periods/:id # Remover bloqueio

# Configurações
GET    /api/admin/settings            # Ver configurações
PATCH  /api/admin/settings            # Atualizar configurações
```

### 4.3 Modelos de Request/Response

**Criar Marcação**:
```json
POST /api/appointments
{
  "service_id": "uuid",
  "date": "2025-01-15",
  "time": "09:00",
  "customer_name": "Maria Silva",
  "customer_phone": "+351912345678",
  "customer_email": "maria@email.com",
  "notes": "Prefere verniz gel"
}
```

**Resposta**:
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "token": "uuid",
    "service": { "name": "Manicure Completa", "duration_min": 60, "price_cents": 2500 },
    "date": "2025-01-15",
    "time": "09:00",
    "duration_min": 60,
    "price_cents": 2500,
    "state": "pending",
    "customer": { "name": "Maria Silva", "phone": "+351912345678" },
    "notes": "Prefere verniz gel",
    "created_at": "2025-01-10T10:00:00Z"
  }
}
```

**Consultar Disponibilidade**:
```json
GET /api/availability?date=2025-01-15&service_id=uuid
```
```json
{
  "success": true,
  "data": {
    "date": "2025-01-15",
    "service_id": "uuid",
    "service_name": "Manicure Completa",
    "duration_min": 60,
    "timezone": "Europe/Lisbon",
    "business_hours": [
      { "opens": "09:00", "closes": "13:00" },
      { "opens": "14:00", "closes": "18:00" }
    ],
    "breaks": [
      { "starts": "13:00", "ends": "14:00" }
    ],
    "blocked_periods": [],
    "existing_appointments": [],
    "available_slots": [
      { "date": "2025-01-15", "time": "09:00", "end_time": "10:00" },
      { "date": "2025-01-15", "time": "10:00", "end_time": "11:00" },
      { "date": "2025-01-15", "time": "11:00", "end_time": "12:00" },
      { "date": "2025-01-15", "time": "14:00", "end_time": "15:00" },
      { "date": "2025-01-15", "time": "15:00", "end_time": "16:00" },
      { "date": "2025-01-15", "time": "16:00", "end_time": "17:00" }
    ]
  }
}
```

---

## 5. MOTOR DE DISPONIBILIDADE

### 5.1 Algoritmo

```
Função: getAvailableSlots(date, serviceId)

1. Obter horário de funcionamento do dia (business_hours[day_of_week])
   → Se não existir, dia fechado → retornar []

2. Obter pausas do dia (breaks[day_of_week])

3. Obter períodos bloqueados que sobrepõem o dia (blocked_periods)

4. Obter marcações existentes para o dia com state IN ('pending', 'confirmed')

5. Para cada período de funcionamento:
   a. Criar lista de slots a cada 15 minutos
   b. Remover slots que estejam dentro de pausas
   c. Remover slots que estejam dentro de períodos bloqueados
   d. Remover slots que sobreponham marcações existentes
   e. Apenas manter slots onde o serviço cabe (slots_start + duration_min <= period_end)

6. Retornar slots disponíveis
```

### 5.2 Pseudocódigo

```javascript
async function getAvailableSlots(date, serviceId) {
    const service = await Service.findById(serviceId);
    const dayOfWeek = new Date(date + 'T00:00:00Z').getUTCDay();
    // Nota: Ajuste para Europe/Lisbon

    // 1. Business hours
    const hours = await BusinessHour.findByDay(dayOfWeek);
    if (hours.length === 0) return [];

    // 2. Breaks
    const breaks = await Break.findByDay(dayOfWeek);

    // 3. Blocked periods
    const blocked = await BlockedPeriod.findOverlapping(date);

    // 4. Existing appointments
    const appointments = await Appointment.findByDateAndState(date, ['pending', 'confirmed']);

    // 5. Calcular slots
    const duration = service.duration_min;
    const slots = [];

    for (const period of hours) {
        let current = period.opens;
        const periodEnd = period.closes;

        while (current + duration <= periodEnd) {
            const slotEnd = current + duration;

            // Verificar conflitos
            if (!isBlocked(current, slotEnd, breaks, blocked) &&
                !hasConflict(current, slotEnd, appointments)) {
                slots.push({
                    date: date,
                    time: formatTime(current),
                    end_time: formatTime(slotEnd)
                });
            }

            current = current + 15 minutes; // Incremento de 15 min
        }
    }

    return slots;
}
```

---

## 6. SEGURANÇA

### 6.1 Camadas de Proteção

```
┌────────────────────────────────────────────────┐
│           CAMADA 1: Transporte                 │
│  HTTPS (Cloudflare) + TLS 1.3                  │
│  HSTS Headers                                  │
├────────────────────────────────────────────────┤
│           CAMADA 2: Aplicação                  │
│  Rate Limiting (express-rate-limit)            │
│  Helmet.js (headers de segurança)              │
│  CORS estrito (origem permitida)               │
│  Input validation (Zod)                        │
│  SQL Injection Prevention (parameterized queries)│
├────────────────────────────────────────────────┤
│           CAMADA 3: Autenticação               │
│  bcrypt (password hashing, custo 12)           │
│  JWT httpOnly cookies                          │
│  Access token 15 min + Refresh token 7 dias    │
│  Rate limiting em /api/admin/login             │
│  Brute force protection                        │
├────────────────────────────────────────────────┤
│           CAMADA 4: Base de Dados              │
│  Constraints (NOT NULL, UNIQUE, FOREIGN KEY)   │
│  EXCLUDE constraint (double booking)           │
│  Permissions mínimas para o app                │
│  Backups automáticos (Render)                  │
├────────────────────────────────────────────────┤
│           CAMADA 5: Operaacional               │
│  Environment variables (nunca em commit)       │
│  .gitignore para .env                          │
│  Logging estruturado                           │
│  Error handling centralizado                   │
│  Stack traces nunca em produção                │
└────────────────────────────────────────────────┘
```

### 6.2 CORS Configuração

```javascript
// Apenas a Cloudflare Pages pode fazer requests
const ALLOWED_ORIGINS = [
  'https://www.exemplo.com',
  'https://exemplo.com'
];

app.use(cors({
  origin: function(origin, callback) {
    if (!origin || ALLOWED_ORIGINS.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,  // Necessário para cookies
  methods: ['GET', 'POST', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
```

---

## 7. ESTRUTURA DE DEPLOYMENT

### 7.1 Ambiente

```
┌──────────────────────────────────────────────────────┐
│                    GITHUB                             │
│  Repositório principal                              │
│  .gitignore → .env nunca enviado                    │
└──────────────┬──────────────────┬────────────────────┘
               │                  │
               ▼                  ▼
┌──────────────────────┐  ┌──────────────────────────────┐
│   CLOUDFLARE PAGES   │  │          RENDER              │
│                      │  │                              │
│  Frontend            │  │  Backend                     │
│  HTML/CSS/JS         │  │  Node.js + Express           │
│  Deploy automático   │  │  API REST                    │
│  do push para main   │  │  PostgreSQL Database         │
│                      │  │  Secrets em dashboard        │
└──────────────────────┘  └──────────────────────────────┘
                                   │
                                   ▼
                        ┌──────────────────────┐
                        │   RENDER POSTGRESQL  │
                        │                      │
                        │  - Auto-backups      │
                        │  - SSL connections   │
                        │  - Connection pool   │
                        └──────────────────────┘
```

### 7.2 Environment Variables

```env
# ============================================
# NAILBOOK - Environment Variables
# Nunca commitar este ficheiro para o GitHub!
# ============================================

# Database
DATABASE_URL=postgresql://user:password@host:5432/nailbook

# JWT
JWT_SECRET=uma-string-secreta-muito-longa-e-aleatoria
JWT_REFRESH_SECRET=outra-string-secreta-muito-longa-e-aleatoria

# CORS / Domínios
CORS_ORIGIN=https://www.exemplo.com
APP_URL=https://www.exemplo.com
API_URL=https://api.exemplo.com

# Server
PORT=3000
NODE_ENV=production
TIMEZONE=Europe/Lisbon

# Email (Resend)
EMAIL_PROVIDER=resend
EMAIL_API_KEY=re_xxxxxxxxxxxxxxxxxxxxxxxx
EMAIL_FROM=noemail@nailbook.com

# WhatsApp (futuro)
WHATSAPP_ENABLED=false
WHATSAPP_API_URL=
WHATSAPP_TOKEN=

# Admin inicial (primeira execução)
INITIAL_ADMIN_EMAIL=admin@exemplo.com
INITIAL_ADMIN_PASSWORD=MudeEstaSenha123!
```

---

## 8. MIGRAÇÕES DE BASE DE DADOS

### 8.1 Estratégia

- Ficheiros SQL numerados (`001_create_tables.sql`, `002_add_constraints.sql`, `003_add_indexes.sql`)
- Executados sequencialmente pelo runner de migrações
- Idempotentes onde possível
- Rollback documentado em cada ficheiro

### 8.2 Ordem de Execução

1. **001_create_tables.sql** — Criar todas as tabelas
2. **002_add_constraints.sql** — Adicionar constraints, EXCLUDE, FK
3. **003_add_indexes.sql** — Criar índices para performance

---

## 9. TESTES

### 9.1 Coberura

| Categoria | Ficheiro | Foco |
|-----------|----------|------|
| Login | `auth.test.js` | Credenciais válidas/inválidas, rate limiting |
| Serviços | `services.test.js` | CRUD, validação |
| Disponibilidade | `availability.test.js` | Horários por dia, pausas, bloqueios |
| Criação | `booking.test.js` | Fluxo completo, validação |
| Double Booking | `doubleBooking.test.js` | Concorrência, transações |
| Bloqueios | `blockings.test.js` | Dia inteiro, intervalo, vários dias |
| Timezone | `timezone.test.js` | Europe/Lisbon, DST |
| Tokens | `tokens.test.js` | Consulta/cancelamento por token |
| Segurança | `security.test.js` | SQL injection, XSS, headers |

### 9.2 Ferramenta

- **Jest** como framework de testes
- **Supertest** para testar endpoints HTTP
- **Test database separada** (Render cria DB de teste ou usar container local)

---

## 10. DESIGN FRONTEND

### 10.1 Paleta de Cores

```css
/* Elegant, Minimal, Feminine, Professional */
:root {
  --color-primary: #2C2C2C;        /* Preto elegante */
  --color-secondary: #8B7355;     /* Bege quente */
  --color-accent: #C9A96E;        /* Dourado suave */
  --color-background: #FAF9F6;     /* Branco com calor */
  --color-surface: #FFFFFF;       /* Branco puro */
  --color-text: #1A1A1A;          /* Preto suave */
  --color-text-muted: #6B6B6B;    /* Cinza médio */
  --color-border: #E8E5E0;        /* Bege claro */
  --color-success: #4A7C59;       /* Verde elegante */
  --color-error: #B85450;         /* Vermelho suave */
  --color-warning: #D4A574;       /* Terracota */
}
```

**Porquê esta paleta**: Moderna, sofisticada, sem infantilismo. Evita pink e roxo. O bege/dourado transmite luxo e cuidado. O preto é a base elegante.

### 10.2 Tipografia

```css
--font-heading: 'Playfair Display', serif;  /* Elegante, sofisticado */
--font-body: 'Inter', sans-serif;            /* Limpa, legível */
```

### 10.3 Responsividade

- Mobile-first (375px+)
- Breakpoints: 480px, 768px, 1024px, 1440px
- Touch-friendly no mobile (botões ≥ 44px)
- Dashboard responsivo (cards empilhados no mobile)

---

## 11. NOTAS FINAIS DE ARQUITETURA

### 11.1 Decisões que Podem Mudar

| Decisão | Alternativa | Razão da escolha |
|---------|-------------|-----------------|
| JWT em cookies | JWT em localStorage | Cookies são mais seguros contra XSS |
| EXCLUDE constraint | Apenas transações | EXCLUDE é a rede de segurança definitiva |
| UUIDs | IDs sequenciais | UUIDs não expõem dados internos |
| price_cents (int) | DECIMAL | Mais preciso e sem problemas de float |
| Email no futuro | Implementar já | Preparação sem integração falsa |

### 11.2 Próximos Passos (Fase 2+)

- **Fase 2**: PostgreSQL e migrations
- **Fase 3**: Backend e API (rotas, controllers, models)
- **Fase 4**: Motor de disponibilidade e sistema de marcações
- **Fase 5**: Dashboard administrativo
- **Fase 6**: Site público (landing page, booking flow)
- **Fase 7**: Emails, cancelamento, calendário, notificações
- **Fase 8**: Segurança, testes e deployment

### 11.3 Princípios de Código

1. **O backend nunca delega**: Sempre verifica disponibilidade no servidor
2. **Persistência real**: Nunca localStorage para marcações
3. **Tratamento de erros**: Nunca stack traces em produção
4. **Validação em todas as camadas**: Frontend (UX) + Backend (segurança)
5. **Modular**: Cada ficheiro tem uma responsabilidade única
6. **Comentários**: Apenas quando a lógica é complexa ou não óbvia
7. **Nomes claros**: `getAvailableSlots()` não `getSlots()`
