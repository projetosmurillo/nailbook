/**
 * NAILBOOK — Dashboard Administrativo (Fase 5)
 * Versão legada — substituída por js/admin/dashboard.js
 * Mantido para compatibilidade com o dashboard.html antigo
 */

document.addEventListener('DOMContentLoaded', () => {
  initDashboard();
});

let adminData = null;

async function initDashboard() {
  try {
    const data = await api.get('/api/admin/me');
    if (data.success) {
      adminData = data.data;
      showDashboard();
      loadDashboardData();
    }
  } catch {
    showAuthGate();
  }

  setupTabs();
  setupLogout();
  setupServiceForm();
}

function showDashboard() {
  const authGate = document.getElementById('auth-gate');
  const dashboardContent = document.getElementById('dashboard-content');
  if (authGate) authGate.hidden = true;
  if (dashboardContent) dashboardContent.hidden = false;

  const userNameEl = document.getElementById('user-name');
  if (userNameEl && adminData) {
    userNameEl.textContent = adminData.name || adminData.email || 'Administrador';
  }
}

function showAuthGate() {
  const authGate = document.getElementById('auth-gate');
  const dashboardContent = document.getElementById('dashboard-content');
  if (authGate) authGate.hidden = false;
  if (dashboardContent) dashboardContent.hidden = true;
}

async function loadDashboardData() {
  try {
    const [appointments, services, customers] = await Promise.all([
      api.get('/api/admin/appointments?limit=1'),
      api.get('/api/admin/services'),
      api.get('/api/admin/customers')
    ]);

    const todayEl = document.getElementById('metric-today');
    const weekEl = document.getElementById('metric-week');
    const clientsEl = document.getElementById('metric-clients');
    const servicesEl = document.getElementById('metric-services');

    if (todayEl) todayEl.textContent = appointments.data?.length || 0;
    if (weekEl) weekEl.textContent = appointments.data?.length || 0;
    if (clientsEl) clientsEl.textContent = customers.data?.length || 0;
    if (servicesEl) servicesEl.textContent = services.data?.length || 0;
  } catch (err) {
    console.error('Erro ao carregar dados do dashboard:', err);
  }
}

function setupTabs() {
  const tabs = document.querySelectorAll('.dashboard__tab');
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('dashboard__tab--active'));
      tab.classList.add('dashboard__tab--active');
      const tabId = tab.dataset.tab;
      document.querySelectorAll('.dashboard__tab-panel').forEach(panel => {
        panel.hidden = panel.id !== `tab-${tabId}`;
      });
    });
  });
}

function setupLogout() {
  const logoutBtn = document.getElementById('btn-logout');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
      try {
        await fetch('/api/admin/auth/logout', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' }
        });
      } catch { /* Ignore */ }
      window.location.href = 'login.html';
    });
  }
}

function setupServiceForm() {
  const form = document.getElementById('service-form');
  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('service-name').value.trim();
    const description = document.getElementById('service-description').value.trim();
    const price = parseFloat(document.getElementById('service-price').value);
    const duration = parseInt(document.getElementById('service-duration').value);
    const active = document.getElementById('service-active').checked;

    if (!name || !price || !duration) {
      showToast('Preencha todos os campos obrigatórios', 'error');
      return;
    }

    try {
      const data = await api.post('/api/admin/services', { name, description, price, duration_minutes: duration, active });
      if (data.success) { showToast('Serviço criado com sucesso', 'success'); loadDashboardData(); form.reset(); }
    } catch (err) { showToast('Erro ao criar serviço', 'error'); }
  });
}

window.initDashboard = initDashboard;
window.showToast = (msg, type) => {
  const toast = document.createElement('div');
  toast.className = `toast toast--${type || 'success'}`;
  toast.textContent = msg;
  document.body.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add('toast--visible'));
  setTimeout(() => { toast.classList.remove('toast--visible'); setTimeout(() => toast.remove(), 300); }, 3000);
};
