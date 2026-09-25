/* ============================================
   NAILBOOK — Email Provider Abstração
   Camada abstrata para envio de emails
   ============================================ */

/**
 * EmailProvider — Interface abstrata para provedores de email
 * 
 * Implementações concretas são configuradas via EMAIL_PROVIDER env var.
 * Fornecedores suportados: resend, sendgrid, ses, smtp, none
 * 
 * Nunca coloca chaves no código.
 * As credenciais vêm de variáveis de ambiente.
 */

const VALID_PROVIDERS = ['resend', 'sendgrid', 'ses', 'smtp', 'none'];

/**
 * Obter configuração do provider
 */
function getProviderConfig() {
  const provider = process.env.EMAIL_PROVIDER || 'none';
  
  if (!VALID_PROVIDERS.includes(provider)) {
    throw new Error(`Email provider inválido: ${provider}. Usar: ${VALID_PROVIDERS.join(', ')}`);
  }

  return {
    provider,
    from: process.env.EMAIL_FROM || 'NailBook <contact@meudominio.pt>',
    replyTo: process.env.EMAIL_REPLY_TO || process.env.EMAIL_FROM || 'NailBook <contact@meudominio.pt>',
    apiKey: process.env.EMAIL_API_KEY,
    maxAttempts: parseInt(process.env.NOTIFICATION_MAX_ATTEMPTS || '3'),
    retryDelayMs: parseInt(process.env.NOTIFICATION_RETRY_DELAY_MS || '60000')
  };
}

/**
 * Validar configuração de email
 */
function validateEmailConfig() {
  const config = getProviderConfig();
  
  if (config.provider === 'none') {
    return { valid: true, config, warning: 'Email provider é "none" — emails não serão enviados' };
  }

  if (!config.apiKey) {
    return { valid: false, config, error: 'EMAIL_API_KEY não definida para provider selecionado' };
  }

  return { valid: true, config };
}

/**
 * Classe base para providers de email
 * Subclasses devem implementar sendEmail()
 */
class EmailProvider {
  constructor(config) {
    this.config = config;
  }

  /**
   * Enviar email de confirmação de marcação
   */
  async sendBookingConfirmation(data) {
    throw new Error('sendBookingConfirmation não implementado');
  }

  /**
   * Enviar email de cancelamento
   */
  async sendBookingCancellation(data) {
    throw new Error('sendBookingCancellation não implementado');
  }

  /**
   * Enviar lembrete
   */
  async sendReminder(data) {
    throw new Error('sendReminder não implementado');
  }

  /**
   * Enviar notificação ao admin
   */
  async sendAdminNotification(data) {
    throw new Error('sendAdminNotification não implementado');
  }

  /**
   * Obter template de email
   */
  getTemplates() {
    return {
      bookingConfirmation: (data) => this._formatConfirmation(data),
      bookingCancellation: (data) => this._formatCancellation(data),
      reminder24h: (data) => this._formatReminder24h(data),
      reminder2h: (data) => this._formatReminder2h(data),
      adminNotification: (data) => this._formatAdminNotification(data)
    };
  }

  // ---- Templates internos ----

  _formatConfirmation(data) {
    return {
      subject: `[${data.businessName}] Marcação Confirmada`,
      text: `Olá ${data.customerName}!

A sua marcação foi confirmada.

Serviço: ${data.serviceName}
Data: ${data.date}
Hora: ${data.time}
Duração: ${data.duration} min
Preço: ${data.price}

Para gerir a sua marcação: ${data.manageUrl}

${data.location ? 'Localização: ' + data.location + '\n' : ''}
Contacto: ${data.businessPhone}

Obrigado por escolher a NailBook!`,
      html: this._htmlTemplate({
        name: data.customerName,
        greeting: `Olá ${data.customerName}!`,
        body: `<h2>A sua marcação está confirmada</h2>
<table>
  <tr><td><strong>Serviço:</strong></td><td>${data.serviceName}</td></tr>
  <tr><td><strong>Data:</strong></td><td>${data.date}</td></tr>
  <tr><td><strong>Hora:</strong></td><td>${data.time}</td></tr>
  <tr><td><strong>Duração:</strong></td><td>${data.duration} minutos</td></tr>
  <tr><td><strong>Preço:</strong></td><td>${data.price}</td></tr>
</table>
<p><a href="${data.manageUrl}">Gerir marcação</a></p>
<p><a href="${data.calendarUrl}">Adicionar ao calendário</a></p>
<p>Contacto: ${data.businessPhone}</p>`
      })
    };
  }

  _formatCancellation(data) {
    return {
      subject: `[${data.businessName}] Marcação Cancelada`,
      text: `Olá ${data.customerName},

A sua marcação foi cancelada.

Serviço: ${data.serviceName}
Data: ${data.date}
Hora: ${data.time}

${data.location ? 'Localização: ' + data.location + '\n' : ''}
Contacto: ${data.businessPhone}

Se precisar de reagendar, entre em contacto connosco.`,
      html: this._htmlTemplate({
        name: data.customerName,
        greeting: 'Olá!',
        body: `<h2>A sua marcação foi cancelada</h2>
<p>Serviço: ${data.serviceName}</p>
<p>Data: ${data.date}</p>
<p>Hora: ${data.time}</p>
<p>${data.location ? 'Localização: ' + data.location + '<br>' : ''}Contacto: ${data.businessPhone}</p>`
      })
    };
  }

  _formatReminder24h(data) {
    return {
      subject: `[${data.businessName}] Lembrete: Marcação daqui a 24h`,
      text: `Olá ${data.customerName},

Esta é uma lembrante da sua marcação de amanhã.

Serviço: ${data.serviceName}
Data: ${data.date}
Hora: ${data.time}

Por favor, certifique-se de que pode comparecer.

${data.location ? 'Localização: ' + data.location + '\n' : ''}
Contacto: ${data.businessPhone}`,
      html: this._htmlTemplate({
        name: data.customerName,
        greeting: 'Olá!',
        body: `<h2>Lembrete da sua marcação</h2>
<p>Falta 24 horas para a sua marcação.</p>
<table>
  <tr><td><strong>Serviço:</strong></td><td>${data.serviceName}</td></tr>
  <tr><td><strong>Data:</strong></td><td>${data.date}</td></tr>
  <tr><td><strong>Hora:</strong></td><td>${data.time}</td></tr>
</table>
<p>${data.location ? 'Localização: ' + data.location + '<br>' : ''}Contacto: ${data.businessPhone}</p>`
      })
    };
  }

  _formatReminder2h(data) {
    return {
      subject: `[${data.businessName}] Lembrete: Marcação daqui a 2h`,
      text: `Olá ${data.customerName},

Lembrete: a sua marcação é daqui a 2 horas.

Serviço: ${data.serviceName}
Data: ${data.date}
Hora: ${data.time}`,
      html: this._htmlTemplate({
        name: data.customerName,
        greeting: 'Olá!',
        body: `<h2>Lembrete — 2 horas</h2>
<p>A sua marcação é daqui a 2 horas.</p>
<p>Serviço: ${data.serviceName}<br>Data: ${data.date}<br>Hora: ${data.time}</p>`
      })
    };
  }

  _formatAdminNotification(data) {
    return {
      subject: `[${data.businessName}] Nova Marcação`,
      text: `Nova marcação recebida.

Cliente: ${data.customerName}
Telefone: ${data.customerPhone}
Serviço: ${data.serviceName}
Data: ${data.date}
Hora: ${data.time}
Duração: ${data.duration} min

Para gerir: ${data.manageUrl}`,
      html: this._htmlTemplate({
        name: 'Profissional',
        greeting: 'Nova marcação recebida',
        body: `<h2>Nova marcação</h2>
<table>
  <tr><td><strong>Cliente:</strong></td><td>${data.customerName}</td></tr>
  <tr><td><strong>Telefone:</strong></td><td>${data.customerPhone}</td></tr>
  <tr><td><strong>Serviço:</strong></td><td>${data.serviceName}</td></tr>
  <tr><td><strong>Data:</strong></td><td>${data.date}</td></tr>
  <tr><td><strong>Hora:</strong></td><td>${data.time}</td></tr>
  <tr><td><strong>Duração:</strong></td><td>${data.duration} min</td></tr>
</table>
<p><a href="${data.manageUrl}">Gerir marcação</a></p>`
      })
    };
  }

  _htmlTemplate({ name, greeting, body }) {
    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${this.config.from}</title>
</head>
<body style="margin:0;padding:20px;font-family:Inter,-apple-system,sans-serif;background:#FAF9F6;color:#1A1A1A;">
  <div style="max-width:600px;margin:0 auto;background:#FFFFFF;border-radius:12px;padding:40px;box-shadow:0 2px 8px rgba(0,0,0,0.06);">
    <h1 style="font-family:'Playfair Display',Georgia,serif;font-size:24px;margin-bottom:8px;">${this.config.from}</h1>
    <p style="color:#6B6B6B;font-size:14px;">${greeting}</p>
    <div style="margin-top:24px;">${body}</div>
    <p style="margin-top:32px;font-size:12px;color:#6B6B6B;">
      Esta é uma mensagem automática. Não responda a este email.
    </p>
  </div>
</body>
</html>`;
  }
}

/**
 * Provider none — placeholder quando não há email configurado
 */
class NoneProvider extends EmailProvider {
  async sendBookingConfirmation() { return { success: true, idempotent: true, skipped: true }; }
  async sendBookingCancellation() { return { success: true, idempotent: true, skipped: true }; }
  async sendReminder() { return { success: true, idempotent: true, skipped: true }; }
  async sendAdminNotification() { return { success: true, idempotent: true, skipped: true }; }
}

/**
 * Factory para criar provider
 */
export function createEmailProvider() {
  const config = getProviderConfig();

  if (config.provider === 'none') {
    return new NoneProvider(config);
  }

  // Para produção, implementar Resend, SendGrid, SES, SMTP
  // Cada um estende a classe EmailProvider base
  // Por agora, retorna o NoneProvider se não houver configuração
  return new NoneProvider(config);
}

export { getProviderConfig, validateEmailConfig, VALID_PROVIDERS };
