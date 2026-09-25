/* ============================================
   NAILBOOK — Gestão de Marcação (Fase 6)
   Página pública para gerir/cancelar marcação por token
   ============================================ */

import { apiGet, apiPost } from './api.js';
import { showToast } from './components.js';

/**
 * Inicializar página de gestão de marcação
 */
export async function initAppointmentManagement() {
  const container = document.getElementById('management-container');
  if (!container) return;

  container.innerHTML = '<div class="loading"><div class="loading__spinner"></div><p>A carregar marcação...</p></div>';

  // Get token from URL or path
  const token = getTokenFromURL();

  if (!token) {
    container.innerHTML = `
      <div class="management__card" style="text-align: center;">
        <div class="empty-state__icon" aria-hidden="true">🔍</div>
        <h2 style="font-family: var(--font-display); color: var(--color-primary); margin-bottom: var(--space-md);">
          Não foi possível encontrar esta marcação.
        </h2>
        <p style="color: var(--color-text-muted); margin-bottom: var(--space-lg);">
          O token é inválido ou em falta.
        </p>
        <a href="/marcacao" class="btn btn--primary">Nova Marcação</a>
      </div>
    `;
    return;
  }

  try {
    const data = await apiGet(`/api/appointments/${token}`);
    const appointment = data.data;

    renderManagementCard(container, appointment, token);
  } catch (err) {
    container.innerHTML = `
      <div class="management__card" style="text-align: center;">
        <div class="empty-state__icon" aria-hidden="true">🔍</div>
        <h2 style="font-family: var(--font-display); color: var(--color-primary); margin-bottom: var(--space-md);">
          Não foi possível encontrar esta marcação.
        </h2>
        <p style="color: var(--color-text-muted); margin-bottom: var(--space-lg);">
          O token pode ser inválido ou a marcação foi eliminada.
        </p>
        <a href="/marcacao" class="btn btn--primary">Nova Marcação</a>
      </div>
    `;
  }
}

/**
 * Renderizar cartão de gestão
 */
function renderManagementCard(container, appointment, token) {
  const isCancelled = appointment.status === 'cancelled';
  const isConfirmed = appointment.status === 'confirmed';

  container.innerHTML = `
    <div class="management__card">
      <div style="text-align: center; margin-bottom: var(--space-xl);">
        <span class="management__badge management__badge--${appointment.status}">${getStatusLabel(appointment.status)}</span>
      </div>
      <h2 style="font-family: var(--font-display); font-size: var(--font-size-xl); text-align: center; margin-bottom: var(--space-xl);">
        ${escapeHtml(appointment.service?.name || 'Serviço')}
      </h2>
      <div style="margin-bottom: var(--space-lg);">
        <div class="summary__row">
          <span class="summary__label">Data</span>
          <span class="summary__value">${formatDate(appointment.start_at)}</span>
        </div>
        <div class="summary__row">
          <span class="summary__label">Hora</span>
          <span class="summary__value">${formatTime(appointment.start_at)}</span>
        </div>
        <div class="summary__row">
          <span class="summary__label">Duração</span>
          <span class="summary__value">${appointment.duration_snapshot_minutes || '?'} min</span>
        </div>
        <div class="summary__row">
          <span class="summary__label">Preço</span>
          <span class="summary__value">€${Number(appointment.price).toFixed(2)}</span>
        </div>
        <div class="summary__row">
          <span class="summary__label">Nome</span>
          <span class="summary__value">${escapeHtml(appointment.customer_name)}</span>
        </div>
        <div class="summary__row">
          <span class="summary__label">Telefone</span>
          <span class="summary__value">${escapeHtml(appointment.customer_phone)}</span>
        </div>
        ${appointment.customer_email ? `
        <div class="summary__row">
          <span class="summary__label">Email</span>
          <span class="summary__value">${escapeHtml(appointment.customer_email)}</span>
        </div>` : ''}
        ${appointment.customer_notes ? `
        <div class="summary__row">
          <span class="summary__label">Observações</span>
          <span class="summary__value">${escapeHtml(appointment.customer_notes)}</span>
        </div>` : ''}
      </div>
      ${isConfirmed ? `
      <div style="text-align: center; margin-bottom: var(--space-md);">
        <a href="/marcacao/${token}/calendar.ics" class="btn btn--secondary" download style="display: inline-block; margin-bottom: var(--space-sm);">📅 Adicionar ao Calendário</a>
      </div>
      <div style="text-align: center;">
        <button class="btn btn--danger btn--full" id="btn-cancel-appointment">Cancelar Marcação</button>
      </div>
      ` : isCancelled ? `
      <div style="text-align: center;">
        <p style="color: var(--color-text-muted);">Esta marcação foi cancelada.</p>
      </div>
      ` : `
      <div style="text-align: center;">
        <p style="color: var(--color-text-muted);">Esta marcação tem estado: ${getStatusLabel(appointment.status)}</p>
      </div>
      `}
    </div>
  `;

  // Setup cancel button
  const cancelBtn = document.getElementById('btn-cancel-appointment');
  if (cancelBtn && isConfirmed) {
    cancelBtn.addEventListener('click', async () => {
      if (!confirm('Tem a certeza que pretende cancelar esta marcação?')) return;

      cancelBtn.disabled = true;
      cancelBtn.textContent = 'A cancelar...';

      try {
        const result = await apiPost(`/api/appointments/${token}/cancel`, {});
        if (result.success) {
          showToast('Marcação cancelada com sucesso', 'success');
          container.innerHTML = `
            <div class="management__card" style="text-align: center;">
              <div style="width: 80px; height: 80px; background: var(--color-success); color: white; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 2rem; margin: 0 auto var(--space-lg);">✓</div>
              <h2 class="success__title">Marcação Cancelada</h2>
              <p style="color: var(--color-text-muted); margin-top: var(--space-md);">A sua marcação foi cancelada com sucesso.</p>
              <a href="/marcacao" class="btn btn--primary" style="margin-top: var(--space-lg); display: inline-block;">Nova Marcação</a>
            </div>
          `;
        }
      } catch (err) {
        cancelBtn.disabled = false;
        cancelBtn.textContent = 'Cancelar Marcação';

        if (err.message && err.message.includes('prazo')) {
          showToast('Esta marcação já não pode ser cancelada online porque está dentro do prazo mínimo de cancelamento. Entre em contacto connosco.', 'error');
        } else {
          showToast('Erro ao cancelar. Tente novamente.', 'error');
        }
      }
    });
  }
}

/**
 * Obter token da URL
 */
function getTokenFromURL() {
  const params = new URLSearchParams(window.location.search);
  const token = params.get('token');
  if (token) return token;

  // Also check path: /marcacao/:token
  const pathMatch = window.location.pathname.match(/\/marcacao\/([a-f0-9-]+)/i);
  return pathMatch ? pathMatch[1] : null;
}

function getStatusLabel(status) {
  const labels = { confirmed: 'Confirmada', cancelled: 'Cancelada', completed: 'Concluída', no_show: 'Faltou' };
  return labels[status] || status;
}

function formatDate(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  return d.toLocaleDateString('pt-PT', { day: '2-digit', month: 'long', year: 'numeric' });
}

function formatTime(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  return d.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit', hour12: false });
}

function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Expose globally
window.initAppointmentManagement = initAppointmentManagement;
