/**
 * NAILBOOK — API Client
 * Funções genéricas para comunicação com o backend
 * Suporta autenticação via cookies httpOnly e CSRF protection
 */

const API_BASE = window._API_URL || '';

/**
 * Faz um request HTTP para a API
 */
async function apiCall(path, options = {}) {
  const url = `${API_BASE}${path}`;

  const config = {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    credentials: 'include',
    ...options,
  };

  // Adicionar CSRF token para requests mutativos
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(config.method)) {
    const csrfToken = getCsrfToken();
    if (csrfToken) {
      config.headers['X-CSRF-Token'] = csrfToken;
    }
  }

  try {
    const response = await fetch(url, config);

    if (response.status === 401) {
      window.dispatchEvent(new CustomEvent('session-expired'));
      throw new Error('Sessão expirada');
    }

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Erro na requisição');
    }

    return data;
  } catch (error) {
    if (error.message === 'Sessão expirada') {
      throw error;
    }
    console.error(`API Error [${options.method || 'GET'} ${path}]:`, error);
    throw error;
  }
}

function getCsrfToken() {
  const match = document.cookie.match(/csrf_token=([^;]+)/);
  return match ? match[1] : null;
}

export async function apiGet(path) {
  return apiCall(path, { method: 'GET' });
}

export async function apiPost(path, body) {
  return apiCall(path, { method: 'POST', body: JSON.stringify(body) });
}

export async function apiPatch(path, body) {
  return apiCall(path, { method: 'PATCH', body: JSON.stringify(body) });
}

export async function apiDelete(path) {
  return apiCall(path, { method: 'DELETE' });
}

// Sessão expirada handler
window.addEventListener('session-expired', () => {
  window.location.href = 'login.html';
});

// Expor globalmente
window.api = { get: apiGet, post: apiPost, patch: apiPatch, delete: apiDelete };
