/**
 * NAILBOOK — Serviço de Email (Preparação)
 * Configuração para Resend ou outro provedor
 * Se não houver credenciais, emails são preparados mas não enviados
 */

import { NotificationLog } from '../models/index.js';
import { logger } from '../utils/logger.js';

const EMAIL_PROVIDER = process.env.EMAIL_PROVIDER || 'none';
const EMAIL_API_KEY = process.env.EMAIL_API_KEY;
const EMAIL_FROM = process.env.EMAIL_FROM || 'noemail@nailbook.com';

class EmailService {
  constructor() {
    this.enabled = EMAIL_PROVIDER !== 'none' && !!EMAIL_API_KEY;
    this.provider = EMAIL_PROVIDER;
  }

  /**
   * Enfileirar notificação para envio
   * Se o email estiver desativado, apenas cria o log como 'pending'
   */
  async queueNotification({ appointmentId, type, channel, recipient, subject, body, provider }) {
    const finalChannel = channel || 'email';

    if (!this.enabled) {
      // Criar log indicando que email está desativado
      await NotificationLog.create({
        appointmentId,
        type,
        channel: finalChannel,
        status: 'pending',
        recipient: recipient || null,
        subject: subject || '',
        body: body || '',
        provider: 'none',
        errorMessage: 'Email provider not configured'
      });
      return;
    }

    try {
      await NotificationLog.create({
        appointmentId,
        type,
        channel: finalChannel,
        status: 'pending',
        recipient,
        subject,
        body,
        provider: this.provider
      });

      // Se Resend, usar API aqui
      if (this.provider === 'resend') {
        await this.sendResend({ recipient, subject, body });
      }
    } catch (err) {
      logger.error('Email queuing failed:', err.message);
      // Não falhar a marcação se email falhar
      await NotificationLog.create({
        appointmentId,
        type,
        channel: finalChannel,
        status: 'failed',
        recipient,
        subject,
        body,
        provider: this.provider,
        errorMessage: err.message
      });
    }
  }

  /**
   * Enviar email via Resend
   */
  async sendResend({ recipient, subject, body }) {
    if (!EMAIL_API_KEY) {
      throw new Error('Resend API key not configured');
    }

    // Preparação para integração Resend
    // Quando as credenciais estiverem disponíveis:
    /*
    const resend = new Resend(EMAIL_API_KEY);
    const response = await resend.emails.send({
      from: EMAIL_FROM,
      to: recipient,
      subject,
      html: body
    });
    return response;
    */

    // Placeholder - implementação real quando credenciais disponíveis
    logger.info(`Email would be sent via Resend to ${recipient}: ${subject}`);
    return { success: true };
  }
}

export const emailService = new EmailService();
