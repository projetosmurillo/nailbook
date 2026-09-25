/**
 * NAILBOOK — Autenticação Admin (Fase 5)
 * Atualizado para funcionar com o novo sistema de admin layout
 */

import { apiPost, apiGet } from './api.js';
import { showToast } from './components.js';

document.addEventListener('DOMContentLoaded', () => {
  setupLoginForm();
  checkAuthStatus();
  setupLogout();
});

/**
 * Configura o formulário de login
 */
function setupLoginForm() {
  const form = document.getElementById('login-form');
  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const email = document.getElementById('admin-email').value.trim();
    const password = document.getElementById('admin-password').value;

    const errorEl = document.getElementById('login-error');
    errorEl.textContent = '';

    const btn = document.getElementById('login-btn');
    if (btn) {
      btn.disabled = true;
      btn.textContent = 'A entrar...';
    }

    try {
      const data = await apiPost('/api/admin/auth/login', { email, password });
      
      if (data.success) {
        showToast('Bem-vindo ao Painel Administrativo', 'success');
        window.location.href = 'dashboard.html';
      } else {
        errorEl.textContent = data.error || 'Login falhou';
      }
    } catch (err) {
      errorEl.textContent = err.message || 'Email ou password inválidos.';
      showToast(err.message || 'Erro no login', 'error');
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.textContent = 'Entrar';
      }
    }
  });
}

/**
 * Verificar se já está autenticado
 */
async function checkAuthStatus() {
  try {
    const data = await apiPost('/api/admin/auth/me', {});
    if (data.success) {
      window.location.href = 'dashboard.html';
    }
  } catch {
    // Not authenticated, show login form
  }
}

/**
 * Configurar logout
 */
function setupLogout() {
  const logoutBtn = document.getElementById('btn-logout');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
      try {
        await apiPost('/api/admin/auth/logout', {});
      } catch {
        // Ignore errors
      }
      window.location.href = 'login.html';
    });
  }
}
