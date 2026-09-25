-- ============================================
-- NAILBOOK — Migração 002: Índices Simples
-- ============================================
-- Índices B-tree simples sem expressões com funções.
-- Índices com funções (LOWER, DATE, EXCLUDE) serão
-- adicionados numa migração posterior após
-- confirmação de compatibilidade com a versão do PostgreSQL.

-- ============================================
-- Índices para Consultas Comuns
-- ============================================

-- Appointments: Lookup por ID
CREATE INDEX idx_appointments_service_id
    ON appointments(service_id);

-- Appointments: Lookup por customer_id
CREATE INDEX idx_appointments_customer_id
    ON appointments(customer_id);

-- Appointments: Lookup por status
CREATE INDEX idx_appointments_status
    ON appointments(status);

-- Appointments: Lookup por start_at (consulta por data futura)
CREATE INDEX idx_appointments_start_at
    ON appointments(start_at);

-- Customers: Lookup por email (exact match)
CREATE INDEX idx_customers_email
    ON customers(email);

-- Customers: Lookup por phone (exact match)
CREATE INDEX idx_customers_phone
    ON customers(phone);

-- Booking Tokens: Lookup por appointment_id
CREATE INDEX idx_booking_tokens_appointment_id
    ON booking_tokens(appointment_id);

-- Booking Tokens: Lookup por expires_at
CREATE INDEX idx_booking_tokens_expires_at
    ON booking_tokens(expires_at);

-- Notification Logs: Lookup por appointment_id
CREATE INDEX idx_notification_logs_appointment_id
    ON notification_logs(appointment_id);

-- Notification Logs: Lookup por type
CREATE INDEX idx_notification_logs_type
    ON notification_logs(type);

-- Blocked Periods: Lookup por starts_at
CREATE INDEX idx_blocked_periods_starts_at
    ON blocked_periods(starts_at);

-- Blocked Periods: Lookup por ends_at
CREATE INDEX idx_blocked_periods_ends_at
    ON blocked_periods(ends_at);

-- Business Hours: Lookup por day_of_week
CREATE INDEX idx_business_hours_day_of_week
    ON business_hours(day_of_week);

-- Breaks: Lookup por day_of_week
CREATE INDEX idx_breaks_day_of_week
    ON breaks(day_of_week);

-- ============================================
-- Índices para Otimização de Dashboard
-- ============================================

-- Contagem rápida de marcações por estado
CREATE INDEX idx_appointments_status_only
    ON appointments(status);

-- Revenue por período (métricas)
CREATE INDEX idx_appointments_revenue
    ON appointments(status, price) WHERE status = 'completed';

-- ============================================
-- Constraints e Triggers (separados da lógica de índices)
-- ============================================

-- Appointments: Não pode haver marcação para o passado
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

-- ============================================
-- Funções Úteis
-- ============================================

-- Função: Converter hora local para timestamptz UTC
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
