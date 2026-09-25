/**
 * NAILBOOK — Modelo de Notificações
 * Gestão de notification_logs com suporte a retry e idempotência
 */

import { pool } from '../config/database.js';
import { v4 as uuid } from 'uuid';
import { toPgTimestamp } from '../utils/timezone.js';

/**
 * NotificationLog model — todos os timestamps em timestamptz UTC
 */
export const NotificationLog = {
  /**
   * Criar novo registo de notificação
   */
  async create({ appointmentId, type, notificationType, channel, recipient, subject, body, idempotencyKey, scheduledFor, maxAttempts = 3 }) {
    const result = await pool.query(`
      INSERT INTO notification_logs (id, appointment_id, type, notification_type, channel, recipient, subject, body, idempotency_key, scheduled_for, max_attempts, attempts, status, next_retry_at, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 0, 'pending', $12, $13, $14)
      RETURNING *
    `, [
      uuid(),
      appointmentId,
      type,
      notificationType,
      channel,
      recipient,
      subject,
      body,
      idempotencyKey || null,
      scheduledFor ? new Date(scheduledFor).toISOString() : null,
      maxAttempts,
      new Date(scheduledFor).toISOString(), // next_retry_at initially = scheduled_for
      new Date().toISOString(),
      new Date().toISOString()
    ]);
    return result.rows[0];
  },

  /**
   * Obter notificações pendentes para processamento
   * Usa SKIP LOCKED para concorrência segura
   */
  async findPending(limit = 50) {
    const result = await pool.query(`
      SELECT * FROM notification_logs
      WHERE status IN ('pending', 'processing')
      AND scheduled_for <= NOW()
      ORDER BY scheduled_for ASC
      LIMIT $1
      FOR UPDATE SKIP LOCKED
    `, [limit]);
    return result.rows;
  },

  /**
   * Obter por ID
   */
  async findById(id) {
    const result = await pool.query('SELECT * FROM notification_logs WHERE id = $1', [id]);
    return result.rows[0] || null;
  },

  /**
   * Verificar se já existe notificação idempotente
   */
  async findByIdempotencyKey(key) {
    const result = await pool.query('SELECT * FROM notification_logs WHERE idempotency_key = $1', [key]);
    return result.rows[0] || null;
  },

  /**
   * Marcar como processando
   */
  async markProcessing(id) {
    const result = await pool.query(`
      UPDATE notification_logs
      SET status = 'processing', processing_started_at = $1, updated_at = $2
      WHERE id = $3 AND status = 'pending'
      RETURNING *
    `, [new Date().toISOString(), new Date().toISOString(), id]);
    return result.rows[0] || null;
  },

  /**
   * Marcar como enviada
   */
  async markSent(id, providerMessageId) {
    const result = await pool.query(`
      UPDATE notification_logs
      SET status = 'sent', provider_message_id = $1, sent_at = $2, attempts = attempts + 1, updated_at = $3
      WHERE id = $4
      RETURNING *
    `, [providerMessageId || null, new Date().toISOString(), new Date().toISOString(), id]);
    return result.rows[0] || null;
  },

  /**
   * Marcar como falhou com retry
   */
  async markFailed(id, errorMessage, retryDelayMs = null) {
    const now = new Date();
    const nextRetry = retryDelayMs
      ? new Date(now.getTime() + retryDelayMs).toISOString()
      : new Date(now.getTime() + 60000).toISOString(); // Default 1 min

    const result = await pool.query(`
      UPDATE notification_logs
      SET status = 'failed', error_message = $1, next_retry_at = $2, attempts = attempts + 1, updated_at = $3
      WHERE id = $4
      RETURNING *
    `, [errorMessage, nextRetry, new Date().toISOString(), id]);
    return result.rows[0] || null;
  },

  /**
   * Marcar como permanentemente falhou
   */
  async markPermanentFailure(id, errorMessage) {
    const result = await pool.query(`
      UPDATE notification_logs
      SET status = 'failed', error_message = $1, updated_at = $2
      WHERE id = $3
      RETURNING *
    `, [errorMessage, new Date().toISOString(), id]);
    return result.rows[0] || null;
  },

  /**
   * Cancelar notificações pendentes de uma marcação
   */
  async cancelByAppointment(appointmentId) {
    const result = await pool.query(`
      UPDATE notification_logs
      SET status = 'cancelled', updated_at = $1
      WHERE appointment_id = $2 AND status IN ('pending', 'processing')
      RETURNING *
    `, [new Date().toISOString(), appointmentId]);
    return result.rows;
  },

  /**
   * Recalcular lembretes quando a marcação é atualizada
   * Cancela lembretes antigos e cria novos
   */
  async recalculateReminders(appointmentId, newScheduledFor) {
    // Cancelar lembretes pendentes existentes
    await pool.query(`
      UPDATE notification_logs
      SET status = 'cancelled', updated_at = $1
      WHERE appointment_id = $2 AND type IN ('reminder_24h', 'reminder_2h') AND status IN ('pending', 'processing')
    `, [new Date().toISOString(), appointmentId]);

    // Criar novos lembretes baseados na nova data
    const reminders = [];
    const settings = await pool.query('SELECT reminder_24h_enabled, reminder_2h_enabled, cancellation_deadline_hours FROM settings LIMIT 1');
    const s = settings.rows[0];

    const dateTime = new Date(newScheduledFor);

    if (s?.reminder_24h_enabled) {
      const reminder24h = new Date(dateTime.getTime() - 24 * 60 * 60 * 1000);
      reminders.push({ type: 'reminder_24h', scheduledFor: reminder24h.toISOString() });
    }

    if (s?.reminder_2h_enabled) {
      const reminder2h = new Date(dateTime.getTime() - 2 * 60 * 60 * 1000);
      reminders.push({ type: 'reminder_2h', scheduledFor: reminder2h.toISOString() });
    }

    for (const reminder of reminders) {
      await this.create({
        appointmentId,
        type: reminder.type,
        notificationType: reminder.type,
        channel: 'email',
        recipient: null, // Will be updated when appointment is processed
        subject: null, // Will be set by notification service
        body: null, // Will be set by notification service
        scheduledFor: reminder.scheduledFor,
        maxAttempts: 3
      });
    }

    return reminders;
  },

  /**
   * Obter estatísticas de notificações
   */
  async getStats() {
    const result = await pool.query(`
      SELECT type, channel, status, COUNT(*) as count
      FROM notification_logs
      GROUP BY type, channel, status
      ORDER BY type, channel, status
    `);
    return result.rows;
  },

  /**
   * Obter notificações por marcação
   */
  async findByAppointment(appointmentId) {
    const result = await pool.query(
      'SELECT * FROM notification_logs WHERE appointment_id = $1 ORDER BY created_at DESC',
      [appointmentId]
    );
    return result.rows;
  },

  /**
   * Contar notificações pendentes
   */
  async countPending() {
    const result = await pool.query(
      "SELECT COUNT(*) FROM notification_logs WHERE status IN ('pending', 'processing')"
    );
    return parseInt(result.rows[0].count);
  },

  /**
   * Verificar se já existe notificação para um appointment e tipo
   */
  async exists(appointmentId, type) {
    const result = await pool.query(
      'SELECT 1 FROM notification_logs WHERE appointment_id = $1 AND type = $2 AND status IN ($3, $4)',
      [appointmentId, type, 'pending', 'processing']
    );
    return result.rows.length > 0;
  },

  /**
   * Obter notificações com filtros (admin)
   */
  async findAllFiltered(where, params, limit, offset) {
    const result = await pool.query(`
      SELECT nl.*, a.customer_name, a.service_id, s.name as service_name, a.start_at, a.status as appointment_status
      FROM notification_logs nl
      LEFT JOIN appointments a ON nl.appointment_id = a.id
      LEFT JOIN services s ON a.service_id = s.id
      ${where}
      ORDER BY nl.created_at DESC
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}
    `, [...params, limit, offset]);

    const countResult = await pool.query(
      `SELECT COUNT(*) FROM notification_logs nl ${where}`,
      params
    );

    return {
      rows: result.rows,
      total: parseInt(countResult.rows[0].count)
    };
  }
};
