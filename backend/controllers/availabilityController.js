/**
 * NAILBOOK — Controlador de Disponibilidade
 *
 * FASE 4: Motor de Disponibilidade consolidado
 * Toda lógica de cálculo de slots passa por availabilityService.
 * Este controlador é apenas o adapter HTTP.
 */

import { availabilityService } from '../services/availabilityService.js';
import { logger } from '../utils/logger.js';

/**
 * GET /api/availability
 * Obter todos os slots disponíveis para uma data e serviço
 */
async function getAvailableSlots(req, res, next) {
  try {
    const { date, service_id: serviceId } = req.query;

    if (!date || !serviceId) {
      return res.status(400).json({
        error: { code: 'MISSING_PARAMS', message: 'date e service_id são obrigatórios' }
      });
    }

    const result = await availabilityService.getAvailableSlots({
      date,
      serviceId
    });

    res.json(result);
  } catch (err) {
    if (err.message === 'SERVICE_NOT_FOUND' || err.message === 'SERVICE_INACTIVE') {
      return res.status(404).json({
        error: { code: err.message, message: 'Serviço não encontrado ou inativo' }
      });
    }
    if (err.message === 'DATE_TOO_SOON') {
      return res.status(400).json({
        error: { code: 'DATE_TOO_SOON', message: 'A data selecionada está dentro do prazo de antecedência mínima' }
      });
    }
    if (err.message === 'DATE_TOO_FAR') {
      return res.status(400).json({
        error: { code: 'DATE_TOO_FAR', message: 'A data selecionada excede o limite máximo de marcação' }
      });
    }
    if (err.message === 'SETTINGS_NOT_FOUND') {
      return res.status(500).json({
        error: { code: 'SETTINGS_NOT_FOUND', message: 'Configurações do negócio não encontradas' }
      });
    }
    next(err);
  }
}

/**
 * GET /api/availability/check
 * Verificar se um horário específico está disponível
 */
async function checkSlot(req, res, next) {
  try {
    const { date, service_id: serviceId, time } = req.query;

    if (!date || !serviceId || !time) {
      return res.status(400).json({
        error: { code: 'MISSING_PARAMS', message: 'date, service_id e time são obrigatórios' }
      });
    }

    const result = await availabilityService.checkSlotAvailability({
      date,
      serviceId,
      time
    });

    res.json(result);
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/availability/validate
 * Validar uma tentativa de reserva (usado antes de criar a marcação)
 */
async function validateBooking(req, res, next) {
  try {
    const { date, service_id: serviceId, time } = req.body;

    if (!date || !serviceId || !time) {
      return res.status(400).json({
        error: { code: 'MISSING_PARAMS', message: 'date, service_id e time são obrigatórios' }
      });
    }

    const result = await availabilityService.validateBookingAttempt({
      date,
      serviceId,
      time
    });

    res.json(result);
  } catch (err) {
    next(err);
  }
}

export const availabilityController = {
  getAvailableSlots,
  checkSlot,
  validateBooking
};
