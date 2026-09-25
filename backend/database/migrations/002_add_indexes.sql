-- ============================================
-- NAILBOOK — Migração 002: Índices Adicionais
-- e Constraints de Performance
-- ============================================
-- Este ficheiro contém índices e constraints
-- que não podem ser criados na migração 001
-- porque dependem de tabelas existentes.
--
-- Execute após a 001_create_tables.sql.

-- ============================================
-- Índices para Consultas Comuns
-- ============================================

-- Appointments: Consulta por data e estado (dashboard)
CREATE INDEX idx_appointments_date_status
    ON appointments(DATE(start_at), status);

-- Appointments: Consulta por cliente e data (histórico)
CREATE INDEX idx_appointments_customer_date
    ON appointments(customer_id, DATE(start_at));

-- Appointments: Consulta por serviço e data (disponibilidade)
CREATE INDEX idx_appointments_service_date
    ON appointments(service_id, DATE(start_at), status);

-- Appointments: Consulta futura (dashboard)
CREATE INDEX idx_appointments_future
    ON appointments(start_at) WHERE status = 'confirmed';

-- Customers: Busca por email (case-insensitive)
CREATE INDEX idx_customers_email_lower
    ON customers(LOWER(email)) WHERE email IS NOT NULL;

-- Customers: Busca por telefone (case-insensitive)
CREATE INDEX idx_customers_phone_lower
    ON customers(LOWER(phone));

-- Booking Tokens: Lookup rápido por appointment_id com expiração
CREATE INDEX idx_booking_tokens_lookup
    ON booking_tokens(appointment_id, expires_at);

-- Notification Logs: Busca por appointment e tipo (auditoria)
CREATE INDEX idx_notification_logs_appointment_type
    ON notification_logs(appointment_id, type);

-- Blocked Periods: Busca por data (disponibilidade)
CREATE INDEX idx_blocked_periods_lookup
    ON blocked_periods USING gist (tstzrange(starts_at, ends_at));

-- Business Hours: Lookup por dia e ordem
CREATE INDEX idx_business_hours_lookup
    ON business_hours(day_of_week, active, opens_at);

-- Breaks: Lookup por dia e ordem
CREATE INDEX idx_breaks_lookup
    ON breaks(day_of_week, active, starts_at);

-- ============================================
-- Índices para Otimização de Dashboard
-- ============================================

-- Contagem rápida de marcações por estado e data
CREATE INDEX idx_appointments_dashboard
    ON appointments(status, DATE(start_at));

-- Revenue por período (métricas)
CREATE INDEX idx_appointments_revenue
    ON appointments(status, price) WHERE status = 'completed';

-- ============================================
-- Constraints Adicionais de Integridade
-- ============================================

-- Appointments: Não pode haver marcação para o passado
-- (executado como trigger, não como constraint simples)
CREATE OR REPLACE FUNCTION check_appointment_not_in_past()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.start_at < NOW() THEN
        RAISE EXCEPTION 'Não é possível criar marcações no passado';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_appointments_not_past
    BEFORE INSERT OR UPDATE ON appointments
    FOR EACH ROW EXECUTE FUNCTION check_appointment_not_in_past();

-- Business Hours: Periodos não podem sobrepor-se no mesmo dia
-- (usando EXCLUDE para garantir que não há sobreposição)
ALTER TABLE business_hours ADD CONSTRAINT business_hours_no_overlap
EXCLUDE USING gist (
    day_of_week WITH =,
    tstzrange(
        (day_of_week || ' ' || opens_at)::timestamptz,
        (day_of_week || ' ' || closes_at)::timestamptz
    ) WITH &&
);

-- Breaks: Não podem sobrepor-se com pausas no mesmo dia
ALTER TABLE breaks ADD CONSTRAINT breaks_no_overlap
EXCLUDE USING gist (
    day_of_week WITH =,
    tstzrange(
        (day_of_week || ' ' || starts_at)::timestamptz,
        (day_of_week || ' ' || ends_at)::timestamptz
    ) WITH &&
);

-- ============================================
-- Funções Úteis
-- ============================================

-- Função: Converter hora local para timestamptz UTC
-- Usada no backend para cálculos de disponibilidade
CREATE OR REPLACE FUNCTION local_time_to_utc(
    p_date DATE,
    p_time TIME,
    p_timezone TEXT DEFAULT 'Europe/Lisbon'
)
RETURNS TIMESTAMPTZ AS $$
BEGIN
    RETURN (p_date || ' ' || p_time)::timestamptz AT TIME ZONE p_timezone AT TIME ZONE 'UTC';
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Função: Obter o dia da semana em Lisbon time a partir de UTC
CREATE OR REPLACE FUNCTION get_utc_weekday(
    p_utc_timestamp TIMESTAMPTZ
)
RETURNS SMALLINT AS $$
DECLARE
    lisbon_date DATE;
BEGIN
    lisbon_date := p_utc_timestamp AT TIME ZONE 'Europe/Lisbon';
    RETURN EXTRACT(DOW FROM lisbon_date)::SMALLINT;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ============================================
-- Comments de Documentação
-- ============================================

COMMENT ON TABLE appointments IS 'Marcações dos clientes. O campo end_at é calculado como start_at + duration_snapshot_minutes.';
COMMENT ON COLUMN appointments.price IS 'Snapshot do preço do serviço no momento da reserva. Alterações futuras no serviço não alteram este valor.';
COMMENT ON COLUMN appointments.duration_snapshot_minutes IS 'Snapshot da duração do serviço no momento da reserva.';
COMMENT ON COLUMN appointments.status IS 'Estado da marcação. Apenas confirmed ocupa o horário (constraint EXCLUDE).';

COMMENT ON TABLE booking_tokens IS 'Tokens de acesso à marcação. O campo token_hash guarda o hash bcrypt do token, nunca o token em texto simples.';

COMMENT ON TABLE blocked_periods IS 'Períodos em que não são permitidas marcações. Usado para férias, feriados e bloqueios manuais.';

COMMENT ON TABLE business_hours IS 'Horários de funcionamento em hora LOCAL (Europe/Lisbon). O campo day_of_week segue o padrão JavaScript: 0=Sunday, 1=Monday, ..., 6=Saturday.';
