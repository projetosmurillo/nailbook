/**
 * NAILBOOK — Gestão de Serviços
 */

import { apiGet, apiPost, apiPatch, apiDelete } from '../api.js';
import { showToast } from '../components.js';
import { showModal } from '../components.js';

/**
 * Carregar página de serviços
 */
export async function load(container) {
  container.innerHTML = `
    <div class="card">
      <div class="card__header">
        <h2 class="card__title">Serviços</h2>
        <button class="btn btn--primary" id="add-service-btn">+ Adicionar</button>
      </div>
      <div id="services-list">
        <div class="loading"><div class="loading__spinner"></div><p>A carregar serviços...</p></div>
      </div>
    </div>
  `;

  await loadServices();

  document.getElementById('add-service-btn')?.addEventListener('click', showAddForm);
}

/**
 * Carregar lista de serviços
 */
async function loadServices() {
  const container = document.getElementById('services-list');
  if (!container) return;

  try {
    const data = await apiGet('/api/admin/services');
    const services = data.data || [];

    if (services.length === 0) {
      container.innerHTML = '<div class="empty-state"><p>Não existem serviços</p></div>';
      return;
    }

    container.innerHTML = `
      <table class="table">
        <thead>
          <tr>
            <th>Nome</th>
            <th>Duração</th>
            <th>Preço</th>
            <th>Estado</th>
            <th>Ações</th>
          </tr>
        </thead>
        <tbody>
          ${services.map(s => `
            <tr>
              <td>${s.name}</td>
              <td>${s.duration_minutes} min</td>
              <td>€${Number(s.price).toFixed(2)}</td>
              <td>${s.active ? '<span class="badge badge--success">Ativo</span>' : '<span class="badge badge--muted">Inativo</span>'}</td>
              <td class="table__actions">
                <button class="btn btn--small btn--secondary" onclick="editService('${s.id}')">Editar</button>
                <button class="btn btn--small ${s.active ? 'btn--danger' : 'btn--primary'}" onclick="toggleService('${s.id}', ${!s.active})">
                  ${s.active ? 'Desativar' : 'Ativar'}
                </button>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  } catch (err) {
    container.innerHTML = '<div class="error-state"><p>Erro ao carregar serviços</p></div>';
  }
}

/**
 * Mostrar formulário de adição
 */
function showAddForm() {
  const formHtml = `
    <div class="card">
      <h3 class="card__title">Novo Serviço</h3>
      <form id="add-service-form">
        <div class="form-group">
          <label class="form-group__label">Nome</label>
          <input type="text" class="form-group__input" id="new-service-name" required>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-group__label">Duração (minutos)</label>
            <input type="number" class="form-group__input" id="new-service-duration" min="5" max="480" required>
          </div>
          <div class="form-group">
            <label class="form-group__label">Preço (€)</label>
            <input type="number" class="form-group__input" id="new-service-price" step="0.01" min="0" required>
          </div>
        </div>
        <div class="form-group">
          <label class="form-group__label">Descrição</label>
          <textarea class="form-group__input" id="new-service-description" rows="2"></textarea>
        </div>
        <button type="submit" class="btn btn--primary">Criar Serviço</button>
        <button type="button" class="btn btn--secondary" id="cancel-service">Cancelar</button>
      </form>
    </div>
  `;

  const list = document.getElementById('services-list');
  list.innerHTML = formHtml;

  document.getElementById('add-service-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('new-service-name').value.trim();
    const duration = parseInt(document.getElementById('new-service-duration').value);
    const price = parseFloat(document.getElementById('new-service-price').value);
    const description = document.getElementById('new-service-description').value.trim();

    if (!name || !duration || !price) {
      showToast('Preencha todos os campos obrigatórios', 'error');
      return;
    }

    try {
      await apiPost('/api/admin/services', { name, description, price, duration_minutes: duration });
      showToast('Serviço criado com sucesso', 'success');
      loadServices();
    } catch (err) {
      showToast('Erro ao criar serviço', 'error');
    }
  });

  document.getElementById('cancel-service')?.addEventListener('click', loadServices);
}

/**
 * Editar serviço
 */
window.editService = async function(id) {
  try {
    const data = await apiGet(`/api/admin/services/${id}`);
    const s = data.data;

    const formHtml = `
      <div class="card">
        <h3 class="card__title">Editar: ${s.name}</h3>
        <form id="edit-service-form">
          <div class="form-group">
            <label class="form-group__label">Nome</label>
            <input type="text" class="form-group__input" id="edit-service-name" value="${s.name}" required>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label class="form-group__label">Duração (minutos)</label>
              <input type="number" class="form-group__input" id="edit-service-duration" value="${s.duration_minutes}" min="5" max="480" required>
            </div>
            <div class="form-group">
              <label class="form-group__label">Preço (€)</label>
              <input type="number" class="form-group__input" id="edit-service-price" value="${s.price}" step="0.01" min="0" required>
            </div>
          </div>
          <div class="form-group">
            <label class="form-group__label">Descrição</label>
            <textarea class="form-group__input" id="edit-service-description" rows="2">${s.description || ''}</textarea>
          </div>
          <button type="submit" class="btn btn--primary">Guardar</button>
          <button type="button" class="btn btn--secondary" id="cancel-edit">Cancelar</button>
        </form>
      </div>
    `;

    const list = document.getElementById('services-list');
    list.innerHTML = formHtml;

    document.getElementById('edit-service-form')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = document.getElementById('edit-service-name').value.trim();
      const duration = parseInt(document.getElementById('edit-service-duration').value);
      const price = parseFloat(document.getElementById('edit-service-price').value);
      const description = document.getElementById('edit-service-description').value.trim();

      try {
        await apiPatch(`/api/admin/services/${id}`, { name, description, price, duration_minutes: duration });
        showToast('Serviço atualizado', 'success');
        loadServices();
      } catch (err) {
        showToast('Erro ao atualizar serviço', 'error');
      }
    });

    document.getElementById('cancel-edit')?.addEventListener('click', loadServices);
  } catch (err) {
    showToast('Erro ao carregar serviço', 'error');
  }
};

/**
 Ativar/desativar serviço
 */
window.toggleService = async function(id, active) {
  try {
    await apiPatch(`/api/admin/services/${id}`, { active });
    showToast(active ? 'Serviço ativado' : 'Serviço desativado', 'success');
    loadServices();
  } catch (err) {
    showToast('Erro ao atualizar serviço', 'error');
  }
};
