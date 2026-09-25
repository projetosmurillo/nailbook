/**
 * NAILBOOK — Definições
 */

import { apiGet, apiPatch } from '../api.js';
import { showToast } from '../components.js';

/**
 * Carregar página de definições
 */
export async function load(container) {
  try {
    const data = await apiGet('/api/admin/settings');
    const settings = data.data || {};

    container.innerHTML = `
      <div class="card">
        <div class="card__header">
          <h2 class="card__title">Definições do Negócio</h2>
        </div>
        <form id="settings-form">
          <div class="form-group">
            <label class="form-group__label">Nome do Negócio</label>
            <input type="text" class="form-group__input" id="set-business-name" value="${settings.business_name || ''}" required>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label class="form-group__label">Telefone</label>
              <input type="tel" class="form-group__input" id="set-business-phone" value="${settings.business_phone || ''}">
            </div>
            <div class="form-group">
              <label class="form-group__label">Email</label>
              <input type="email" class="form-group__input" id="set-business-email" value="${settings.business_email || ''}">
            </div>
          </div>
          
          <h3 class="card__title" style="font-size: var(--font-size-md); margin-top: var(--space-lg);">Regras de Marcação</h3>
          <div class="form-row">
            <div class="form-group">
              <label class="form-group__label">Antecedência Mínima (horas)</label>
              <input type="number" class="form-group__input" id="set-min-advance" value="${settings.minimum_advance_hours || 0}" min="0">
            </div>
            <div class="form-group">
              <label class="form-group__label">Limite Máximo (dias)</label>
              <input type="number" class="form-group__input" id="set-max-days" value="${settings.maximum_booking_days || 30}" min="1" max="365">
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label class="form-group__label">Prazo de Cancelamento (horas)</label>
              <input type="number" class="form-group__input" id="set-cancel-hours" value="${settings.cancellation_deadline_hours || 24}" min="0">
            </div>
            <div class="form-group">
              <label class="form-group__label">Buffer entre Clientes (min)</label>
              <input type="number" class="form-group__input" id="set-buffer" value="${settings.buffer_minutes || 15}" min="0">
            </div>
          </div>

          <div style="margin-top: var(--space-lg);">
            <button type="submit" class="btn btn--primary">Guardar Definições</button>
          </div>
        </form>
      </div>
    `;

    document.getElementById('settings-form')?.addEventListener('submit', saveSettings);
  } catch (err) {
    container.innerHTML = '<div class="error-state"><p>Erro ao carregar definições</p></div>';
  }
}

/**
 * Guardar definições
 */
async function saveSettings() {
  const name = document.getElementById('set-business-name').value.trim();
  const phone = document.getElementById('set-business-phone').value.trim();
  const email = document.getElementById('set-business-email').value.trim();
  const minAdvance = parseInt(document.getElementById('set-min-advance').value);
  const maxDays = parseInt(document.getElementById('set-max-days').value);
  const cancelHours = parseInt(document.getElementById('set-cancel-hours').value);
  const buffer = parseInt(document.getElementById('set-buffer').value);

  if (!name) {
    showToast('O nome do negócio é obrigatório', 'error');
    return;
  }

  try {
    await apiPatch('/api/admin/settings', {
      business_name: name,
      business_phone: phone,
      business_email: email,
      minimum_advance_hours: minAdvance,
      maximum_booking_days: maxDays,
      cancellation_deadline_hours: cancelHours,
      buffer_minutes: buffer
    });
    showToast('Definições guardadas com sucesso', 'success');
  } catch (err) {
    showToast('Erro ao guardar definições', 'error');
  }
}
