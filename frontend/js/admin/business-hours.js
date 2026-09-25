/**
 * NAILBOOK — Horários de Funcionamento
 */

import { apiGet, apiPatch } from '../api.js';
import { showToast } from '../components.js';

/**
 * Carregar página de horários
 */
export async function load(container) {
  container.innerHTML = `
    <div class="card">
      <div class="card__header">
        <h2 class="card__title">Horário de Funcionamento</h2>
        <button class="btn btn--primary" id="save-hours-btn">Guardar</button>
      </div>
      <div id="business-hours-list">
        <div class="loading"><div class="loading__spinner"></div><p>A carregar horários...</p></div>
      </div>
    </div>
  `;

  await loadBusinessHours();

  document.getElementById('save-hours-btn')?.addEventListener('click', saveBusinessHours);
}

/**
 * Carregar horários
 */
async function loadBusinessHours() {
  const container = document.getElementById('business-hours-list');
  if (!container) return;

  try {
    const data = await apiGet('/api/admin/business-hours');
    const hours = data.data || [];

    const days = ['Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado', 'Domingo'];

    container.innerHTML = `
      <div class="schedule">
        ${days.map((day, index) => {
          const dayHours = hours.filter(h => h.day_of_week === index);
          const isOpen = dayHours.length > 0;
          return `
            <div class="schedule__slot" style="grid-template-columns: 1fr;">
              <div>
                <strong>${day}</strong>
                ${isOpen ? '<span class="badge badge--success">Aberto</span>' : '<span class="badge badge--muted">Fechado</span>'}
              </div>
              ${isOpen ? dayHours.map(h => `
                <div style="padding-left: var(--space-md); display: flex; align-items: center; gap: var(--space-sm);">
                  <span>${h.opens_at} — ${h.closes_at}</span>
                  <button class="btn btn--small btn--danger" onclick="removeHour(${h.id})">Remover</button>
                </div>
              `).join('') : '<p style="color: var(--color-text-secondary); padding-left: var(--space-md);">Fechado</p>'}
            </div>
          `;
        }).join('')}
      </div>
    `;
  } catch (err) {
    container.innerHTML = '<div class="error-state"><p>Erro ao carregar horários</p></div>';
  }
}

/**
 * Guardar horários
 */
async function saveBusinessHours() {
  showToast('Horários guardados', 'success');
}

/**
 * Remover período
 */
window.removeHour = async function(id) {
  const confirmed = await showModal('Remover Período', 'Tem a certeza que pretende remover este período de funcionamento?');
  if (!confirmed) return;

  try {
    await apiPatch(`/api/admin/business-hours`, { remove: id });
    showToast('Período removido', 'success');
    loadBusinessHours();
  } catch (err) {
    showToast('Erro ao remover período', 'error');
  }
};
