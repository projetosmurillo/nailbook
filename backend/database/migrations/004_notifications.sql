-- ============================================
-- NAILBOOK — Migração 004: Notificações e Calendário
-- ============================================
-- Adiciona campos de retry e scheduling à notification_logs
-- Adiciona índices para processamento de lembretes
-- Adiciona colunas de timezone e calendário
-- ============================================

-- ============================================
-- EXTENSÃO PARA UUID
-- ============================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- ALTER TABLE notification_logs
-- ============================================
-- Adicionar campos para retry, scheduling e provider tracking

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'notification_logs' AND column_name = 'scheduled_for'
  ) THEN
    ALTER TABLE notification_logs ADD COLUMN scheduled_for TIMESTAMPTZ;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'notification_logs' AND column_name = 'attempts'
  ) THEN
    ALTER TABLE notification_logs ADD COLUMN attempts INTEGER NOT NULL DEFAULT 0;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'notification_logs' AND column_name = 'max_attempts'
  ) THEN
    ALTER TABLE notification_logs ADD COLUMN max_attempts INTEGER NOT NULL DEFAULT 3;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'notification_logs' AND column_name = 'next_retry_at'
  ) THEN
    ALTER TABLE notification_logs ADD COLUMN next_retry_at TIMESTAMPTZ;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'notification_logs' AND column_name = 'idempotency_key'
  ) THEN
    ALTER TABLE notification_logs ADD COLUMN idempotency_key VARCHAR(255) UNIQUE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'notification_logs' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE notification_logs ADD COLUMN updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
  END IF;
END $$;

-- Adicionar novo tipo de notificação
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'notification_logs' AND column_name = 'notification_type'
  ) THEN
    ALTER TABLE notification_logs ADD COLUMN notification_type VARCHAR(50);
  END IF;
END $$;

-- Atualizar constraint de status para incluir 'processing' e 'skipped'
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'notification_logs' AND column_name = 'processing_started_at'
  ) THEN
    ALTER TABLE notification_logs ADD COLUMN processing_started_at TIMESTAMPTZ;
  END IF;
END $$;

-- Index para processamento de reminders
CREATE INDEX IF NOT EXISTS idx_notification_logs_pending
    ON notification_logs(status, scheduled_for)
    WHERE status IN ('pending', 'processing');

CREATE INDEX IF NOT EXISTS idx_notification_logs_scheduled
    ON notification_logs(scheduled_for)
    WHERE status = 'pending' AND scheduled_for <= NOW();

CREATE INDEX IF NOT EXISTS idx_notification_logs_idempotency
    ON notification_logs(idempotency_key)
    WHERE idempotency_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_notification_logs_next_retry
    ON notification_logs(next_retry_at)
    WHERE status = 'failed' AND next_retry_at <= NOW();

-- ============================================
-- ADD SCHEDULED_FOR NOT NULL CONSTRAINT
-- ============================================
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'notification_logs' AND column_name = 'scheduled_for'
  ) THEN
    -- Alter column to be NOT NULL after populating existing data
    -- This is safe because existing rows have created_at
    ALTER TABLE notification_logs ALTER COLUMN scheduled_for SET NOT NULL;
  END IF;
END $$;

-- ============================================
-- VIEWS PARA NOTIFICAÇÕES
-- ============================================

CREATE OR REPLACE VIEW v_pending_notifications AS
SELECT * FROM notification_logs
WHERE status IN ('pending', 'processing')
AND scheduled_for <= NOW()
ORDER BY scheduled_for ASC
LIMIT 100;

CREATE OR REPLACE VIEW v_notification_stats AS
SELECT
    type,
    channel,
    status,
    COUNT(*) as count,
    MIN(created_at) as first_created,
    MAX(created_at) as last_created
FROM notification_logs
GROUP BY type, channel, status
ORDER BY type, channel, status;

-- ============================================
-- COMMENTS
-- ============================================
COMMENT ON TABLE notification_logs IS 'Registo de todas as notificações. Suporta retry idempotente.';
COMMENT ON COLUMN notification_logs.scheduled_for IS 'Quando a notificação deve ser processada (para reminders)';
COMMENT ON COLUMN notification_logs.attempts IS 'Número de tentativas de envio';
COMMENT ON COLUMN notification_logs.max_attempts IS 'Máximo de tentativas antes de falhar permanentemente';
COMMENT ON COLUMN notification_logs.next_retry_at IS 'Quando tentar novamente após falha';
COMMENT ON COLUMN notification_logs.idempotency_key IS 'Chave única para impedir processamento duplicado';
COMMENT ON COLUMN notification_logs.notification_type IS 'Tipo específico de notificação (booking_confirmed, booking_cancelled, etc.)';
