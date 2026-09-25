/**
 * NAILBOOK — Dashboard Administrativo
 * Página principal do painel administrativo
 */

import { apiGet, apiPost } from '../api.js';
import { showToast } from '../components.js';
import { badge } from '../components.js';

/**
 * Carregar dashboard
 */
export async function load(container) {
  // Stats
  const stats = await loadStats();
  
  // Today's appointments
  const todayAppointments = await loadTodayAppointments();

  container.innerHTML = `
    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-card__value">${stats.today}</div>
        <div class="stat-card__label">Marcações Hoje</div>
      </div>
      <div class="stat-card">
        <div class="stat-card__value">${stats.revenue}</div>
        <div class="stat-card__label">Receita Hoje (€)</div>
      </div>
      <div class="stat-card">
        <div class="stat-card__value">${stats.week}</div>
        <div class="stat-card__label">Marcações Esta Semana</div>
      </div>
      <div class="stat-card">
        <div class="stat-card__value">${stats.confirmed}</div>
        <div class="stat-card__label">Confirmadas</div>
      </div>
    </div>

    <div class="card">
      <div class="card__header">
        <h2 class="card__title">Próxima Marcação</h2>
      </div>
      ${todayAppointments.next ? renderNextAppointment(todayAppointments.next) : '<p class="empty-state__text">Não existem marcações agendadas</p>'}
    </div>

    <div class="card">
      <div class="card__header">
        <h2 class="card__title">Agenda de Hoje</h2>
      </div>
      ${todayAppointments.list.length > 0 
        ? renderSchedule(todayAppointments.list) 
        : '<p class="empty-state__text">Não existem marcações para hoje</p>'}
    </div>

    <div class="card">
      <div class="card__header">
        <h2 class="card__title">Marcações Recentes</h2>
      </div>
      ${await renderRecentAppointments()}
    </div>
  `;
}

/**
 * Carregar estatísticas
 */
async function loadStats() {
  try {
    const data = await apiGet('/api/admin/appointments?limit=1&date=' + new Date().toISOString().split('T')[0]);
    // Get stats from the API or calculate
    return { today: 0, week: 0, revenue: '0.00', confirmed: 0 };
  } catch {
    return { today: 0, week: 0, revenue: '0.00', confirmed: 0 };
  }
}

/**
 * Carregar marcações de hoje
 */
async function loadTodayAppointments() {
  try {
    const today = new Date().toISOString().split('T')[0];
    const data = await apiGet(`/api/admin/appointments?date=${today}&limit=50`);
    const appointments = data.data || [];
    
    const confirmed = appointments.filter(a => a.status === 'confirmed');
    const next = confirmed[0] || null;
    
    return {
      list: confirmed,
      next: next
    };
  } catch {
    return { list: [], next: null };
  }
}

/**
 * Renderizar próxima marcação
 */
function renderNextAppointment(appointment) {
  const start = new Date(appointment.start_at);
  const time = start.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit', hour12: false });
  
  return `
    <div class="schedule__slot">
      <div class="schedule__time">${time}</div>
      <div class="schedule__event">
        <span class="schedule__customer">${appointment.customer_name || 'Cliente'}</span>
        <span class="schedule__service">${appointment.service_name || appointment.service?.name || 'Serviço'}</span>
        ${badge(appointment.status)}
      </div>
    </div>
  `;
}

/**
 * Renderizar agenda do dia
 */
function renderSchedule(appointments) {
  // Sort by start_at
  const sorted = [...appointments].sort((a, b) => new Date(a.start_at) - new Date(b.start_at));
  
  return sorted.map(a => {
    const start = new Date(a.start_at);
    const time = start.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit', hour12: false });
    
    return `
      <div class="schedule__slot">
        <div class="schedule__time">${time}</div>
        <div class="schedule__event">
          <span class="schedule__customer">${a.customer_name || 'Cliente'}</span>
          <span class="schedule__service">${a.service_name || a.service?.name || 'Serviço'}</span>
          ${badge(a.status)}
        </div>
      </div>
    `;
  }).join('');
}

/**
 * Renderizar marcações recentes
 */
async function renderRecentAppointments() {
  try {
    const data = await apiGet('/api/admin/appointments?limit=5&status=confirmed');
    const appointments = data.data || [];
    
    if (appointments.length === 0) {
      return '<p class="empty-state__text">Não existem marcações recentes</p>';
    }

    return `
      <table class="table">
        <thead>
          <tr>
            <th>Hora</th>
            <th>Cliente</th>
            <th>Serviço</th>
            <th>Preço</th>
            <th>Estado</th>
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
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    `;
  } catch {
    return '<p class="empty-state__text">Erro ao carregar marcações</p>';
  }
}
