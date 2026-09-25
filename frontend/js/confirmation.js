/**
 * NAILBOOK — Página de Confirmação
 * Extrai dados da URL e preenche detalhes da marcação
 */

document.addEventListener('DOMContentLoaded', () => {
  loadConfirmationDetails();
  setupCalendarButton();
});

/**
 * Carrega os detalhes da marcação a partir dos parâmetros URL
 */
async function loadConfirmationDetails() {
  const params = new URLSearchParams(window.location.search);
  const token = params.get('token');

  if (!token) {
    showError('Nenhum token de marcação fornecido.');
    return;
  }

  try {
    const data = await api.get(`/api/appointments/${token}`);
    if (data.success && data.data) {
      renderDetails(data.data);
    }
  } catch (error) {
    showError('Marcação não encontrada.');
  }
}

/**
 * Renderiza os detalhes no card de confirmação
 * Novo schema: duration_snapshot_minutes, price (decimal), status
 */
function renderDetails(appointment) {
  const container = document.getElementById('confirmation-details');
  if (!container) return;

  const serviceName = appointment.service?.name || 'Serviço';
  const date = formatDate(appointment.start_at);
  const time = formatTime(appointment.start_at);
  const duration = appointment.duration_snapshot_minutes || appointment.duration_minutes;
  const price = formatPrice(appointment.price);
  const statusLabel = getStatusLabel(appointment.status);
  const notes = appointment.customer_notes || appointment.notes;

  container.innerHTML = `
    <div class="confirmation__detail-row">
      <span class="confirmation__detail-label">Serviço</span>
      <span class="confirmation__detail-value">${escapeHtml(serviceName)}</span>
    </div>
    <div class="confirmation__detail-row">
      <span class="confirmation__detail-label">Data</span>
      <span class="confirmation__detail-value">${date}</span>
    </div>
    <div class="confirmation__detail-row">
      <span class="confirmation__detail-label">Hora</span>
      <span class="confirmation__detail-value">${time}</span>
    </div>
    <div class="confirmation__detail-row">
      <span class="confirmation__detail-label">Duração</span>
      <span class="confirmation__detail-value">${duration} minutos</span>
    </div>
    <div class="confirmation__detail-row">
      <span class="confirmation__detail-label">Preço</span>
      <span class="confirmation__detail-value">${price}</span>
    </div>
    <div class="confirmation__detail-row">
      <span class="confirmation__detail-label">Estado</span>
      <span class="confirmation__detail-value">${statusLabel}</span>
    </div>
    ${notes ? `
    <div class="confirmation__detail-row">
      <span class="confirmation__detail-label">Observações</span>
      <span class="confirmation__detail-value">${escapeHtml(notes)}</span>
    </div>
    ` : ''}
  `;

  // Atualizar o link de cancelamento
  const cancelLink = document.getElementById('cancel-link');
  if (cancelLink) {
    cancelLink.href = `#`;
    cancelLink.addEventListener('click', (e) => {
      e.preventDefault();
      const confirmed = confirm('Tem a certeza que pretende cancelar esta marcação?');
      if (confirmed) {
        window.location.href = `cancel.html?token=${token}`;
      }
    });
  }
}

/**
 * Configura o botão "Adicionar ao calendário" (.ics)
 */
function setupCalendarButton() {
  const btn = document.getElementById('btn-add-calendar');
  if (!btn) return;

  btn.addEventListener('click', async () => {
    try {
      const params = new URLSearchParams(window.location.search);
      const token = params.get('token');
      const data = await api.get(`/api/appointments/${token}`);

      if (data.success && data.data) {
        const icsContent = generateICS(data.data);
        const blob = new Blob([icsContent], { type: 'text/calendar' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `marcacao-${data.data.token || data.data.id}.ics`;
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch (e) {
      alert('Erro ao gerar o ficheiro .ics');
    }
  });
}

/**
 * Gera conteúdo ICS (iCalendar)
 * Usa duration_snapshot_minutes do novo schema
 */
function generateICS(appointment) {
  const date = formatDate(appointment.start_at);
  const time = formatTime(appointment.start_at);
  const [hours, minutes] = time.split(':');
  const duration = appointment.duration_snapshot_minutes || appointment.duration_minutes || 60;
  const endDate = new Date(appointment.start_at);
  endDate.setMinutes(endDate.getMinutes() + duration);
  const endTime = formatTime(endDate.toISOString());
  const [endHours, endMinutes] = endTime.split(':');

  return `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//NailBook//PT//PT
BEGIN:VEVENT
DTSTART:${formatICSDate(appointment.start_at)}T${hours}${minutes}00
DTEND:${formatICSDate(endDate.toISOString())}T${endHours}${endMinutes}00
SUMMARY:${escapeICS(appointment.service?.name || 'Marcação')}
DESCRIPTION:${escapeICS(appointment.customer_notes || appointment.notes || '')}
LOCATION:NailBook
END:VEVENT
END:VCALENDAR`;
}

function formatICSDate(isoString) {
  const d = new Date(isoString);
  return d.getUTCFullYear() + pad(d.getUTCMonth() + 1) + pad(d.getUTCDate());
}

function pad(n) {
  return n.toString().padStart(2, '0');
}

function escapeICS(str) {
  return str.replace(/,/g, '\\,').replace(/;/g, '\\;');
}

/**
 * Novo schema: não existe 'pending', usar 'confirmed' como estado inicial
 */
function getStatusLabel(status) {
  const labels = {
    confirmed: 'Confirmada',
    cancelled: 'Cancelada',
    completed: 'Concluída',
    no_show: 'No-show'
  };
  return labels[status] || status;
}

function formatDate(dateString) {
  const d = new Date(dateString);
  return d.toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function formatTime(dateString) {
  const d = new Date(dateString);
  return d.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit', hour12: false });
}

/**
 * Novo schema: price é NUMERIC direto (ex: 25.00)
 */
function formatPrice(price) {
  return `€${Number(price).toFixed(2)}`;
}

function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function showError(message) {
  const container = document.getElementById('confirmation-details');
  if (container) {
    container.innerHTML = `<p style="color: var(--color-error);">${message}</p>`;
  }
}
