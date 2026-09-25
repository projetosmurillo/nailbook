/**
 * NAILBOOK — Períodos Bloqueados
 */

import { apiGet, apiPost, apiDelete } from '../api.js';
import { showToast } from '../components.js';
import { showModal } from '../components.js';

/**
 * Carregar página de períodos bloqueados
 */
export async function load(container) {
  container.innerHTML = `
    <div class="card">
      <div class="card__header">
        <h2 class="card__title">Períodos Bloqueados</h2>
        <button class="btn btn--primary" id="add-blocked-btn">+ Bloquear</button>
      </div>
      <div id="blocked-list">
        <div class="loading"><div class="loading__spinner"></div><p>A carregar...</p></div>
      </div>
    </div>
  `;

  await loadBlockedPeriods();

  document.getElementById('add-blocked-btn')?.addEventListener('click', showAddForm);
}

/**
 * Carregar lista de períodos bloqueados
 */
async function loadBlockedPeriods() {
  const container = document.getElementById('blocked-list');
  if (!container) return;

  try {
    const data = await apiGet('/api/admin/blocked-periods');
    const periods = data.data || [];

    if (periods.length === 0) {
      container.innerHTML = '<div class="empty-state"><p>Nenhum período bloqueado</p></div>';
      return;
    }

    container.innerHTML = `
      <table class="table">
        <thead>
          <tr>
            <th>Data</th>
            <th>Início</th>
            <th>Fim</th>
            <th>Motivo</th>
            <th>Ações</th>
          </tr>
        </thead>
        <tbody>
          ${periods.map(p => {
            const start = new Date(p.starts_at);
            const end = new Date(p.ends_at);
            return `
              <tr>
                <td>${start.toLocaleDateString('pt-PT')}</td>
                <td>${start.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit', hour12: false })}</td>
                <td>${end.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit', hour12: false })}</td>
                <td>${p.reason || '-'}</td>
                <td class="table__actions">
                  <button class="btn btn--small btn--danger" onclick="deleteBlockedPeriod('${p.id}')">Apagar</button>
                </td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    `;
  } catch (err) {
    container.innerHTML = '<div class="error-state"><p>Erro ao carregar períodos bloqueados</p></div>';
  }
}

/**
 * Mostrar formulário de bloqueio
 */
function showAddForm() {
  const formHtml = `
    <div class="card">
      <h3 class="card__title">Bloquear Período</h3>
      <form id="add-blocked-form">
        <div class="form-group">
          <label class="form-group__label">Data Inicial</label>
          <input type="datetime-local" class="form-group__input" id="blocked-starts" required>
        </div>
        <div class="form-group">
          <label class="form-group__label">Data Final</label>
          <input type="datetime-local" class="form-group__input" id="blocked-ends" required>
        </div>
        <div class="form-group">
          <label class="form-group__label">Motivo</label>
          <input type="text" class="form-group__input" id="blocked-reason" placeholder="Férias, consulta, etc.">
        </div>
        <button type="submit" class="btn btn--primary">Bloquear</button>
        <button type="button" class="btn btn--secondary" id="cancel-blocked">Cancelar</button>
      </form>
    </div>
  `;

  const list = document.getElementById('blocked-list');
  list.innerHTML = formHtml;

  document.getElementById('add-blocked-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const starts = document.getElementById('blocked-starts').value;
    const ends = document.getElementById('blocked-ends').value;
    const reason = document.getElementById('blocked-reason').value.trim();

    if (!starts || !ends) {
      showToast('Preencha as datas', 'error');
      return;
    }

    try {
      const data = await apiPost('/api/admin/blocked-periods', { starts_at: starts, ends_at: ends, reason });
      
      if (data.conflicts) {
        const proceed = await showModal('Conflito Detetado', `Existem marcações neste período. Deseja continuar mesmo assim?`, 'Continuar', 'Cancelar');
        if (!proceed) return;
      }
      
      showToast('Período bloqueado', 'success');
      loadBlockedPeriods();
    } catch (err) {
      showToast('Erro ao bloquear período', 'error');
    }
  });

  document.getElementById('cancel-blocked')?.addEventListener('click', loadBlockedPeriods);
}

/**
 * Apagar período bloqueado
 */
window.deleteBlockedPeriod = async function(id) {
  const confirmed = await showModal('Apagar Bloqueio', 'Tem a certeza que pretende remover este bloqueio?');
  if (!confirmed) return;

  try {
    await apiDelete(`/api/admin/blocked-periods/${id}`);
    showToast('Bloqueio removido', 'success');
    loadBlockedPeriods();
  } catch (err) {
    showToast('Erro ao remover bloqueio', 'error');
  }
};
