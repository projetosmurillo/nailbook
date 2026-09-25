/**
 * NAILBOOK — Router Administrativo
 * Navegação simples entre páginas admin
 */

const routes = {
  '': 'dashboard',
  'dashboard': 'dashboard',
  'appointments': 'appointments',
  'services': 'services',
  'customers': 'customers',
  'business-hours': 'business-hours',
  'blocked-periods': 'blocked-periods',
  'settings': 'settings'
};

let currentPage = 'dashboard';

/**
 * Navegar para uma página
 */
export function navigate(page) {
  if (!routes[page]) page = 'dashboard';
  window.location.hash = page;
  currentPage = page;
}

/**
 * Obter página atual
 */
export function getCurrentPage() {
  return currentPage;
}

/**
 * Inicializar router
 */
export function initRouter(onPageChange) {
  // Hash change
  window.addEventListener('hashchange', () => {
    const hash = window.location.hash.slice(1) || '';
    const page = routes[hash] || 'dashboard';
    if (page !== currentPage) {
      currentPage = page;
      onPageChange(page);
    }
  });

  // Initial route
  const hash = window.location.hash.slice(1) || '';
  const page = routes[hash] || 'dashboard';
  currentPage = page;
  onPageChange(page);
}

/**
 * Verificar se está numa página admin
 */
export function isAdminPage() {
  return window.location.pathname.includes('/admin/') || 
         window.location.pathname.includes('dashboard.html') ||
         window.location.hash.includes('admin');
}

/**
 * Proteger página admin — redirecionar se não autenticado
 */
export async function requireAdmin() {
  try {
    const data = await apiGet('/api/admin/me');
    if (data.success) return data.data;
  } catch {
    // Not authenticated
  }
  window.location.hash = 'login';
  return null;
}
