-- ============================================
-- NAILBOOK — Migração 005: ICS Calendar
-- ============================================
-- Adiciona colunas de calendário e configurações
-- ============================================

-- Adicionar campos de calendário às settings
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'settings' AND column_name = 'ics_enabled'
  ) THEN
    ALTER TABLE settings ADD COLUMN ics_enabled BOOLEAN NOT NULL DEFAULT true;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'settings' AND column_name = 'calendar_location'
  ) THEN
    ALTER TABLE settings ADD COLUMN calendar_location VARCHAR(255) DEFAULT '';
  END IF;
END $$;

COMMENT ON COLUMN settings.ics_enabled IS 'Se o download de ficheiros .ics está habilitado';
COMMENT ON COLUMN settings.calendar_location IS 'Localização para eventos de calendário (ex: morada do salão)';
