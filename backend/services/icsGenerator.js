/* ============================================
   NAILBOOK — Gerador de Ficheiro ICS
   Compatível com Google Calendar, Apple, Outlook
   ============================================ */

import { localToUtc } from '../utils/timezone.js';
import { logger } from '../utils/logger.js';

/**
 * ICSGenerator — Gera ficheiros .ics válidos para calendários
 * 
 * Usa timezone Europe/Lisbon.
 * Garante DTSTART/DTEND corretos com timezone apropriado.
 */

const LISBON_TZ = 'Europe/Lisbon';

/**
 * Gerar ficheiro ICS para uma marcação
 * 
 * @param {Object} appointment - Dados da marcação do backend
 * @param {Object} settings - Configurações do negócio
 * @returns {string} Conteúdo ICS
 */
export function generateICS(appointment, settings = {}) {
  const businessName = settings?.business_name || 'NailBook';
  const location = settings?.calendar_location || '';
  const phone = settings?.business_phone || '';

  const startUtc = appointment.start_at;
  const endUtc = appointment.end_at;

  // Converter para Lisbon local time para DTSTART/DTEND
  // O .ics deve usar timezone local para que os calendários mostrem a hora correta
  const startLocal = formatLocalTime(startUtc, 'YYYYMMDD\\THHmmss');
  const endLocal = formatLocalTime(endUtc, 'YYYYMMDD\\THHmmss');
  const startDate = formatLocalDate(startUtc);
  const endDate = formatLocalDate(endUtc);

  const serviceName = appointment.service?.name || 'Serviço de Beleza';
  const customerName = appointment.customer_name || '';
  const durationMinutes = appointment.duration_snapshot_minutes || 60;
  const price = appointment.price ? `€${Number(appointment.price).toFixed(2)}` : '';

  const baseUrl = settings?.business_url || process.env.APP_URL || 'https://www.meudominio.pt';
  const uid = `nailbook-${appointment.id}@${baseUrl.replace(/^https?:\/\//, '').replace(/^www\./, '')}`;
  const dtStamp = new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';

  // Construir descrição
  const description = [
    `Serviço: ${serviceName}`,
    `Duração: ${durationMinutes} minutos`,
    price ? `Preço: ${price}` : '',
    customerName ? `Cliente: ${customerName}` : '',
    appointment.customer_notes ? `Notas: ${appointment.customer_notes}` : '',
    location ? `Localização: ${location}` : '',
    phone ? `Contacto: ${phone}` : '',
    '',
    'Esta marcação foi criada através do NailBook.',
    'Para gerir esta marcação, use o link fornecido.'
  ].filter(Boolean).join('\n');

  const locationField = location ? `LOCATION:${escapeIcs(location)}` : '';

  const ics = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//NailBook//NailBook Booking//PT',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-TIMEZONE:Europe/Lisbon',
    '',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${dtStamp}`,
    `DTSTART;TZID=Europe/Lisbon:${startLocal}`,
    `DTEND;TZID=Europe/Lisbon:${endLocal}`,
    `SUMMARY:${escapeIcs(`${businessName} - ${serviceName}`)}`,
    description ? `DESCRIPTION:${escapeIcs(description)}` : '',
    locationField,
    `CREATED:${dtStamp}`,
    `LAST-MODIFIED:${dtStamp}`,
    `SEQUENCE:0`,
    `STATUS:CONFIRMED`,
    `TRANSP:OPAQUE`,
    'END:VEVENT',
    '',
    'END:VCALENDAR'
  ].join('\r\n');

  return ics;
}

/**
 * Gerar URL de Google Calendar pre-preenchida
 */
export function generateGoogleCalendarUrl(appointment, settings = {}) {
  const businessName = settings?.business_name || 'NailBook';
  const serviceName = appointment.service?.name || 'Serviço';
  const location = settings?.calendar_location || '';

  const startUtc = appointment.start_at;
  const endUtc = appointment.end_at;

  // Converter para formato YYYYMMDDTHHmmss para Google Calendar
  const startDate = formatGoogleDate(startUtc, 'Europe/Lisbon');
  const endDate = formatGoogleDate(endUtc, 'Europe/Lisbon');

  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: `${businessName} - ${serviceName}`,
    dates: `${formatGoogleDate(startUtc, 'Europe/Lisbon')}/${formatGoogleDate(endUtc, 'Europe/Lisbon')}`,
    details: `Serviço: ${serviceName}\nCliente: ${appointment.customer_name || ''}\n\nNailBook - Marcação Online`,
    location: location || '',
    trp: 'false',
    sprop: `website:${baseUrl}`
  });

  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

/**
 * Formatar data para .ics (formato YYYYMMDD ou YYYYMMDDTHHmmss)
 */
function formatLocalTime(isoString, format) {
  const d = new Date(isoString);
  // Usar o formato simples
  const year = d.getUTCFullYear().toString().padStart(4, '0');
  const month = (d.getUTCMonth() + 1).toString().padStart(2, '0');
  const day = d.getUTCDate().toString().padStart(2, '0');
  const hours = d.getUTCHours().toString().padStart(2, '0');
  const minutes = d.getUTCMinutes().toString().padStart(2, '0');
  const seconds = d.getUTCSeconds().toString().padStart(2, '0');
  return `${year}${month}${day}T{hours}{minutes}{seconds}`.replace(/{(\w+)}/g, (_, k) => {
    const map = { hours, minutes, seconds };
    return map[k];
  });
}

function formatLocalDate(isoString) {
  const d = new Date(isoString);
  const year = d.getUTCFullYear();
  const month = (d.getUTCMonth() + 1).toString().padStart(2, '0');
  const day = d.getUTCDate().toString().padStart(2, '0');
  return `${year}${month}${day}`;
}

function formatGoogleDate(isoString, timezone) {
  const d = new Date(isoString);
  // Para Google Calendar, usar formato YYYYMMDDTHHmmss para o timezone correto
  const year = d.getUTCFullYear();
  const month = (d.getUTCMonth() + 1).toString().padStart(2, '0');
  const day = d.getUTCDate().toString().padStart(2, '0');
  const hours = d.getUTCHours().toString().padStart(2, '0');
  const minutes = d.getUTCMinutes().toString().padStart(2, '0');
  const seconds = d.getUTCSeconds().toString().padStart(2, '0');
  return `${year}${month}${day}T${hours}${minutes}${seconds}`;
}

/**
 * Escapar caracteres especiais para ICS
 */
function escapeIcs(str) {
  return str
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r');
}

/**
 * Validar se um ficheiro ICS é válido
 */
export function validateICS(icsContent) {
  const errors = [];

  if (!icsContent.includes('BEGIN:VCALENDAR')) errors.push('Missing BEGIN:VCALENDAR');
  if (!icsContent.includes('END:VCALENDAR')) errors.push('Missing END:VCALENDAR');
  if (!icsContent.includes('BEGIN:VEVENT')) errors.push('Missing BEGIN:VEVENT');
  if (!icsContent.includes('END:VEVENT')) errors.push('Missing END:VEVENT');
  if (!icsContent.includes('DTSTART')) errors.push('Missing DTSTART');
  if (!icsContent.includes('DTEND')) errors.push('Missing DTEND');
  if (!icsContent.includes('UID')) errors.push('Missing UID');

  // Verificar timezone
  if (!icsContent.includes('Europe/Lisbon')) {
    errors.push('Missing timezone Europe/Lisbon');
  }

  return { valid: errors.length === 0, errors };
}
