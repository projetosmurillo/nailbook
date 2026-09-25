/**
 * NAILBOOK — Serviços (Frontend)
 * Carrega e exibe serviços na landing page e no booking
 */

document.addEventListener('DOMContentLoaded', () => {
  loadServices();
});

/**
 * Carrega os serviços ativos e preenche a grid
 */
async function loadServices() {
  const grid = document.getElementById('services-grid');
  if (!grid && !document.getElementById('booking-services')) return;

  try {
    const data = await api.get('/api/services');

    if (data.success && data.data) {
      renderServices(data.data, grid || document.getElementById('booking-services'));
    }
  } catch (error) {
    console.error('Erro ao carregar serviços:', error);
    if (grid) {
      grid.innerHTML = '<p>Erro ao carregar serviços. Tente novamente.</p>';
    }
  }
}

/**
 * Renderiza os cards de serviço
 * Novo schema: price é NUMERIC(10,2), duration_minutes é o campo
 */
function renderServices(services, container) {
  if (!services || services.length === 0) {
    container.innerHTML = '<p>Nenhum serviço disponível no momento.</p>';
    return;
  }

  container.innerHTML = services
    .filter(s => s.active)
    .map(service => `
      <div class="service-card" data-service-id="${service.id}" data-service-name="${escapeHtml(service.name)}" data-service-duration="${service.duration_minutes}" data-service-price="${service.price}">
        <h3 class="service-card__name">${escapeHtml(service.name)}</h3>
        <p class="service-card__description">${escapeHtml(service.description || 'Sem descrição')}</p>
        <div class="service-card__meta">
          <span class="service-card__price">${formatPrice(service.price)}</span>
          <span class="service-card__duration">${service.duration_minutes} min</span>
        </div>
      </div>
    `).join('');
}

/**
 * Formata preço (agora é NUMERIC direto, ex: 25.00)
 */
function formatPrice(price) {
  return `€${Number(price).toFixed(2)}`;
}

/**
 * Escape HTML para prevenir XSS
 */
function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Expor para uso global
window.services = { load: loadServices, formatPrice };
