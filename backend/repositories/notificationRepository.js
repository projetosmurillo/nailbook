/**
 * NAILBOOK — Repositório de Notificações
 * Camada de abstração para jobs de notificação
 * 
 * Preparação para fila de emails/WhatsApp
 * Em produção, usar Redis ou BullMQ
 */

import { NotificationLog } from '../models/index.js';
import { emailService } from '../services/emailService.js';
import { logger } from '../utils/logger.js';

class NotificationRepository {
  /**
   * Enfileirar notificação para processamento
   */
  async queue({ appointmentId, type, channel, recipient, subject, body, provider }) {
    // Criar log de notificação
    const log = await NotificationLog.create({
      appointmentId,
      type,
      channel,
      status: 'pending',
      recipient,
      subject,
      body,
      provider
    });

    // Enfileirar para processamento
    await this.processQueue();

    return log;
  }

  /**
   * Processar fila de notificações pendentes
   * Em produção, isto seria um worker separado
   */
  async processQueue() {
    try {
      const pendingLogs = await pool.query(
        `SELECT * FROM notification_logs WHERE status = 'pending'`
      );

      for (const log of pendingLogs.rows) {
        await this.sendNotification(log);
      }
    } catch (err) {
      logger.error('Queue processing error:', err.message);
    }
  }

  /**
   * Enviar notificação individual
   */
  async sendNotification(log) {
    try {
      await NotificationLog.updateStatus(log.id, 'sent');
    } catch (err) {
      await NotificationLog.updateStatus(log.id, 'failed', err.message);
    }
  }

  /**
   * Obter notificações por appointment
   */
  async findByAppointment(appointmentId) {
    const result = await pool.query(
      `SELECT * FROM notification_logs WHERE appointment_id = $1 ORDER BY created_at DESC`,
      [appointmentId]
    );
    return result.rows;
  }

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
  }
}

// Exportar instância singleton
export const notificationRepository = new NotificationRepository();

// Import pool para uso interno (evitar circular dependency)
import { pool } from '../config/database.js';
