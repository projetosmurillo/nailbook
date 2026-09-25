/**
 * NAILBOOK — Serviço Central de Disponibilidade
 *
 * ESTA É A FONTE ÚNICA DE VERDADE PARA DISPONIBILIDADE.
 * Toda lógica de cálculo de slots passa por este serviço.
 *
 * O frontend nunca calcula disponibilidade.
 * O backend recalcula SEMPRE, mesmo para horários já apresentados.
 *
 * Considerações:
 * - Horários de funcionamento (business_hours)
 * - Pausas (breaks)
 * - Períodos bloqueados (blocked_periods)
 * - Marcações existentes (status = 'confirmed')
 * - Buffer entre marcações (buffer_minutes)
 * - Antecedência mínima (minimum_advance_hours)
 * - Limite máximo de marcação (maximum_booking_days)
 * - Duração do serviço (services.duration_minutes)
 * - Timezone Europe/Lisbon
 */

import { BusinessHour } from '../models/index.js';
import { Break } from '../models/index.js';
import { BlockedPeriod } from '../models/index.js';
import { Appointment } from '../models/index.js';
import { Service } from '../models/index.js';
import { Setting } from '../models/index.js';
import { localToUtc, utcToLocalTime, utcToLocalDate, getDayOfWeekLisbon, isValidDate } from '../utils/timezone.js';
import { logger } from '../utils/logger.js';

const LISBON_TIMEZONE = 'Europe/Lisbon';
const DEFAULT_SLOT_INTERVAL = 15; // minutos

/**
 * Obter todos os slots disponíveis para uma data e serviço
 *
 * @param {Object} params
 * @param {string} params.date - Data em formato YYYY-MM-DD (Lisbon time)
 * @param {string} params.serviceId - UUID do serviço
 * @param {string} [params.requestedTime] - Hora específica para validação (HH:MM)
 * @param {string} [params.customerId] - ID do cliente (para filtros futuros)
 * @returns {Object} Slots disponíveis
 */
async function getAvailableSlots({ date, serviceId, requestedTime = null, customerId = null }) {
  // 1. Validar parâmetros
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new Error('Data inválida. Formato esperado: YYYY-MM-DD');
  }

  if (!isValidDate(date)) {
    throw new Error('Data não existe');
  }

  // 2. Obter o serviço
  const service = await Service.findById(serviceId);
  if (!service) {
    throw new Error('SERVICE_NOT_FOUND');
  }

  if (!service.active) {
    throw new Error('SERVICE_INACTIVE');
  }

  // 3. Obter configurações
  const settings = await Setting.find();
  if (!settings) {
    throw new Error('SETTINGS_NOT_FOUND');
  }

  // 4. Validar regras de data
  validateDateRules(date, settings);

  // 5. Determinar o dia da semana em Lisbon time
  const dateObj = new Date(date + 'T00:00:00Z');
  const dayOfWeek = getDayOfWeekLisbon(dateObj);

  // 6. Obter horários de funcionamento
  const businessHours = await BusinessHour.findByDay(dayOfWeek);
  if (businessHours.length === 0) {
    return buildResponse(date, service, settings, [], [], [], [], []);
  }

  // 7. Obter pausas
  const breaks = await Break.findByDay(dayOfWeek);

  // 8. Obter períodos bloqueados
  const blockedPeriods = await BlockedPeriod.findOverlapping(date);

  // 9. Obter marcações existentes (status='confirmed')
  const existingAppointments = await Appointment.findConflicts(
    serviceId,
    localToUtc(date, '00:00').toISOString(),
    service.duration_minutes + (settings.buffer_minutes || 0)
  );

  // 10. Calcular slots disponíveis
  const availableSlots = calculateAvailableSlots({
    businessHours,
    breaks,
    blockedPeriods,
    existingAppointments,
    serviceDuration: service.duration_minutes,
    bufferMinutes: settings.buffer_minutes || 0,
    date,
    slotInterval: DEFAULT_SLOT_INTERVAL
  });

  // 11. Se requestedTime foi fornecido, validar
  let requestedSlot = null;
  if (requestedTime) {
    requestedSlot = availableSlots.find(s => s.start === requestedTime);
  }

  return buildResponse(date, service, settings, businessHours, breaks, blockedPeriods, existingAppointments, availableSlots, requestedSlot);
}

/**
 * Validar regras de data (antecedência mínima, limite máximo)
 */
function validateDateRules(date, settings) {
  const today = utcToLocalDate(new Date());

  // Antecedência mínima
  const minAdvanceHours = settings.minimum_advance_hours || 0;
  if (minAdvanceHours > 0) {
    const minDate = addHoursToDate(today, minAdvanceHours);
    if (date < minDate) {
      throw new Error('DATE_TOO_SOON');
    }
  }

  // Limite máximo de marcação
  const maxDays = settings.maximum_booking_days || 30;
  const maxDate = addDaysToDate(today, maxDays);
  if (date > maxDate) {
    throw new Error('DATE_TOO_FAR');
  }
}

/**
 * Adicionar horas a uma data (formato YYYY-MM-DD)
 */
function addHoursToDate(dateStr, hours) {
  const [year, month, day] = dateStr.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day, hours));
  return utcToLocalDate(date);
}

/**
 * Adicionar dias a uma data (formato YYYY-MM-DD)
 */
function addDaysToDate(dateStr, days) {
  const [year, month, day] = dateStr.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + days));
  return utcToLocalDate(date);
}

/**
 * Algoritmo principal de cálculo de slots disponíveis
 *
 * Regras:
 * - Cada slot deve ter o serviço COMPLETO caber no período de funcionamento
 * - Buffer entre marcações é aplicado
 * - Slots atravessando pausas são excluídos
 * - Slots em bloqueios são excluídos
 * - Slots em conflito com marcações existentes são excluídos
 * - Intervalos [start, end) são utilizados (inclui início, exclui fim)
 */
function calculateAvailableSlots({
  businessHours,
  breaks,
  blockedPeriods,
  existingAppointments,
  serviceDuration,
  bufferMinutes,
  date,
  slotInterval
}) {
  const slots = [];

  // Criar intervalos de pausa para verificação rápida
  const breakIntervals = breaks.map(b => ({
    start: parseTimeToMinutes(b.starts_at),
    end: parseTimeToMinutes(b.ends_at)
  }));

  // Criar intervalos de bloqueio
  const blockedIntervals = blockedPeriods.map(b => {
    // Para bloqueios de meio dia, precisamos da parte local do dia
    const blockedStart = b.starts_at instanceof Date ? b.starts_at : new Date(b.starts_at);
    const blockedEnd = b.ends_at instanceof Date ? b.ends_at : new Date(b.ends_at);
    return { start: blockedStart, end: blockedEnd };
  });

  // Criar intervalos de marcações existentes
  // Usa end_at real do banco de dados (snapshot da duração)
  const appointmentIntervals = existingAppointments.map(a => {
    const startMinutes = timeToMinutes(utcToLocalTime(a.start_at));
    const endMinutes = startMinutes + a.duration_snapshot_minutes;
    return { start: startMinutes, end: endMinutes };
  });

  // Para cada período de funcionamento
  for (const period of businessHours) {
    const periodStart = parseTimeToMinutes(period.opens_at);
    const periodEnd = parseTimeToMinutes(period.closes_at);

    // O slot deve terminar ANTES do fim do período (incluindo buffer)
    const effectivePeriodEnd = periodEnd - bufferMinutes;

    let current = periodStart;

    while (current + serviceDuration <= effectivePeriodEnd) {
      const slotEnd = current + serviceDuration;

      // Verificar se o slot está dentro de alguma pausa
      const inBreak = breakIntervals.some(b =>
        current < b.end && slotEnd > b.start
      );

      // Verificar se o slot está dentro de algum bloqueio
      const dateObj = new Date(date + 'T00:00:00Z');
      const slotStartUtc = localToUtc(date, minutesToTime(current));
      const slotEndUtc = localToUtc(date, minutesToTime(slotEnd));

      const inBlocked = blockedIntervals.some(b =>
        slotStartUtc < b.end && slotEndUtc > b.start
      );

      // Verificar se o slot tem conflito com marcação existente
      const hasConflict = appointmentIntervals.some(a =>
        current < a.end && slotEnd > a.start
      );

      // Adicionar buffer ao próximo slot (não ao atual)
      // O slot atual pode estar imediatamente após outro (buffer é para o próximo)

      if (!inBreak && !inBlocked && !hasConflict) {
        slots.push({
          start: minutesToTime(current),
          end: minutesToTime(slotEnd),
          startTimestamp: slotStartUtc.toISOString(),
          endTimestamp: slotEndUtc.toISOString()
        });
      }

      current += slotInterval;
    }
  }

  return slots;
}

/**
 * Construir resposta formatada
 */
function buildResponse(date, service, settings, businessHours, breaks, blockedPeriods, existingAppointments, availableSlots, requestedSlot = null) {
  const today = utcToLocalDate(new Date());
  const isToday = date === today;

  return {
    success: true,
    data: {
      date,
      is_today: isToday,
      is_available: availableSlots.length > 0,
      service: {
        id: service.id,
        name: service.name,
        duration_minutes: service.duration_minutes,
        price: service.price.toString()
      },
      timezone: LISBON_TIMEZONE,
      business_hours: businessHours.map(h => ({
        opens: h.opens_at,
        closes: h.closes_at
      })),
      breaks: breaks.map(b => ({
        starts: b.starts_at,
        ends: b.ends_at,
        description: b.description || null
      })),
      blocked_periods: blockedPeriods.map(b => ({
        starts_at: b.starts_at.toISOString(),
        ends_at: b.ends_at.toISOString(),
        reason: b.reason || null
      })),
      existing_appointments: existingAppointments.map(a => ({
        start_at: a.start_at,
        end_at: a.end_at,
        duration_minutes: a.duration_snapshot_minutes,
        price: a.price.toString()
      })),
      available_slots: availableSlots,
      rules: {
        buffer_minutes: settings.buffer_minutes || 0,
        minimum_advance_hours: settings.minimum_advance_hours || 0,
        maximum_booking_days: settings.maximum_booking_days || 30,
        cancellation_deadline_hours: settings.cancellation_deadline_hours || 24
      },
      ...(requestedSlot && { requested_slot: requestedSlot })
    }
  };
}

/**
 * Verificar se um horário específico está disponível
 *
 * @param {string} date - Data YYYY-MM-DD
 * @param {string} serviceId - UUID do serviço
 * @param {string} time - Hora HH:MM (Lisbon time)
 * @returns {Object} { available: boolean, reason?: string }
 */
async function checkSlotAvailability({ date, serviceId, time }) {
  const slots = await getAvailableSlots({ date, serviceId });

  if (!slots.success) {
    return { available: false, error: slots.error };
  }

  const slot = slots.data.available_slots.find(s => s.start === time);

  if (slot) {
    return { available: true, slot };
  }

  // Determinar razão do não disponível
  const dateObj = new Date(date + 'T00:00:00Z');
  const dayOfWeek = getDayOfWeekLisbon(dateObj);

  const businessHours = await BusinessHour.findByDay(dayOfWeek);
  if (businessHours.length === 0) {
    return { available: false, reason: 'DAY_CLOSED', slot: null };
  }

  // Verificar se é dentro de uma pausa
  const [hours, minutes] = time.split(':').map(Number);
  const timeMinutes = hours * 60 + minutes;
  const breaks = await Break.findByDay(dayOfWeek);

  const inBreak = breaks.some(b => {
    const breakStart = parseTimeToMinutes(b.starts_at);
    const breakEnd = parseTimeToMinutes(b.ends_at);
    return timeMinutes >= breakStart && timeMinutes < breakEnd;
  });

  if (inBreak) {
    return { available: false, reason: 'DURING_BREAK', slot: null };
  }

  // Verificar se é dentro de um bloqueio
  const blockedPeriods = await BlockedPeriod.findOverlapping(date);
  const inBlocked = blockedPeriods.some(b => {
    const slotStart = new Date(date + 'T' + time + ':00Z');
    return slotStart >= b.starts_at && slotStart < b.ends_at;
  });

  if (inBlocked) {
    return { available: false, reason: 'BLOCKED_PERIOD', slot: null };
  }

  // Verificar se há conflito com marcação existente
  const service = await Service.findById(serviceId);
  const conflicts = await Appointment.findConflicts(
    serviceId,
    localToUtc(date, time).toISOString(),
    service.duration_minutes
  );

  if (conflicts.length > 0) {
    return { available: false, reason: 'DOUBLE_BOOKING', slot: null };
  }

  return { available: false, reason: 'UNKNOWN', slot: null };
}

/**
 * Validar uma tentativa de reserva
 *
 * @param {Object} params
 * @param {string} params.date - Data YYYY-MM-DD
 * @param {string} params.serviceId - UUID do serviço
 * @param {string} params.time - Hora HH:MM (Lisbon time)
 * @returns {Object} { valid: boolean, errors: string[] }
 */
async function validateBookingAttempt({ date, serviceId, time }) {
  const errors = [];

  // 1. Validar data
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    errors.push('DATA_INVALID');
  }

  // 2. Validar hora
  if (!time || !/^\d{2}:\d{2}$/.test(time)) {
    errors.push('TIME_INVALID');
  }

  // 3. Obter serviço
  const service = await Service.findById(serviceId);
  if (!service) {
    errors.push('SERVICE_NOT_FOUND');
    return { valid: false, errors };
  }

  if (!service.active) {
    errors.push('SERVICE_INACTIVE');
    return { valid: false, errors };
  }

  // 4. Obter configurações
  const settings = await Setting.find();
  if (!settings) {
    errors.push('SETTINGS_NOT_FOUND');
    return { valid: false, errors };
  }

  // 5. Verificar antecedência mínima
  const minAdvanceMs = (settings.minimum_advance_hours || 0) * 60 * 60 * 1000;
  const now = new Date();
  const slotUtc = localToUtc(date, time);
  if (slotUtc.getTime() - now.getTime() < minAdvanceMs) {
    errors.push('TOO_SOON');
  }

  // 6. Verificar limite máximo
  const maxDays = settings.maximum_booking_days || 30;
  const today = utcToLocalDate(now);
  const maxDate = addDaysToDate(today, maxDays);
  if (date > maxDate) {
    errors.push('TOO_FAR');
  }

  // 7. Verificar disponibilidade do slot
  const availability = await checkSlotAvailability({ date, serviceId, time });
  if (!availability.available) {
    errors.push(availability.reason || 'SLOT_UNAVAILABLE');
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Formatar minutos para HH:MM
 */
function minutesToTime(minutes) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
}

/**
 * Parse de "HH:MM" para minutos
 */
function parseTimeToMinutes(timeStr) {
  const [hours, minutes] = timeStr.split(':').map(Number);
  return hours * 60 + minutes;
}

/**
 * Formatar tempo para minutos totais (para intervalos)
 */
function timeToMinutes(timeStr) {
  return parseTimeToMinutes(timeStr);
}

export const availabilityService = {
  getAvailableSlots,
  checkSlotAvailability,
  validateBookingAttempt,
  calculateAvailableSlots
};
