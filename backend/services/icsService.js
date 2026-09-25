/**
 * NAILBOOK — Serviço de Geração ICS
 */

/**
 * Gera conteúdo ICS (iCalendar) para uma marcação
 */
export function generateICS(appointment) {
  if (!appointment || !appointment.starts_at) return '';

  const start = new Date(appointment.starts_at);
  const end = new Date(start.getTime() + appointment.duration_min * 60000);

  const formatICSDate = (date) => {
    return date.getUTCFullYear() +
      pad(date.getUTCMonth() + 1) +
      pad(date.getUTCDate());
  };

  const pad = (n) => n.toString().padStart(2, '0');

  const escapeICS = (str) => {
    return (str || '').replace(/,/g, '\\,').replace(/;/g, '\\;').replace(/\n/g, '\\n');
  };

  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//NailBook//PT//PT',
    'BEGIN:VEVENT',
    `DTSTART:${formatICSDate(start)}T${pad(start.getUTCHours())}${pad(start.getUTCMinutes())}00`,
    `DTEND:${formatICSDate(end)}T${pad(end.getUTCHours())}${pad(end.getUTCMinutes())}00`,
    `SUMMARY:${escapeICS(appointment.service?.name || 'Marcação NailBook')}`,
    `DESCRIPTION:${escapeICS(appointment.notes || '')}`,
    'LOCATION:NailBook',
    'END:VEVENT',
    'END:VCALENDAR'
  ].join('\r\n');
}

/**
 * Formatar data para formato de ficheiro
 */
export function formatDateForFile(dateString) {
  const d = new Date(dateString);
  return d.toISOString().split('T')[0];
}

/**
 * Formatar hora para formato HHMM
 */
export function formatTimeForICS(dateString) {
  const d = new Date(dateString);
  return pad(d.getUTCHours()) + pad(d.getUTCMinutes());
}

function pad(n) {
  return n.toString().padStart(2, '0');
}
