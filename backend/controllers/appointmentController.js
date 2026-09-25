/**
 * NAILBOOK — Controlador de Marcações
 * Inclui lógica de criação, consulta e cancelamento.
 * Nova V1: Marcações são confirmadas automaticamente (sem estado pending).
 * Preço e duração são snapshot no momento da reserva.
 * Fase 4: Usa availabilityService para validação centralizada.
 */

import { v4 as uuid } from 'uuid';
import { pool } from '../config/database.js';
import { Appointment } from '../models/index.js';
import { Customer } from '../models/index.js';
import { BookingToken } from '../models/index.js';
import { NotificationLog } from '../models/index.js';
import { Service } from '../models/index.js';
import { doubleBookingService } from '../services/doubleBookingService.js';
import { availabilityService } from '../services/availabilityService.js';
import { emailService } from '../services/emailService.js';
import { notificationService } from '../services/notificationService.js';
import { localToUtc } from '../utils/timezone.js';
import { logger } from '../utils/logger.js';

/**
 * Criar nova marcação
 * Fluxo:
 * 1. Validar dados com availabilityService
 * 2. Verificar disponibilidade real
 * 3. Transação: verificar conflitos + criar marcação + gerar token
 * Estado inicial: 'confirmed' (marcação confirmada automaticamente)
 */
async function create(req, res, next) {
  try {
    const { service_id, date, time, customer_name, customer_phone, customer_email, notes } = req.body;

    // 1. Validar serviço
    const service = await Service.findById(service_id);
    if (!service) {
      return res.status(404).json({ error: 'Serviço não encontrado' });
    }

    if (!service.active) {
      return res.status(400).json({ error: 'Serviço não está ativo' });
    }

    // 2. Validar a tentativa de reserva usando availabilityService
    const validation = await availabilityService.validateBookingAttempt({
      date,
      serviceId: service.id,
      time
    });

    if (!validation.valid) {
      return res.status(409).json({
        error: 'Horário não disponível',
        details: validation.errors
      });
    }

    // 3. Converter horário local de Lisboa para UTC usando localToUtc
    const startsAt = localToUtc(date, time);
    const endsAt = new Date(startsAt.getTime() + service.duration_minutes * 60000);

    // 4. Verificar disponibilidade ANTES da transação (UX rápida)
    const conflict = await doubleBookingService.checkConflict(
      service.id, startsAt, endsAt
    );
    if (conflict) {
      return res.status(409).json({
        error: 'Este horário não está disponível. Por favor, escolha outro.',
        conflict: true
      });
    }

    // 5. Criar cliente (ou encontrar existente pelo telefone)
    const customer = await Customer.findOrCreate({
      name: customer_name,
      phone: customer_phone,
      email: customer_email || null,
      notes: notes || null
    });

    // 6. TRANSACAO: Verificar conflitos novamente + Criar marcação
    const client = await pool.connect();
    try {
      await client.query('BEGIN ISOLATION LEVEL SERIALIZABLE');

      // Verificar conflitos na transação (redundante mas seguro)
      const conflicts = await Appointment.findConflicts(
        service.id, startsAt.toISOString(), service.duration_minutes
      );

      if (conflicts.length > 0) {
        await client.query('ROLLBACK');
        return res.status(409).json({
          error: 'Este horário foi recentemente reservado por outra pessoa. Por favor, escolha outro.',
          conflict: true
        });
      }

      // Criar marcação (estado = confirmed automaticamente)
      const appointment = await Appointment.create({
        customerId: customer.id,
        serviceId: service.id,
        startAt: startsAt,
        endAt: endsAt,
        price: service.price,
        durationSnapshotMinutes: service.duration_minutes,
        customerNotes: notes || null
      });

      // Gerar token de booking para a cliente
      const token = await BookingToken.create(appointment.id);

      await client.query('COMMIT');

      // 7. Obter dados completos da marcação para notificações e resposta
      const appointmentData = await Appointment.findById(appointment.id);

      // 7. Log de notificação legacy (async, não bloqueia)
      emailService.queueNotification({
        appointmentId: appointment.id,
        type: 'booking_created',
        channel: 'email',
        recipient: customer_email || null,
        subject: 'Confirmação de Marcação - NailBook',
        provider: process.env.EMAIL_PROVIDER || 'none'
      }).catch(err => logger.error('Email queue error:', err.message));

      // 8. NOTIFICAÇÕES (fire-and-forget, não bloqueiam a resposta)
      notificationService.createBookingConfirmation(appointmentData).then(result => {
        logger.info(`Booking confirmation notification: ${result.skipped ? 'skipped' : 'created'}`);
      }).catch(err => {
        logger.error(`Notification error (non-blocking): ${err.message}`);
      });

      notificationService.createAdminNotification(appointmentData).then(result => {
        logger.info(`Admin notification: ${result.skipped ? 'skipped' : 'created'}`);
      }).catch(err => {
        logger.error(`Admin notification error (non-blocking): ${err.message}`);
      });

      // 9. Resposta de sucesso
      res.status(201).json({
        success: true,
        data: {
          ...appointmentData,
          token  // Enviar token à cliente para consulta/cancelamento
        }
      });

    } catch (dbErr) {
      await client.query('ROLLBACK');

      // Erro de serialização = double booking detectado pelo DB
      if (dbErr.code === '40001') {
        logger.warn('Serialization error - possible double booking', { error: dbErr.message });
        return res.status(409).json({
          error: 'Este horário acabou de ser reservado. Por favor, escolha outro.',
          conflict: true
        });
      }

      throw dbErr;
    } finally {
      client.release();
    }
  } catch (err) {
    next(err);
  }
}

/**
 * Consultar marcação por token (público)
 * O token é validado comparando com o hash bcrypt armazenado.
 */
async function getByToken(req, res, next) {
  try {
    const { token } = req.params;
    const appointment = await BookingToken.validate(token);

    if (!appointment) {
      return res.status(404).json({ error: 'Marcação não encontrada ou token inválido' });
    }

    // Retornar dados da marcação
    const appointmentData = await Appointment.findById(appointment.id);

    res.json({ success: true, data: appointmentData });
  } catch (err) {
    next(err);
  }
}

/**
 * Cancelar marcação por token (público)
 * A marcação já vem como 'confirmed'. Ao cancelar, muda para 'cancelled'.
 * Os tokens são invalidados automaticamente.
 */
async function cancelByToken(req, res, next) {
  try {
    const { token } = req.params;

    // Validar token
    const appointment = await BookingToken.validate(token);
    if (!appointment) {
      return res.status(404).json({ error: 'Marcação não encontrada ou token inválido' });
    }

    // Só pode cancelar se estiver confirmed
    if (appointment.status !== 'confirmed') {
      return res.status(400).json({
        error: `Não é possível cancelar uma marcação com estado "${appointment.status}"`
      });
    }

    // Verificar prazo de cancelamento
    const settings = await pool.query('SELECT cancellation_deadline_hours FROM settings LIMIT 1');
    const deadlineHours = settings.rows[0]?.cancellation_deadline_hours || 24;
    const now = new Date();
    const timeUntilAppointment = new Date(appointment.start_at).getTime() - now.getTime();
    const hoursUntilAppointment = timeUntilAppointment / (1000 * 60 * 60);

    if (hoursUntilAppointment < deadlineHours) {
      return res.status(400).json({
        error: `Não é possível cancelar a menos de ${deadlineHours} horas da marcação`
      });
    }

    // Atualizar estado para cancelled
    const updated = await Appointment.updateState(appointment.id, 'cancelled');

    // Invalidar todos os tokens desta marcação
    await BookingToken.invalidateByAppointment(appointment.id);

    // NOTIFICAÇÃO DE CANCELAMENTO (fire-and-forget)
    notificationService.createBookingCancellation(appointment).then(result => {
      logger.info(`Cancellation notification: ${result.skipped ? 'skipped' : 'created'}`);
    }).catch(err => {
      logger.error(`Cancellation notification error (non-blocking): ${err.message}`);
    });

    res.json({
      success: true,
      data: { message: 'Marcação cancelada com sucesso', appointment: updated }
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Obter todas as marcações (admin)
 */
async function getAll(req, res, next) {
  try {
    const { date, status, page, limit } = req.query;
    const appointments = await Appointment.findAll({ date, status, page, limit });
    res.json({ success: true, data: appointments });
  } catch (err) {
    next(err);
  }
}

/**
 * Obter marcação por ID (admin)
 */
async function getById(req, res, next) {
  try {
    const { id } = req.params;
    const appointment = await Appointment.findById(id);
    if (!appointment) {
      return res.status(404).json({ error: 'Marcação não encontrada' });
    }
    res.json({ success: true, data: appointment });
  } catch (err) {
    next(err);
  }
}

export const appointmentController = {
  create,
  getByToken,
  cancelByToken,
  getAll,
  getById
};
