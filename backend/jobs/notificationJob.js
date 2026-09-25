/**
 * NAILBOOK — Job de Notificações
 * Processa notificações pendentes em lote
 * 
 * Executado por cron job ou background worker.
 * Usa SKIP LOCKED para concorrência segura.
 * 
 * Nunca usa setTimeout/setInterval como solução de produção.
 */

import { NotificationLog } from '../models/notificationLog.js';
import { notificationService } from '../services/notificationService.js';
import { Setting } from '../models/index.js';
import { logger } from '../utils/logger.js';

/**
 * Processar notificações pendentes
 * Chamado pelo cron job a cada minuto
 */
export async function processPendingNotifications() {
  logger.info('Starting notification processing job...');

  try {
    const settings = await Setting.find();
    if (!settings) {
      logger.warn('No settings found, skipping notification job');
      return;
    }

    // Verificar se as notificações por email estão habilitadas
    if (!settings.email_notifications_enabled) {
      logger.info('Email notifications are disabled, skipping');
      return;
    }

    // Processar notificações pendentes
    const results = await notificationService.processPending();

    logger.info(`Notification job completed: ${results.processed} processed, ${results.sent} sent, ${results.failed} failed, ${results.skipped} skipped`);

    return results;
  } catch (err) {
    logger.error(`Notification job error: ${err.message}`);
    throw err;
  }
}

/**
 * Verificar e criar lembretes para marcações futuras
 * Chamado pelo cron job a cada hora
 */
export async function checkAndScheduleReminders() {
  logger.info('Checking for reminders to schedule...');

  try {
    const settings = await Setting.find();
    if (!settings || !settings.reminder_24h_enabled) {
      logger.info('Reminders are disabled');
      return;
    }

    // Obter marcações futuras que ainda não têm lembretes
    const appointments = await getAppointmentsNeedingReminders();

    for (const appointment of appointments) {
      try {
        const result = await notificationService.createReminders(appointment);
        if (!result.skipped) {
          logger.info(`Reminders scheduled for appointment ${appointment.id}: ${result.reminders.length} reminders`);
        }
      } catch (err) {
        logger.error(`Error scheduling reminders for appointment ${appointment.id}: ${err.message}`);
      }
    }

    logger.info(`Reminder check completed for ${appointments.length} appointments`);
  } catch (err) {
    logger.error(`Reminder check job error: ${err.message}`);
    throw err;
  }
}

/**
 * Obter marcações que precisam de lembretes
 */
async function getAppointmentsNeedingReminders() {
  const pool = (await import('../config/database.js')).pool;

  // Obter marcações confirmed dos próximos 48h sem lembretes criados
  const result = await pool.query(`
    SELECT a.* FROM appointments a
    LEFT JOIN notification_logs nl ON a.id = nl.appointment_id 
      AND nl.type IN ('reminder_24h', 'reminder_2h')
      AND nl.status IN ('pending', 'processing')
    WHERE a.status = 'confirmed'
      AND a.start_at BETWEEN NOW() AND NOW() + INTERVAL '48 hours'
      AND nl.id IS NULL
    ORDER BY a.start_at ASC
  `);

  return result.rows;
}

/**
 * Main entry point para o job (chamado por node ou cron)
 */
export async function runNotificationJob() {
  try {
    await processPendingNotifications();
    await checkAndScheduleReminders();
    logger.info('Notification job completed successfully');
  } catch (err) {
    logger.error(`Notification job failed: ${err.message}`);
    process.exit(1);
  }
}

// Executar se chamado diretamente (não como import)
const isMainModule = process.argv[1]?.includes('notificationJob');
if (isMainModule) {
  runNotificationJob();
}
