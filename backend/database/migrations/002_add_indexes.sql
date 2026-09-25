-- ============================================
-- NAILBOOK — Migração 002: Triggers e Funções
-- ============================================
-- Esta migração contém apenas:
--   - Triggers de validação
--   - Funções PL/pgSQL úteis
--
-- EXCLUDE constraints (sobreposição de business_hours/breaks)
-- serão adicionados numa migração posterior após
-- confirmação de compatibilidade com o PostgreSQL do Render.
-- Os dados serão protegidos por validação na aplicação.

-- ============================================
-- Trigger: Appointments não podem ser no passado
-- ============================================

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
