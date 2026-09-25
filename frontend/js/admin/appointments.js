/**
 * NAILBOOK — Gestão de Marcações
 */

import { apiGet, apiPatch, apiPost } from '../api.js';
import { showToast } from '../components.js';
import { badge } from '../components.js';
import { showModal } from '../components.js';

/**
 * Carregar página de marcações
 */
export async function load(container) {
  container.innerHTML = `
    <div class="card">
      <div class="card__header">
        <h2 class="card__title">Todas as Marcações</h2>
        <div>
          <select class="form-group__input" id="filter-status" style="width: auto; display: inline-block;">
            <option value="">Todos os estados</option>
            <option value="confirmed">Confirmada</option>
            <option value="cancelled">Cancelada</option>
            <option value="completed">Concluída</option>
            <option value="no_show">Faltou</option>
          </select>
        </div>
      </div>
      <div id="appointments-list">
        <div class="loading"><div class="loading__spinner"></div><p>A carregar marcações...</p></div>
      </div>
    </div>
  `;

  await loadAppointments();

  // Filter
  document.getElementById('filter-status')?.addEventListener('change', loadAppointments);
}

/**
 * Carregar lista de marcações
 */
async function loadAppointments() {
  const container = document.getElementById('appointments-list');
  if (!container) return;

  const status = document.getElementById('filter-status')?.value || '';
  const url = `/api/admin/appointments${status ? `?status=${status}` : ''}&limit=50`;

  try {
    const data = await apiGet(url);
    const appointments = data.data || [];

    if (appointments.length === 0) {
      container.innerHTML = '<div class="empty-state"><p>Não existem marcações</p></div>';
      return;
    }

    container.innerHTML = `
      <table class="table">
        <thead>
          <tr>
            <th>Hora</th>
            <th>Cliente</th>
            <th>Serviço</th>
            <th>Preço</th>
            <th>Estado</th>
            <th>Ações</th>
          </tr>
        </thead>
        <tbody>
          ${appointments.map(a => {
            const start = new Date(a.start_at);
            const time = start.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit', hour12: false });
            return `
              <tr>
                <td>${time}</td>
                <td>${a.customer_name || '-'}</td>
                <td>${a.service_name || a.service?.name || '-'}</td>
                <td>€${Number(a.price).toFixed(2)}</td>
                <td>${badge(a.status)}</td>
                <td class="table__actions">
                  <button class="btn btn--small btn--secondary" onclick="viewAppointment('${a.id}')">Detalhes</button>
                  ${a.status === 'confirmed' ? `
                    <button class="btn btn--small btn--primary" onclick="completeAppointment('${a.id}')">Concluir</button>
                    <button class="btn btn--small btn--danger" onclick="cancelAppointment('${a.id}')">Cancelar</button>
                  ` : ''}
                </td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    `;
  } catch (err) {
    container.innerHTML = `<div class="error-state"><p>Erro ao carregar marcações</p><button class="btn btn--secondary" onclick="loadAppointments()">Tentar novamente</button></div>`;
  }
}

/**
 * Ver detalhes da marcação
 */
window.viewAppointment = async function(id) {
  try {
    const data = await apiGet(`/api/admin/appointments/${id}`);
    const a = data.data;
    
    const start = new Date(a.start_at);
    const time = start.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit', hour12: false });
    const dateStr = start.toLocaleDateString('pt-PT');

    showToast(`Detalhes de ${a.customer_name || 'Cliente'} - ${dateStr} ${time}`);
  } catch (err) {
    showToast('Erro ao carregar detalhes', 'error');
  }
};

/**
 * Marcar como concluída
 */
window.completeAppointment = async function(id) {
  const confirmed = await showModal('Concluir Marcação', 'Tem a certeza que pretende marcar esta marcação como concluída?');
  if (!confirmed) return;

  try {
    await apiPatch(`/api/admin/appointments/${id}`, { status: 'completed' });
    showToast('Marcação marcada como concluída', 'success');
    loadAppointments();
  } catch (err) {
    showToast('Erro ao atualizar marcação', 'error');
  }
};

/**
 * Cancelar marcação
 */
window.cancelAppointment = async function(id) {
  const confirmed = await showModal('Cancelar Marcação', 'Tem a certeza que pretende cancelar esta marcação?');
  if (!confirmed) return;

  try {
    await apiPatch(`/api/admin/appointments/${id}`, { status: 'cancelled' });
    showToast('Marcação cancelada com sucesso', 'success');
    loadAppointments();
  } catch (err) {
    showToast('Erro ao cancelar marcação', 'error');
  }
};
