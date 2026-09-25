# Documentação da Base de Dados — NailBook

## Visão Geral

A base de dados do NailBook é construída em PostgreSQL 15+ e contém 10 tabelas com integridade referencial completa.

## Esquema Relacional

```
┌───────────────┐       ┌──────────────────┐       ┌─────────────────┐
│  admin_users  │──1:N──││   appointments   │──N:1──│   customers     │
│               │       ││                  │       │                 │
│  id (PK)      │       ││  id (PK)         │       │  id (PK)        │
│  email (UNQ)  │       ││  customer_id(FK) │       │  phone (UNQ)    │
│  password_hash│       ││  service_id(FK)  │       │  email          │
│  role         │       │  status          │       │  name           │
│  active       │       │  start_at        │       │  created_at     │
└───────────────┘       │  end_at          │       └─────────────────┘
                        │  price (NUMERIC) │
                        │  duration_snap   │       ┌─────────────────┐
                        └──1:N─────────────┘       │   services      │
                            │                      │                 │
                            │                      │  id (PK)        │
                            │                      │  name           │
                            │                      │  price (NUMERIC)│
                            │                      │  duration_min   │
                            │                      │  active         │
                            │                      └─────────────────┘
                            │
┌──────────────────┐      │      ┌─────────────────┐
│  business_hours  │──────┘      │  booking_tokens   │
│                  │              │                   │
│  id (PK)         │              │  id (PK)          │
│  day_of_week     │              │  appointment_id(FK)│
│  opens_at (TIME) │              │  token_hash       │
│  closes_at (TIME)│              │  expires_at       │
└──────────────────┘              └─────────────────┘

┌──────────────────┐       ┌─────────────────┐       ┌─────────────────┐
│   breaks         │       │ blocked_periods  │       │ notification_logs│
│                  │       │                  │       │                  │
│  id (PK)         │       │  id (PK)         │       │  id (PK)         │
│  day_of_week     │       │  starts_at       │       │  appointment_id  │
│  starts_at       │       │  ends_at         │       │  type            │
│  ends_at         │       │  reason          │       │  channel         │
│  description     │       │  created_at      │       │  status          │
│  active          │       └─────────────────┘       │  provider        │
└──────────────────┘                                │  error_message   │
                                                    │  sent_at         │
                                                    └─────────────────┘

┌──────────────────┐
│   settings       │
│                  │
│  id (PK)         │
│  business_name   │
│  business_phone  │
│  business_email  │
│  timezone        │
│  min_advance_hrs │
│  max_book_days   │
│  cancellation_hrs│
│  whatsapp_enbl   │
│  ...             │
└──────────────────┘
```

## Tipos de Dados

### Timestamps
- Todas as timestamps reais usam `TIMESTAMPTZ` (timezone-aware)
- Armazenamento interno é UTC
- Apresentação é `Europe/Lisbon`
- O PostgreSQL gere automaticamente DST (horário de verão)

### Horários Recorrentes
- `business_hours.opens_at`, `business_hours.closes_at` → `TIME` (local)
- `breaks.starts_at`, `breaks.ends_at` → `TIME` (local)
- São interpretados como hora local `Europe/Lisbon`

### Preços
- `services.price`, `appointments.price` → `NUMERIC(10,2)`
- Armazena valores como `25.00`, `35.50`, etc.
- Evita problemas de floating point

### Estados
- `appointments.status` → `ENUM('confirmed', 'cancelled', 'completed', 'no_show')`
- Marcações são criadas diretamente como `confirmed` (V1 sem estado pending)
- Apenas `confirmed` ocupa o horário (EXCLUDE constraint)

## Double Booking Prevention

### Camada 1: Application-Level
- Verificação de conflitos antes da transação
- Feedback rápido ao utilizador

### Camada 2: Transaction-Level
- Transação com `ISOLATION LEVEL SERIALIZABLE`
- Verificação redundante dentro da transação
- Retry em caso de SerializationFailure (código 40001)

### Camada 3: Database-Level (DEFINITIVA)
```sql
ALTER TABLE appointments ADD CONSTRAINT appointments_no_double_booking
EXCLUDE USING gist (
    service_id WITH =,
    tstzrange(start_at, end_at) WITH &&
)
WHERE (status = 'confirmed');
```
- A constraint só aplica-se a marcações com `status = 'confirmed'`
- Impede fisicamente qualquer sobreposição
- Se a aplicação falhar, o PostgreSQL rejeita a inserção

## Índices Justificados

| Índice | Tabela | Razão |
|--------|--------|-------|
| `idx_admin_users_email` | admin_users | Lookup rápido no login |
| `idx_customers_phone` | customers | Identificação de cliente existente |
| `idx_customers_email` | customers | Busca por email |
| `idx_services_active` | services | Filtrar serviços ativos |
| `idx_appointments_customer` | appointments | Histórico do cliente |
| `idx_appointments_service_start` | appointments | Disponibilidade |
| `idx_appointments_date_status` | appointments | Dashboard por data/estado |
| `idx_appointments_future` | appointments | Próximas marcações |
| `idx_business_hours_day` | business_hours | Disponibilidade |
| `idx_blocked_periods_range` | blocked_periods | Consulta de sobreposição (GiST) |
| `idx_booking_tokens_expires` | booking_tokens | Verificação de expiração |
| `idx_notification_logs_appointment` | notification_logs | Auditoria |

## Timezone Handling

### Regras
1. **Timestamps reais** → `TIMESTAMPTZ` (UTC no storage, local na apresentação)
2. **Horários recorrentes** → `TIME` (interpretados como local)
3. **Dias da semana** → `SMALLINT` (0=Sunday, 1=Monday, ..., 6=Saturday)
4. **Nunca** manipular strings de hora para cálculos de disponibilidade

### Conversão
- O backend usa `AT TIME ZONE 'Europe/Lisbon'` para conversão
- O PostgreSQL gerencia DST automaticamente
- `get_utc_weekday()` retorna o dia da semana em Lisbon time

## Migrations

### Comandos
```bash
# Criar database (uma vez)
createdb nailbook

# Executar todas as migrações
npm run migrate

# Verificar estado das migrações
# (A tabela schema_migrations controla)

# Seed de dados de desenvolvimento
npm run seed
```

### Ordem de Execução
1. `001_create_tables.sql` — Cria todas as 10 tabelas + views + triggers
2. `002_add_indexes.sql` — Índices adicionais + constraints + funções úteis

## Security

### Passwords
- `bcrypt` com custo 12
- Nunca em texto simples
- O `admin_users.password_hash` tem 255 caracteres (suficiente para bcrypt)

### Tokens de Marcação
- `booking_tokens.token_hash` guarda hash bcrypt do token
- O token original é enviado à cliente
- A validação compara com bcrypt
- Expiração: 30 dias

### Foreign Keys
- `appointments.customer_id` → `customers.id` ON DELETE SET NULL
- `appointments.service_id` → `services.id` ON DELETE SET NULL
- `appointments.admin_user_id` → `admin_users.id` ON DELETE SET NULL
- `booking_tokens.appointment_id` → `appointments.id` ON DELETE CASCADE

## Notas de Produção

### Para o Render PostgreSQL
1. Criar database no painel do Render
2. Obter `DATABASE_URL` com o formato: `postgresql://user:password@host:5432/nailbook`
3. Executar migrations no startup do backend (`npm run migrate`)
4. O Render tem backups automáticos

### Para o Render Backend
1. O `startServer()` no `server.js` executa migrations automaticamente? 
   **NÃO** — adicione `npm run migrate` no Start Command do Render
2. Configurar `DATABASE_URL` como environment variable no Render
3. Configurar `NODE_ENV=production`
4. O `startServer()` verifica a conexão com o DB antes de iniciar

### Backups
- Render PostgreSQL tem backups automáticos diários
- Configurar retention policy no painel
- Exportar database localmente com `pg_dump` para dev

## Futuras Extensões

### Campos Preparados
- `appointments.admin_user_id` — para atribuir marcação a uma profissional específica
- `settings.whatsapp_token` — para futura integração WhatsApp Business API
- `settings.google_calendar_id` — para integração Google Calendar
- `notification_logs.provider_message_id` — para tracking de notificações

### Campos de Expansão
- `admin_users.role` — para múltiplos tipos de utilizador
- `services` — suporta até 8 serviços pré-configurados
- `appointments.status` — ENUM permite adicionar novos estados no futuro
