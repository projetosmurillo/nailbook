/**
 * NAILBOOK — Layout Administrativo Compartilhado
 * Template do layout para todas as páginas admin
 */

import { initRouter, navigate } from './admin-router.js';
import { requireAdmin } from './admin-router.js';

/**
 * Gerar o layout administrativo
 */
export function renderLayout(pageContent) {
  return `
    <div class="admin-layout">
      <aside class="admin-layout__sidebar">
        ${renderSidebar()}
      </aside>
      <main class="admin-layout__main">
        ${renderHeader()}
        <div id="page-content">
          ${pageContent}
        </div>
      </main>
    </div>
  `;
}

/**
 * Sidebar navigation
 */
function renderSidebar() {
  const items = [
    { id: 'dashboard', label: 'Dashboard', icon: '📊' },
    { id: 'appointments', label: 'Marcações', icon: '📅' },
    { id: 'services', label: 'Serviços', icon: '💅' },
    { id: 'customers', label: 'Clientes', icon: '👥' },
    { id: 'business-hours', label: 'Horários', icon: '🕐' },
    { id: 'blocked-periods', label: 'Bloqueados', icon: '🚫' },
    { id: 'settings', label: 'Definições', icon: '⚙️' }
  ];

  return `
    <div class="sidebar">
      <div class="sidebar__brand">
        <span class="sidebar__brand-text">NailBook</span>
      </div>
      <ul class="sidebar__nav" id="sidebar-nav">
        ${items.map(item => `
          <li class="sidebar__nav-item">
            <a href="#${item.id}" class="sidebar__nav-link" data-page="${item.id}">
              <span class="sidebar__nav-icon">${item.icon}</span>
              ${item.label}
            </a>
          </li>
        `).join('')}
      </ul>
      <div style="padding: var(--space-md); margin-top: var(--space-xl); border-top: 1px solid var(--color-border);">
        <button class="btn btn--secondary btn--block" id="sidebar-logout">Sair</button>
      </div>
    </div>
  `;
}

/**
 * Header com título e info do utilizador
 */
function renderHeader() {
  return `
    <header class="admin-header">
      <div>
        <button class="menu-toggle" id="menu-toggle" aria-label="Menu">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path d="M3 12h18M3 6h18M3 18h18"/>
          </svg>
        </button>
        <h1 class="admin-header__title" id="page-title">Dashboard</h1>
      </div>
      <div class="admin-header__user">
        <span class="admin-header__name" id="user-name">Administrador</span>
        <button class="btn btn--small btn--secondary" id="header-logout">Sair</button>
      </div>
    </header>
  `;
}

/**
 * Inicializar o layout admin
 */
export function initAdminLayout() {
  initRouter((page) => {
    loadPage(page);
  });

  // Setup sidebar nav
  document.addEventListener('click', (e) => {
    if (e.target.classList.contains('sidebar__nav-link') || e.target.closest('.sidebar__nav-link')) {
      const link = e.target.classList.contains('sidebar__nav-link') ? e.target : e.target.closest('.sidebar__nav-link');
      const page = link.dataset.page;
      if (page) navigate(page);
    }
  });

  // Logout
  document.addEventListener('click', (e) => {
    if (e.target.id === 'sidebar-logout' || e.target.id === 'header-logout') {
      handleLogout();
    }
  });

  // Mobile menu toggle
  document.addEventListener('click', (e) => {
    if (e.target.id === 'menu-toggle') {
      document.querySelector('.sidebar__nav')?.classList.toggle('sidebar__nav--open');
    }
  });
}

/**
 * Carregar uma página
 */
async function loadPage(page) {
  const content = document.getElementById('page-content');
  if (!content) return;

  const titles = {
    dashboard: 'Dashboard',
    appointments: 'Marcações',
    services: 'Serviços',
    customers: 'Clientes',
    business-hours: 'Horários',
    blocked-periods: 'Períodos Bloqueados',
    settings: 'Definições'
  };

  document.getElementById('page-title').textContent = titles[page] || 'Dashboard';

  // Highlight active nav
  document.querySelectorAll('.sidebar__nav-link').forEach(link => {
    link.classList.toggle('sidebar__nav-link--active', link.dataset.page === page);
  });

  try {
    const adminData = await requireAdmin();
    if (!adminData) return;

    document.getElementById('user-name').textContent = adminData.name || adminData.email;

    // Load page-specific content
    const module = await import(`./admin/${page}.js`);
    if (module && module.load) {
      content.innerHTML = '';
      await module.load(content);
    }
  } catch (err) {
    content.innerHTML = `
      <div class="error-state">
        <p>Sessão expirada. <a href="#login">Faça login novamente</a></p>
      </div>
    `;
  }
}

/**
 * Logout handler
 */
async function handleLogout() {
  try {
    await apiPost('/api/admin/auth/logout', {});
  } catch {
    // Ignore errors
  }
  window.location.hash = 'login';
  navigate('login');
}
