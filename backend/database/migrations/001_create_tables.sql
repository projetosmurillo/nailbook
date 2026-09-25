-- ============================================
-- NAILBOOK — Migração 001: Criação das Tabelas
-- ============================================
-- Database: PostgreSQL 15+ compatible with Render
-- Timezone: Europe/Lisbon
-- Extension: btree_gist (required for EXCLUDE constraints)
-- ============================================

-- Extensões obrigatórias
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "btree_gist";

-- ============================================
-- TIPO CUSTOM PARA ESTADOS
-- ============================================

CREATE TYPE appointment_status AS ENUM (
    'confirmed',
    'cancelled',
    'completed',
    'no_show'
);

CREATE TYPE notification_channel AS ENUM (
    'email',
    'whatsapp'
);

CREATE TYPE notification_status AS ENUM (
    'pending',
    'sent',
    'failed'
);

-- ============================================
-- 1. ADMIN_USERS
-- ============================================
-- Passwords armazenadas com bcrypt (hash).
-- Nunca em texto simples.
-- A profissão tem apenas uma conta administrativa (role = 'admin').
-- O campo role permite expansão futura (ex: 'manager', 'receptionist').

CREATE TABLE admin_users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    name VARCHAR(100) NOT NULL,
    role VARCHAR(20) NOT NULL DEFAULT 'admin' CHECK (role IN ('admin', 'manager', 'receptionist')),
    active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_login_at TIMESTAMPTZ
);

-- Índice para lookup por email (usado no login)
CREATE INDEX idx_admin_users_email ON admin_users(email);
CREATE INDEX idx_admin_users_active ON admin_users(active);

-- ============================================
-- 2. CUSTOMERS
-- ============================================
-- O telefone é o identificador principal para evitar duplicação.
-- Email é opcional (a cliente não precisa de conta).
-- Não é necessário email UNIQUE porque diferentes clientes podem partilhar o mesmo email (ex: familiar).

CREATE TABLE customers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    phone VARCHAR(20) NOT NULL,
    email VARCHAR(255),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Constraints
    CONSTRAINT customers_phone_not_empty CHECK (LENGTH(TRIM(phone)) >= 5),
    CONSTRAINT customers_name_not_empty CHECK (LENGTH(TRIM(name)) >= 1)
);

-- Índice para lookup por telefone (identificação de cliente existente)
CREATE INDEX idx_customers_phone ON customers(phone);
CREATE INDEX idx_customers_email ON customers(email);
CREATE INDEX idx_customers_created ON customers(created_at);

-- ============================================
-- 3. SERVICES
-- ============================================
-- Preço armazenado como NUMERIC(10,2) para evitar problemas de floating point.
-- A duração é em minutos.
-- O campo active permite desativar serviços sem os eliminar.

CREATE TABLE services (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    description TEXT,
    price NUMERIC(10,2) NOT NULL CHECK (price >= 0),
    duration_minutes INTEGER NOT NULL CHECK (duration_minutes >= 5 AND duration_minutes <= 480),
    active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Constraints
    CONSTRAINT services_name_not_empty CHECK (LENGTH(TRIM(name)) >= 1)
);

-- Índice para consulta de serviços ativos
CREATE INDEX idx_services_active ON services(active);
CREATE INDEX idx_services_name ON services(name);

-- ============================================
-- 4. APPOINTMENTS
-- ============================================
-- Esta é a tabela central do sistema.
--
-- start_at e end_at são TIMESTAMPTZ (UTC).
-- O preço e duração são SNAPSHOT no momento da reserva.
-- Alterações futuras no serviço NÃO afetam marcações antigas.
--
-- Double booking prevention:
-- Constraint EXCLUDE USING gist com tstzrange sobre o intervalo
-- Apenas para estados que efetivamente ocupam o horário.
--
-- Estados possíveis (enum appointment_status):
--   confirmed  -> Marcação ativa, ocupa o horário
--   cancelled  -> Não ocupa horário
--   completed  -> Atendimento realizado, não ocupa horário
--   no_show    -> Cliente não apareceu, não ocupa horário

CREATE TABLE appointments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE SET NULL,
    service_id UUID NOT NULL REFERENCES services(id) ON DELETE SET NULL,
    status appointment_status NOT NULL DEFAULT 'confirmed',
    start_at TIMESTAMPTZ NOT NULL,
    end_at TIMESTAMPTZ NOT NULL,
    price NUMERIC(10,2) NOT NULL CHECK (price >= 0),
    duration_snapshot_minutes INTEGER NOT NULL CHECK (duration_snapshot_minutes >= 5 AND duration_snapshot_minutes <= 480),
    customer_notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    cancelled_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,

    -- CHECK: end_at deve ser posterior a start_at
    CONSTRAINT appointments_end_after_start CHECK (end_at > start_at),

    -- CHECK: cancelled_at só existe se estado for cancelled
    CONSTRAINT appointments_cancelled_at_check CHECK (
        (status = 'cancelled' AND cancelled_at IS NOT NULL) OR
        (status != 'cancelled' AND cancelled_at IS NULL)
    ),

    -- CHECK: completed_at só existe se estado for completed ou no_show
    CONSTRAINT appointments_completed_at_check CHECK (
        ((status = 'completed' OR status = 'no_show') AND completed_at IS NOT NULL) OR
        ((status != 'completed' AND status != 'no_show') AND completed_at IS NULL)
    )
);

-- ============================================
-- DOUBLE BOOKING PROTECTION (Constraint EXCLUDE)
-- ============================================
-- A constraint usa tstzrange para verificar sobreposição de intervalos.
-- Apenas aplica-se a marcações com status = 'confirmed' (ocupam o horário).
-- Se duas marcações do mesmo serviço tiverem intervalos sobrepostos E
-- ambas em estado 'confirmed', o PostgreSQL rejeita a segunda inserção.
--
-- Isto é a camada FINAL de proteção. Mesmo que a aplicação falhe,
-- o banco de dados rejeita fisicamente o double booking.
--
-- A extensão btree_gist é obrigatória para operadores de range no gist.

CREATE INDEX idx_appointments_service_start ON appointments(service_id, start_at);
CREATE INDEX idx_appointments_service_end ON appointments(service_id, end_at);
CREATE INDEX idx_appointments_customer ON appointments(customer_id);
CREATE INDEX idx_appointments_status ON appointments(status);
CREATE INDEX idx_appointments_created ON appointments(created_at);

-- Constraint EXCLUDE usando tstzrange
-- A constraint só aplica-se a appointments com status = 'confirmed'
-- O WHERE clause filtra antes de verificar a exclusão
ALTER TABLE appointments ADD CONSTRAINT appointments_no_double_booking
EXCLUDE USING gist (
    service_id WITH =,
    tstzrange(start_at, end_at) WITH &&
)
WHERE (status = 'confirmed');

-- ============================================
-- 5. BUSINESS_HOURS
-- ============================================
-- Horários de funcionamento em hora LOCAL (Europe/Lisbon).
-- Usam o tipo TIME do PostgreSQL.
-- Permitem múltiplos períodos no mesmo dia (ex: 09:00-13:00 e 14:00-18:00).
-- O campo active permite marcar um dia como fechado (sem registos).
--
-- day_of_week: 0=Sunday, 1=Monday, ..., 6=Saturday (compatível com JavaScript)
-- horários são locais, não UTC.
-- O backend converte para UTC quando calcula disponibilidade.

CREATE TABLE business_hours (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    day_of_week SMALLINT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
    opens_at TIME NOT NULL,
    closes_at TIME NOT NULL,
    active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Constraints
    CONSTRAINT business_hours_closes_after_opens CHECK (closes_at > opens_at),
    CONSTRAINT business_hours_unique_period UNIQUE (day_of_week, opens_at, closes_at)
);

-- Índice para consultar horários por dia
CREATE INDEX idx_business_hours_day ON business_hours(day_of_week);
CREATE INDEX idx_business_hours_active ON business_hours(active);

-- ============================================
-- 6. BREAKS
-- ============================================
-- Pausas dentro do horário de funcionamento.
-- São horários locais (TIME).
-- O campo active permite ativar/desativar pausas.
-- Descrição opcional para identificar a pausa (ex: "Almoço", "Pausa").

CREATE TABLE breaks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    day_of_week SMALLINT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
    starts_at TIME NOT NULL,
    ends_at TIME NOT NULL,
    description VARCHAR(100),
    active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Constraints
    CONSTRAINT breaks_ends_after_starts CHECK (ends_at > starts_at),
    CONSTRAINT breaks_unique_period UNIQUE (day_of_week, starts_at, ends_at)
);

-- Índice para consultar pausas por dia
CREATE INDEX idx_breaks_day ON breaks(day_of_week);

-- ============================================
-- 7. BLOCKED_PERIODS
-- ============================================
-- Períodos bloqueados (férias, feriados, bloqueios manuais).
-- Usam TIMESTAMPTZ (UTC) para timestamps reais.
-- Podem bloquear um dia inteiro, um intervalo ou vários dias.
-- O campo reason permite identificar o motivo.

CREATE TABLE blocked_periods (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    starts_at TIMESTAMPTZ NOT NULL,
    ends_at TIMESTAMPTZ NOT NULL,
    reason VARCHAR(255),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Constraint: end must be after start
    CONSTRAINT blocked_periods_end_after_start CHECK (ends_at > starts_at)
);

-- Índice GiST para consulta rápida de sobreposição de períodos
CREATE INDEX idx_blocked_periods_range ON blocked_periods USING gist (
    tstzrange(starts_at, ends_at)
);
CREATE INDEX idx_blocked_periods_dates ON blocked_periods(starts_at, ends_at);

-- ============================================
-- 8. SETTINGS
-- ============================================
-- Configurações gerais do negócio.
-- Todos os campos são opcionais exceto timezone.
-- Permite configurar regras de negócio sem alterar código.
-- Apenas um registo por vez (implementado no modelo).

CREATE TABLE settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    business_name VARCHAR(255) NOT NULL DEFAULT '',
    business_phone VARCHAR(20) NOT NULL DEFAULT '',
    business_email VARCHAR(255),
    timezone VARCHAR(50) NOT NULL DEFAULT 'Europe/Lisbon',
    minimum_advance_hours INTEGER NOT NULL DEFAULT 0,
    maximum_booking_days INTEGER NOT NULL DEFAULT 30,
    cancellation_deadline_hours INTEGER NOT NULL DEFAULT 24,
    min_interval_minutes INTEGER NOT NULL DEFAULT 0,
    currency VARCHAR(3) NOT NULL DEFAULT 'EUR',
    whatsapp_enabled BOOLEAN NOT NULL DEFAULT false,
    whatsapp_phone VARCHAR(20),
    whatsapp_token TEXT,
    google_calendar_enabled BOOLEAN NOT NULL DEFAULT false,
    google_calendar_id VARCHAR(255),
    email_notifications_enabled BOOLEAN NOT NULL DEFAULT true,
    reminder_24h_enabled BOOLEAN NOT NULL DEFAULT true,
    reminder_2h_enabled BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índice para consulta rápida
CREATE INDEX idx_settings_id ON settings(id);

-- ============================================
-- 9. BOOKING_TOKENS
-- ============================================
-- Tokens para a cliente consultar/cancelar marcação sem conta.
-- O token NÃO é guardado em texto simples.
-- É guardado o HASH do token (bcrypt).
-- A validação compara o hash.
-- Cada token tem expiração (30 dias por defeito).
-- Um appointment pode ter múltiplos tokens (rotação segura).

CREATE TABLE booking_tokens (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    appointment_id UUID NOT NULL REFERENCES appointments(id) ON DELETE CASCADE,
    token_hash VARCHAR(255) NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Constraint: token deve ter expiração máxima de 90 dias
    CONSTRAINT booking_tokens_max_expiry CHECK (expires_at <= created_at + interval '90 days')
);

-- Índice para validação rápida de expiração
CREATE INDEX idx_booking_tokens_expires ON booking_tokens(expires_at);
CREATE INDEX idx_booking_tokens_appointment ON booking_tokens(appointment_id);

-- ============================================
-- 10. NOTIFICATION_LOGS
-- ============================================
-- Registo de todas as notificações enviadas.
-- Suporta múltiplos canais (email, whatsapp).
-- Permite auditoria completa das comunicações.
-- Se o email falhar, a marcação permanece intacta.
-- O log regista o erro para diagnóstico posterior.

CREATE TABLE notification_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    appointment_id UUID REFERENCES appointments(id) ON DELETE SET NULL,
    type VARCHAR(50) NOT NULL CHECK (type IN (
        'booking_created',
        'booking_confirmed',
        'booking_cancelled',
        'reminder_24h',
        'reminder_2h'
    )),
    channel notification_channel NOT NULL,
    status notification_status NOT NULL DEFAULT 'pending',
    recipient VARCHAR(255),
    subject VARCHAR(255),
    body TEXT,
    provider_message_id VARCHAR(255),
    provider VARCHAR(50),
    error_message TEXT,
    sent_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Index para filtrar por tipo e status
    CONSTRAINT notification_logs_valid_status CHECK (
        status IN ('pending', 'sent', 'failed')
    )
);

-- Índices para filtrar por tipo, status e data
CREATE INDEX idx_notification_logs_appointment ON notification_logs(appointment_id);
CREATE INDEX idx_notification_logs_type ON notification_logs(type);
CREATE INDEX idx_notification_logs_status ON notification_logs(status);
CREATE INDEX idx_notification_logs_created ON notification_logs(created_at);
CREATE INDEX idx_notification_logs_channel ON notification_logs(channel);
CREATE INDEX idx_notification_logs_sent ON notification_logs(sent_at);

-- ============================================
-- VIEWS PARA DASHBOARD
-- ============================================

-- View: Resumo de hoje
CREATE OR REPLACE VIEW v_dashboard_today AS
SELECT
    COUNT(*) as total_appointments,
    COUNT(*) FILTER (WHERE status = 'confirmed') as confirmed,
    COUNT(*) FILTER (WHERE status = 'cancelled') as cancelled,
    COUNT(*) FILTER (WHERE status = 'completed') as completed,
    COUNT(*) FILTER (WHERE status = 'no_show') as no_show,
    COALESCE(SUM(price), 0) as total_revenue
FROM appointments
WHERE DATE(start_at) = CURRENT_DATE;

-- View: Estatísticas de clientes
CREATE OR REPLACE VIEW v_customer_stats AS
SELECT
    c.id,
    c.name,
    c.phone,
    c.email,
    COUNT(a.id) as total_appointments,
    MAX(a.start_at) as last_appointment,
    MIN(CASE WHEN a.start_at > NOW() THEN a.start_at END) as next_appointment,
    COALESCE(SUM(a.price), 0) as total_spent
FROM customers c
LEFT JOIN appointments a ON c.id = a.customer_id
GROUP BY c.id;

-- ============================================
-- FUNCTION: Atualizar updated_at automaticamente
-- ============================================

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers para atualizar updated_at automaticamente
CREATE TRIGGER trg_admin_users_updated
    BEFORE UPDATE ON admin_users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_customers_updated
    BEFORE UPDATE ON customers
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_services_updated
    BEFORE UPDATE ON services
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_appointments_updated
    BEFORE UPDATE ON appointments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_settings_updated
    BEFORE UPDATE ON settings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_blocked_periods_updated
    BEFORE UPDATE ON blocked_periods
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
