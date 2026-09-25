/* ============================================
   NAILBOOK — Serviço de Notificações
   Camada central de gestão de notificações
   ============================================ */

import { NotificationLog } from '../models/notificationLog.js';
import { createEmailProvider, getProviderConfig, validateEmailConfig } from './emailProvider.js';
import { Setting } from '../models/index.js';
import { localToUtc } from '../utils/timezone.js';
import { logger } from '../utils/logger.js';

const LISBON_TIMEZONE = 'Europe/Lisbon';
const DEFAULT_BASE_URL = process.env.APP_URL || 'https://www.meudominio.pt';

function getBaseUrl(settings) {
  return settings?.business_url || DEFAULT_BASE_URL;
}

/**
 * NotificationService — Serviço central de notificações
 * 
 * Fluxo:
 * 1. Criar notificação (pending)
 * 2. Job processa (pending → processing)
 * 3. Provider envia
 * 4. Marcar como sent ou failed
 * 
 * A falha do email NUNCA afeta a marcação.
 */

class NotificationService {
  constructor() {
    this.emailProvider = createEmailProvider();
    this.providerConfig = getProviderConfig();
  }

  /**
   * Criar notificação de confirmação quando uma marcação é criada
   */
  async createBookingConfirmation(appointment) {
    const settings = await this._getSettings();
    const email = appointment.customer_email;

    // Se não tem email, skip (cliente pode marcar sem email)
    if (!email) {
      logger.info(`No email for appointment ${appointment.id}, skipping confirmation notification`);
      return { skipped: true, reason: 'no_email' };
    }

    const manageUrl = `${getBaseUrl(settings)}/marcacao/${appointment.token}`;
    const calendarUrl = `${getBaseUrl(settings)}/marcacao/${appointment.token}/calendar.ics`;

    // Idempotency key
    const idempotencyKey = `booking_confirmed_${appointment.id}`;

    // Check if already exists
    const existing = await NotificationLog.findByIdempotencyKey(idempotencyKey);
    if (existing) {
      logger.info(`Confirmation notification already exists for appointment ${appointment.id}`);
      return { skipped: true, reason: 'already_exists', id: existing.id };
    }

    const templates = this.emailProvider.getTemplates();
    const data = {
      businessName: settings?.business_name || 'NailBook',
      customerName: appointment.customer_name,
      serviceName: appointment.service?.name || 'Serviço',
      date: this._formatDate(appointment.start_at),
      time: this._formatTime(appointment.start_at),
      duration: appointment.duration_snapshot_minutes,
      price: `€${Number(appointment.price).toFixed(2)}`,
      manageUrl,
      calendarUrl,
      location: settings?.calendar_location || '',
      businessPhone: settings?.business_phone || ''
    };

    const notification = await NotificationLog.create({
      appointmentId: appointment.id,
      type: 'booking_confirmed',
      notificationType: 'booking_confirmation',
      channel: 'email',
      recipient: email,
      subject: templates.bookingConfirmation(data).subject,
      body: templates.bookingConfirmation(data).html,
      idempotencyKey,
      scheduledFor: new Date().toISOString(),
      maxAttempts: this.providerConfig.maxAttempts
    });

    logger.info(`Booking confirmation created: ${notification.id} for appointment ${appointment.id}`);
    return { notification, data };
  }

  /**
   * Criar notificação de cancelamento
   */
  async createBookingCancellation(appointment) {
    const settings = await this._getSettings();
    const email = appointment.customer_email;

    if (!email) {
      logger.info(`No email for appointment ${appointment.id}, skipping cancellation notification`);
      return { skipped: true, reason: 'no_email' };
    }

    // Cancelar lembretes pendentes
    await NotificationLog.cancelByAppointment(appointment.id);

    const manageUrl = `${getBaseUrl(settings)}/marcacao/${appointment.token}`;
    const idempotencyKey = `booking_cancelled_${appointment.id}`;

    const existing = await NotificationLog.findByIdempotencyKey(idempotencyKey);
    if (existing) {
      return { skipped: true, reason: 'already_exists', id: existing.id };
    }

    const templates = this.emailProvider.getTemplates();
    const data = {
      businessName: settings?.business_name || 'NailBook',
      customerName: appointment.customer_name,
      serviceName: appointment.service?.name || 'Serviço',
      date: this._formatDate(appointment.start_at),
      time: this._formatTime(appointment.start_at),
      location: settings?.calendar_location || '',
      businessPhone: settings?.business_phone || ''
    };

    const notification = await NotificationLog.create({
      appointmentId: appointment.id,
      type: 'booking_cancelled',
      notificationType: 'booking_cancellation',
      channel: 'email',
      recipient: email,
      subject: templates.bookingCancellation(data).subject,
      body: templates.bookingCancellation(data).html,
      idempotencyKey,
      scheduledFor: new Date().toISOString(),
      maxAttempts: this.providerConfig.maxAttempts
    });

    logger.info(`Cancellation notification created: ${notification.id}`);
    return { notification, data };
  }

  /**
   * Criar notificação de admin para nova marcação
   */
  async createAdminNotification(appointment) {
    const settings = await this._getSettings();
    const adminEmail = settings?.admin_notification_email || settings?.business_email;

    if (!adminEmail) {
      logger.info('No admin notification email configured');
      return { skipped: true, reason: 'no_admin_email' };
    }

    const idempotencyKey = `admin_notification_${appointment.id}`;
    const existing = await NotificationLog.findByIdempotencyKey(idempotencyKey);
    if (existing) {
      return { skipped: true, reason: 'already_exists', id: existing.id };
    }

    const templates = this.emailProvider.getTemplates();
    const data = {
      businessName: settings?.business_name || 'NailBook',
      customerName: appointment.customer_name,
      serviceName: appointment.service?.name || 'Serviço',
      date: this._formatDate(appointment.start_at),
      time: this._formatTime(appointment.start_at),
      duration: appointment.duration_snapshot_minutes,
      customerPhone: appointment.customer_phone,
      manageUrl: `${getBaseUrl(settings)}/admin/appointments`,
      businessPhone: settings?.business_phone || ''
    };

    const notification = await NotificationLog.create({
      appointmentId: appointment.id,
      type: 'admin_booking',
      notificationType: 'admin_notification',
      channel: 'email',
      recipient: adminEmail,
      subject: templates.adminNotification(data).subject,
      body: templates.adminNotification(data).html,
      idempotencyKey,
      scheduledFor: new Date().toISOString(),
      maxAttempts: this.providerConfig.maxAttempts
    });

    logger.info(`Admin notification created: ${notification.id}`);
    return { notification, data };
  }

  /**
   * Criar lembretes para uma marcação
   */
  async createReminders(appointment) {
    const settings = await this._getSettings();
    const email = appointment.customer_email;

    if (!email) {
      logger.info(`No email for appointment ${appointment.id}, skipping reminders`);
      return { skipped: true, reason: 'no_email' };
    }

    const reminders = await NotificationLog.recalculateReminders(appointment.id, appointment.start_at);

    // Atualizar o email do destinatário nos lembretes
    for (const reminder of reminders) {
      await poolQuery(
        'UPDATE notification_logs SET recipient = $1 WHERE id = $2',
        [email, reminder.id]
      );
    }

    const templates = this.emailProvider.getTemplates();
    return { reminders, count: reminders.length };
  }

  /**
   * Processar notificações pendentes (chamado pelo job/cron)
   */
  async processPending() {
    const pending = await NotificationLog.findPending(50);
    const results = { processed: 0, sent: 0, failed: 0, skipped: 0 };

    for (const notification of pending) {
      try {
        // Marcar como processing (SKIP LOCKED garante que outro job não pega o mesmo)
        const updating = await NotificationLog.markProcessing(notification.id);
        if (!updating) continue; // Já está sendo processado por outro worker

        const result = await this._sendNotification(notification);

        if (result.success) {
          await NotificationLog.markSent(notification.id, result.providerMessageId);
          results.sent++;
          logger.info(`Notification ${notification.id} sent successfully`);
        } else {
          await NotificationLog.markFailed(notification.id, result.error);
          results.failed++;
          logger.warn(`Notification ${notification.id} failed: ${result.error}`);
        }

        results.processed++;
      } catch (err) {
        results.skipped++;
        logger.error(`Error processing notification: ${err.message}`);
      }
    }

    return results;
  }

  /**
   * Enviar uma notificação específica
   */
  async _sendNotification(notification) {
    if (this.providerConfig.provider === 'none') {
      return { success: true, idempotent: true, skipped: true };
    }

    try {
      const templates = this.emailProvider.getTemplates();
      const data = this._buildNotificationData(notification);

      let result;
      switch (notification.type) {
        case 'booking_confirmed':
          result = await this.emailProvider.sendBookingConfirmation(data);
          break;
        case 'booking_cancelled':
          result = await this.emailProvider.sendBookingCancellation(data);
          break;
        case 'reminder_24h':
          result = await this.emailProvider.sendReminder({ ...data, template: 'reminder24h' });
          break;
        case 'reminder_2h':
          result = await this.emailProvider.sendReminder({ ...data, template: 'reminder2h' });
          break;
        case 'admin_booking':
          result = await this.emailProvider.sendAdminNotification(data);
          break;
        default:
          return { success: false, error: `Unknown notification type: ${notification.type}` };
      }

      return result;
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  /**
   * Verificar e processar lembretes expirados
   */
  async checkAndScheduleReminders(appointment) {
    const settings = await this._getSettings();
    
    if (!settings) return { skipped: true, reason: 'no_settings' };

    const email = appointment.customer_email;
    if (!email) return { skipped: true, reason: 'no_email' };

    const reminders = await this.createReminders(appointment);
    return reminders;
  }

  /**
   * Recalcular lembretes quando a marcação é alterada
   */
  async rescheduleReminders(appointment) {
    const reminders = await NotificationLog.recalculateReminders(appointment.id, appointment.start_at);
    logger.info(`Recalculated reminders for appointment ${appointment.id}`);
    return reminders;
  }

  /**
   * Obter estatísticas de notificações
   */
  async getStats() {
    return NotificationLog.getStats();
  }

  /**
   * Obter notificações por marcação
   */
  async getByAppointment(appointmentId) {
    return NotificationLog.findByAppointment(appointmentId);
  }

  /**
   * Contar notificações pendentes
   */
  async pendingCount() {
    return NotificationLog.countPending();
  }

  // ---- Helpers ----

  async _getSettings() {
    return Setting.find();
  }

  _buildNotificationData(notification) {
    return {
      businessName: notification.appointment?.service?.name || '',
      customerName: notification.appointment?.customer_name || '',
      serviceName: notification.appointment?.service?.name || '',
      date: this._formatDate(notification.appointment?.start_at),
      time: this._formatTime(notification.appointment?.start_at),
      duration: notification.appointment?.duration_snapshot_minutes,
      price: notification.appointment?.price,
      customerPhone: notification.appointment?.customer_phone,
      location: '',
      businessPhone: '',
      manageUrl: '',
      calendarUrl: ''
    };
  }

  _formatDate(isoString) {
    if (!isoString) return '—';
    const d = new Date(isoString);
    return d.toLocaleDateString('pt-PT', { day: '2-digit', month: 'long', year: 'numeric' });
  }

  _formatTime(isoString) {
    if (!isoString) return '—';
    const d = new Date(isoString);
    return d.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit', hour12: false });
  }
}

// Helper para queries no serviço
async function poolQuery(text, params) {
  const { pool } = await import('../config/database.js');
  const result = await pool.query(text, params);
  return result;
}

export const notificationService = new NotificationService();
export { NotificationService };
