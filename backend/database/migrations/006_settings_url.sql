-- ============================================
-- NAILBOOK — Migração 006: Settings Adicionais
-- ============================================
-- Adiciona colunas para URL pública e email administrativo
-- ============================================

-- Adicionar business_url às settings
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'settings' AND column_name = 'business_url'
  ) THEN
    ALTER TABLE settings ADD COLUMN business_url VARCHAR(255) DEFAULT '';
  END IF;
END $$;

-- Adicionar admin_notification_email às settings
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'settings' AND column_name = 'admin_notification_email'
  ) THEN
    ALTER TABLE settings ADD COLUMN admin_notification_email VARCHAR(255);
  END IF;
END $$;

-- Adicionar calendar_location se não existir (verificação de segurança)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'settings' AND column_name = 'calendar_location'
  ) THEN
    ALTER TABLE settings ADD COLUMN calendar_location VARCHAR(255) DEFAULT '';
  END IF;
END $$;

-- Atualizar o trigger de updated_at para incluir as novas colunas
-- (O trigger existingente atualiza updated_at automaticamente)

COMMENT ON COLUMN settings.business_url IS 'URL pública da aplicação (ex: https://www.meudominio.pt)';
COMMENT ON COLUMN settings.admin_notification_email IS 'Email para notificações administrativas';
COMMENT ON COLUMN settings.calendar_location IS 'Localização para eventos de calendário';
