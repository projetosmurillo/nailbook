/**
 * NAILBOOK — Rotas Públicas
 * Estrutura: /api/*
 * Todas as rotas são montadas sob /api pelo server.js
 */

import { Router } from 'express';
import { validateAvailability, validateCreateAppointment, validateCheckSlot, validateBooking } from '../validators/bookingValidator.js';
import { availabilityController } from '../controllers/availabilityController.js';
import { appointmentController } from '../controllers/appointmentController.js';
import settingsController from '../controllers/settingsController.js';
import { generalLimiter, bookingLimiter } from '../middleware/rateLimiter.js';
import { generateICS, generateGoogleCalendarUrl, validateICS } from '../services/icsGenerator.js';
import { Setting } from '../models/index.js';
import { BookingToken } from '../models/index.js';
import { Appointment } from '../models/index.js';
import { logger } from '../utils/logger.js';

const router = Router();

// Health check
router.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Serviços públicos
router.get('/services', async (req, res, next) => {
  try {
    const services = await settingsController.getServices();
    res.json({ success: true, data: services });
  } catch (err) { next(err); }
});

// Settings
router.get('/settings', async (req, res, next) => {
  try {
    const settings = await settingsController.find();
    res.json({ success: true, data: settings });
  } catch (err) { next(err); }
});

// Disponibilidade - listar slots
router.get('/availability', generalLimiter, validateAvailability, availabilityController.getAvailableSlots);

// Disponibilidade - verificar slot específico
router.get('/availability/check', generalLimiter, validateCheckSlot, availabilityController.checkSlot);

// Disponibilidade - validar tentativa de reserva
router.post('/availability/validate', generalLimiter, validateBooking, availabilityController.validateBooking);

// Criar marcação
router.post('/appointments', bookingLimiter, validateCreateAppointment, appointmentController.create);

// Consultar marcação por token (público)
router.get('/appointments/:token', appointmentController.getByToken);

// Cancelar marcação por token (público)
router.post('/appointments/:token/cancel', appointmentController.cancelByToken);

// ICS Calendário (público, protegido por token)
router.get('/appointments/:token/calendar.ics', async (req, res, next) => {
  try {
    const { token } = req.params;
    
    // Validar token
    const booking = await BookingToken.validate(token);
    if (!booking) {
      return res.status(404).json({ error: 'Marcação não encontrada ou token inválido' });
    }

    const appointment = await Appointment.findById(booking.id);
    if (!appointment) {
      return res.status(404).json({ error: 'Marcação não encontrada' });
    }

    // Apenas se a marcação existe
    if (!appointment || appointment.status === 'cancelled') {
      return res.status(404).json({ error: 'Marcação não encontrada' });
    }

    // Obter configurações para o ICS
    const settings = await Setting.find();

    // Gerar ICS
    const ics = generateICS(appointment, settings);

    // Validar ICS
    const validation = validateICS(ics);
    if (!validation.valid) {
      logger.error(`ICS validation failed: ${validation.errors.join(', ')}`);
    }

    // Enviar como download
    res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="nailbook-${appointment.id}.ics"`);
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.send(ics);
  } catch (err) {
    next(err);
  }
});

// Google Calendar URL (público, protegido por token)
router.get('/appointments/:token/calendar', async (req, res, next) => {
  try {
    const { token } = req.params;
    
    const booking = await BookingToken.validate(token);
    if (!booking) {
      return res.status(404).json({ error: 'Marcação não encontrada ou token inválido' });
    }

    const appointment = await Appointment.findById(booking.id);
    if (!appointment || appointment.status === 'cancelled') {
      return res.status(404).json({ error: 'Marcação não encontrada' });
    }

    const settings = await Setting.find();
    const url = generateGoogleCalendarUrl(appointment, settings);

    res.json({ success: true, data: { url } });
  } catch (err) {
    next(err);
  }
});

// Google Calendar URL (público - para integração direta)
router.get('/appointments/:token/google-calendar', async (req, res, next) => {
  try {
    const { token } = req.params;
    
    const booking = await BookingToken.validate(token);
    if (!booking) {
      return res.status(404).json({ error: 'Marcação não encontrada ou token inválido' });
    }

    const appointment = await Appointment.findById(booking.id);
    if (!appointment || appointment.status === 'cancelled') {
      return res.status(404).json({ error: 'Marcação não encontrada' });
    }

    const settings = await Setting.find();
    const url = generateGoogleCalendarUrl(appointment, settings);

    // Redirecionar para Google Calendar
    res.redirect(url);
  } catch (err) {
    next(err);
  }
});

export { router };
