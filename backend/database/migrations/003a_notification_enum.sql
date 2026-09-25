-- ============================================
-- NAILBOOK — Migração 003a: Adicionar 'processing' ao Enum
-- ============================================
-- PostgreSQL requer que novos valores de enum sejam adicionados
-- numa transação separada antes de poderem ser usados.
-- Esta migration adiciona 'processing' ao enum notification_status.
-- A migration 004_notifications.sql pode então usar 'processing'
-- em índices e views.

ALTER TYPE notification_status ADD VALUE IF NOT EXISTS 'processing';
