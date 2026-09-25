-- ============================================
-- NAILBOOK — Migração 003: Adicionar buffer_minutes
-- ============================================
-- Adiciona buffer_minutes à tabela settings
-- Usado para intervalo entre marcações

-- Adicionar coluna buffer_minutes se ainda não existir
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'settings' AND column_name = 'buffer_minutes'
  ) THEN
    ALTER TABLE settings ADD COLUMN buffer_minutes INTEGER NOT NULL DEFAULT 0;
  END IF;
END
$$;

-- Atualizar settings existentes
UPDATE settings SET buffer_minutes = 15 WHERE buffer_minutes = 0 AND id IS NOT NULL LIMIT 1;

-- Index para buffer (não necessário individualmente, mas documentado)
-- O buffer é utilizado na lógica do serviço, não em queries diretas

COMMENT ON COLUMN settings.buffer_minutes IS 'Intervalo mínimo entre marcações em minutos. O próximo slot começa buffer_minutes depois do fim do slot anterior.';
