/* ============================================
   NAILBOOK — Componente Calendário (Fase 6)
   Calendário mobile-friendly para seleção de data
   ============================================ */

// Calendar is integrated into booking.js
// This file provides additional calendar utilities if needed

/**
 * Obter nome do mês em português
 */
export function getMonthName(monthIndex) {
  const names = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
                 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
  return names[monthIndex] || '';
}

/**
 * Obter nome do dia em português
 */
export function getDayName(dayIndex) {
  const names = ['Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira',
                 'Sexta-feira', 'Sábado', 'Domingo'];
  return names[dayIndex] || '';
}

/**
 * Obter abreviação do dia
 */
export function getDayShortName(dayIndex) {
  const names = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];
  return names[dayIndex] || '';
}

/**
 * Verificar se uma data é hoje
 */
export function isToday(date) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d.getTime() === today.getTime();
}

/**
 * Verificar se uma data é um dia válido para marcação
 */
export function isValidBookingDate(date, settings) {
  const d = new Date(date);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (d < today) return false;

  // Check if day is in allowed days (from settings)
  if (settings?.allowed_days) {
    const dayOfWeek = d.getDay(); // 0=Sun, 1=Mon, etc.
    // Convert to business days format
    const businessDay = dayOfWeek === 0 ? 7 : dayOfWeek;
    return settings.allowed_days.includes(businessDay);
  }

  return true;
}

/**
 * Gerar array de datas do mês
 */
export function getDaysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate();
}

/**
 * Obter o primeiro dia do mês (0=Sun, 1=Mon, etc.)
 */
export function getFirstDayOfMonth(year, month) {
  return new Date(year, month, 1).getDay();
}

/**
 * Formatar data para string YYYY-MM-DD
 */
export function formatDateISO(date) {
  const d = new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
