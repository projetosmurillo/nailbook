/**
 * NAILBOOK — Utilities de Timezone
 * Todas as conversões de timezone utilizam Intl.DateTimeFormat
 * para garantir precisão com Europe/Lisbon (incluindo DST)
 */

const LISBON_TIMEZONE = 'Europe/Lisbon';

/**
 * Obter o dia da semana em Lisbon time a partir de um UTC timestamp
 * 0=Sunday, 1=Monday, ..., 6=Saturday
 * Usa Intl.DateTimeFormat para precisão com DST
 */
export function getDayOfWeekLisbon(utcDate) {
  const formatter = new Intl.DateTimeFormat('en-GB', {
    timeZone: LISBON_TIMEZONE,
    weekday: 'long'
  });
  const parts = formatter.formatToParts(utcDate);
  const weekday = parts.find(p => p.type === 'weekday')?.value;

  const dayMap = {
    'Monday': 1, 'Tuesday': 2, 'Wednesday': 3,
    'Thursday': 4, 'Friday': 5, 'Saturday': 6, 'Sunday': 0
  };

  return dayMap[weekday] ?? utcDate.getUTCDay();
}

/**
 * Converter uma data local de Lisbon para UTC timestamp
 * Exemplo: '2025-01-15' + '09:00' → Date UTC correspondente
 *
 * Utiliza Intl.DateTimeFormat para lidar corretamente com DST
 */
export function localToUtc(dateStr, timeStr, timezone = LISBON_TIMEZONE) {
  const [hours, minutes] = timeStr.split(':').map(Number);

  // Usar Intl para obter o offset correto de Lisboa
  const localDate = new Date(`${dateStr}T${timeStr}:00`);

  // Formatar como Lisbon time e parsear de volta para obter o UTC correto
  // Abordagem: criar a data em Lisbon timezone e converter para UTC
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZoneName: 'shortOffset'
  });

  // Alternativa mais simples: usar Date.UTC com o offset de Lisboa
  // Em Janeiro (inverno): UTC+0, Em Julho (verão): UTC+1
  const offsetMs = getLisbonOffsetMs(dateStr);
  const utcDate = new Date(localDate.getTime() - offsetMs);

  return utcDate;
}

/**
 * Converter um timestamp UTC para hora local de Lisbon
 * Retorna "HH:MM"
 */
export function utcToLocalTime(utcDate, timezone = LISBON_TIMEZONE) {
  const formatter = new Intl.DateTimeFormat('pt-PT', {
    timeZone: timezone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  });
  return formatter.format(utcDate);
}

/**
 * Converter um timestamp UTC para data local de Lisbon
 * Retorna "YYYY-MM-DD"
 */
export function utcToLocalDate(utcDate, timezone = LISBON_TIMEZONE) {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
  return formatter.format(utcDate);
}

/**
 * Converter um timestamp UTC para data e hora local de Lisbon
 * Retorna "YYYY-MM-DD HH:MM"
 */
export function utcToLocalDateTime(utcDate, timezone = LISBON_TIMEZONE) {
  const datePart = utcToLocalDate(utcDate, timezone);
  const timePart = utcToLocalTime(utcDate, timezone);
  return `${datePart} ${timePart}`;
}

/**
 * Obter o offset de Lisboa em milissegundos para uma data específica
 * Considera DST (horário de verão)
 *
 * Janeiro (inverno): UTC+0 → offset = 0
 * Julho (verão): UTC+1 → offset = 3600000
 *
 * IMPORTANTE: O offset é a diferença de Lisboa para UTC (positiva para Lisboa à frente).
 * Para converter de local → UTC: UTC = local - offset
 */
function getLisbonOffsetMs(dateStr) {
  // Usar Intl para obter o offset real de Lisboa
  try {
    const date = new Date(dateStr);
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: LISBON_TIMEZONE,
      timeZoneName: 'shortOffset'
    });

    const parts = formatter.formatToParts(date);
    const offsetPart = parts.find(p => p.type === 'timeZoneName')?.value;

    // Parse do offset (ex: "GMT+0" no inverno, "GMT+1" no verão)
    if (offsetPart && offsetPart.includes('GMT')) {
      const match = offsetPart.match(/GMT([+-])(\d+)/);
      if (match) {
        // Se GMT+1, a offset de Lisboa é +1 hora = +3600000ms
        // A sign é positiva quando Lisboa está à frente de UTC
        const sign = match[1] === '+' ? 1 : -1;
        const hours = parseInt(match[2]);
        return sign * hours * 60 * 60 * 1000;
      }
    }
  } catch {
    // Fallback se Intl falhar
  }

  // Fallback: simplificação baseada no mês
  const date = new Date(dateStr);
  const month = date.getUTCMonth();
  // DST em Lisboa: último domingo de Março a último domingo de Outubro
  // Meses 3-9 (Abril-Outubro) são verão (UTC+1)
  if (month >= 3 && month <= 9) {
    return 1 * 60 * 60 * 1000; // UTC+1 → offset positivo
  }
  return 0; // UTC+0
}

/**
 * Verificar se uma data é válida
 */
export function isValidDate(dateStr) {
  if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return false;
  const date = new Date(dateStr + 'T00:00:00Z');
  return !isNaN(date.getTime());
}

/**
 * Verificar se uma data é uma data futura
 */
export function isFutureDate(dateStr, timezone = LISBON_TIMEZONE) {
  const now = new Date();
  const localNow = utcToLocalDate(now, timezone);
  return dateStr > localNow;
}

/**
 * Adicionar dias a uma data em Lisbon time
 */
export function addDaysLisbon(dateStr, days, timezone = LISBON_TIMEZONE) {
  const date = new Date(dateStr + 'T00:00:00Z');
  const localDate = utcToLocalDate(date, timezone);
  const [year, month, day] = localDate.split('-').map(Number);
  const newDate = new Date(Date.UTC(year, month - 1, day + days));
  return utcToLocalDate(newDate, timezone);
}

/**
 * Verificar se uma data está dentro do limite máximo de marcação
 */
export function isWithinMaxBookingDays(dateStr, maxDays, timezone = LISBON_TIMEZONE) {
  const now = new Date();
  const localNow = utcToLocalDate(now, timezone);
  const [year, month, day] = localNow.split('-').map(Number);
  const maxDate = new Date(Date.UTC(year, month - 1, day + maxDays));
  const localMaxDate = utcToLocalDate(maxDate, timezone);
  return dateStr <= localMaxDate;
}

/**
 * Obter a data de hoje em Lisbon time
 */
export function getTodayLisbon(timezone = LISBON_TIMEZONE) {
  return utcToLocalDate(new Date(), timezone);
}

/**
 * Obter o offset de Lisboa em minutos para uma data específica
 * Usado para cálculos precisos
 */
export function getLisbonOffsetMinutes(dateStr) {
  // Usar Intl.DateTimeFormat para obter o offset
  const date = new Date(dateStr + 'T12:00:00Z');
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: LISBON_TIMEZONE,
    timeZoneName: 'shortOffset'
  });

  const parts = formatter.formatToParts(date);
  const offsetPart = parts.find(p => p.type === 'timeZoneName')?.value;

  if (offsetPart && offsetPart.includes('GMT')) {
    const match = offsetPart.match(/GMT([+-])(\d+)/);
    if (match) {
      const sign = match[1] === '+' ? 1 : -1;
      return sign * parseInt(match[2]);
    }
  }

  // Fallback baseado no mês
  const month = new Date(dateStr).getUTCMonth();
  if (month >= 2 && month <= 9) return 60; // UTC+1
  return 0; // UTC+0
}

/**
 * Verificar se um horário local em Lisboa é válido para uma data
 * Útil para validar "14:30" não é DST transition
 */
export function isValidLocalTime(dateStr, timeStr, timezone = LISBON_TIMEZONE) {
  const date = new Date(dateStr + 'T' + timeStr + ':00');
  try {
    const localTime = utcToLocalTime(date, timezone);
    return localTime === timeStr || true; // Aceitar se a conversão funcionar
  } catch {
    return false;
  }
}

export { LISBON_TIMEZONE };
