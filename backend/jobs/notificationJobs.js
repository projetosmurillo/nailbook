/**
 * NAILBOOK — Jobs de Notificação
 * Preparação para processamento assíncrono de emails/WhatsApp
 * 
 * Em produção: usar BullMQ, Redis, ou similar
 * Em desenvolvimento: processamento síncrono com fallback
 */

import { logger } from '../utils/logger.js';
import { notificationRepository } from '../repositories/notificationRepository.js';
import { emailService } from '../services/emailService.js';

class NotificationJob {
  constructor() {
    this.isProcessing = false;
  }

  /**
   * Processar job de criação de marcação
   */
  async bookingCreated(appointmentId) {
    try {
      const appointment = await this.getAppointment(appointmentId);
      if (!appointment) return;

      await notificationRepository.queue({
        appointmentId,
        type: 'booking_created',
        channel: 'email',
        recipient: appointment.customer_email,
        subject: 'Confirmação de Marcação - NailBook',
        body: this.buildBookingConfirmation(appointment),
        provider: process.env.EMAIL_PROVIDER || 'none'
      });

      logger.info(`Booking created notification queued for appointment ${appointmentId}`);
    } catch (err) {
      logger.error('Booking created job error:', err.message);
    }
  }

  /**
   * Processar job de cancelamento
   */
  async bookingCancelled(appointmentId) {
    try {
      const appointment = await this.getAppointment(appointmentId);
      if (!appointment) return;

      await notificationRepository.queue({
        appointmentId,
        type: 'booking_cancelled',
        channel: 'email',
        recipient: appointment.customer_email,
        subject: 'Marcação Cancelada - NailBook',
        body: this.buildCancellationConfirmation(appointment),
        provider: process.env.EMAIL_PROVIDER || 'none'
      });

      logger.info(`Booking cancelled notification queued for appointment ${appointmentId}`);
    } catch (err) {
      logger.error('Booking cancelled job error:', err.message);
    }
  }

  /**
   * Processar lembrete 24h
   */
  async reminder24h(appointmentId) {
    try {
      const appointment = await this.getAppointment(appointmentId);
      if (!appointment || appointment.status !== 'confirmed') return;

      await notificationRepository.queue({
        appointmentId,
        type: 'reminder_24h',
        channel: 'email',
        recipient: appointment.customer_email,
        subject: 'Lembrete: Marcação amanhã - NailBook',
        body: this.buildReminder(appointment, '24 horas'),
        provider: process.env.EMAIL_PROVIDER || 'none'
      });
    } catch (err) {
      logger.error('Reminder 24h job error:', err.message);
    }
  }

  /**
   * Processar lembrete 2h
   */
  async reminder2h(appointmentId) {
    try {
      const appointment = await this.getAppointment(appointmentId);
      if (!appointment || appointment.status !== 'confirmed') return;

      await notificationRepository.queue({
        appointmentId,
        type: 'reminder_2h',
        channel: 'email',
        recipient: appointment.customer_email,
        subject: 'Lembrete: Marcação em 2 horas - NailBook',
        body: this.buildReminder(appointment, '2 horas'),
        provider: process.env.EMAIL_PROVIDER || 'none'
      });
    } catch (err) {
      logger.error('Reminder 2h job error:', err.message);
    }
  }

  /**
   * Obter marcação (placeholder — implementar com modelo)
   */
  async getAppointment(id) {
    // Placeholder — o modelo Appointment será usado aqui
    // Por agora, retorna null (o emailService lida com isso)
    return null;
  }

  /**
   * Construir corpo do email de confirmação
   */
  buildBookingConfirmation(appointment) {
    return `Olá ${appointment.customer_name}!

A sua marcação foi confirmada!

Serviço: ${appointment.service_name}
Data: ${this.formatDate(appointment.start_at)}
Hora: ${this.formatTime(appointment.start_at)}
Duração: ${appointment.duration_snapshot_minutes} minutos
Preço: €${Number(appointment.price).toFixed(2)}

Obrigado por escolher o NailBook!`;
  }

  /**
   * Construir corpo do email de cancelamento
   */
  buildCancellationConfirmation(appointment) {
    return `Olá ${appointment.customer_name}!

A sua marcação foi cancelada.

Serviço: ${appointment.service_name}
Data: ${this.formatDate(appointment.start_at)}
Hora: ${this.formatTime(appointment.start_at)}

Se precisar de remarcar, visite o nosso site.`;
  }

  /**
   * Construir corpo do lembrete
   */
  buildReminder(appointment, timeframe) {
    return `Olá ${appointment.customer_name}!

Este é um lembrete da sua marcação daqui a ${timeframe}.

Serviço: ${appointment.service_name}
Data: ${this.formatDate(appointment.start_at)}
Hora: ${this.formatTime(appointment.start_at)}

Obrigado por escolher o NailBook!`;
  }

  /**
   * Formatar data
   */
  formatDate(isoString) {
    return new Date(isoString).toLocaleDateString('pt-PT');
  }

  /**
   * Formatar hora
   */
  formatTime(isoString) {
    return new Date(isoString).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit', hour12: false });
  }
}

export const notificationJob = new NotificationJob();
