/**
 * NAILBOOK — Gestão de Clientes
 */

import { apiGet } from '../api.js';
import { showToast } from '../components.js';

/**
 * Carregar página de clientes
 */
export async function load(container) {
  container.innerHTML = `
    <div class="card">
      <div class="card__header">
        <h2 class="card__title">Clientes</h2>
        <div>
          <input type="search" class="form-group__input" id="customer-search" placeholder="Pesquisar por nome, telefone ou email..." style="width: 300px;">
        </div>
      </div>
      <div id="customers-list">
        <div class="loading"><div class="loading__spinner"></div><p>A carregar clientes...</p></div>
      </div>
    </div>
  `;

  await loadCustomers();

  document.getElementById('customer-search')?.addEventListener('input', debounce(loadCustomers, 300));
}

/**
 * Carregar lista de clientes
 */
async function loadCustomers() {
  const container = document.getElementById('customers-list');
  if (!container) return;

  const search = document.getElementById('customer-search')?.value || '';
  const url = search ? `/api/admin/customers?search=${encodeURIComponent(search)}` : '/api/admin/customers';

  try {
    const data = await apiGet(url);
    const customers = data.data || [];

    if (customers.length === 0) {
      container.innerHTML = '<div class="empty-state"><p>Nenhum cliente encontrado</p></div>';
      return;
    }

    container.innerHTML = `
      <table class="table">
        <thead>
          <tr>
            <th>Nome</th>
            <th>Telefone</th>
            <th>Email</th>
            <th>Marcações</th>
            <th>Última Visita</th>
            <th>Ações</th>
          </tr>
        </thead>
        <tbody>
          ${customers.map(c => `
            <tr>
              <td><strong>${c.name || '-'}</strong></td>
              <td>${c.phone || '-'}</td>
              <td>${c.email || '-'}</td>
              <td>${c.appointment_count || 0}</td>
              <td>${c.last_appointment ? new Date(c.last_appointment).toLocaleDateString('pt-PT') : '-'}</td>
              <td class="table__actions">
                <button class="btn btn--small btn--secondary" onclick="viewCustomer('${c.id}')">Detalhes</button>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  } catch (err) {
    container.innerHTML = '<div class="error-state"><p>Erro ao carregar clientes</p></div>';
  }
}

/**
 * Ver detalhes do cliente
 */
window.viewCustomer = async function(id) {
  try {
    const data = await apiGet(`/api/admin/customers/${id}`);
    const c = data.data;
    showToast(`${c.name} - ${c.appointment_count || 0} marcações`, 'info');
  } catch (err) {
    showToast('Erro ao carregar detalhes do cliente', 'error');
  }
};

/**
 * Debounce helper
 */
function debounce(fn, delay) {
  let timer;
  return function(...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), delay);
  };
}
