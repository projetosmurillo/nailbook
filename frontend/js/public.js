/* ============================================
   NAILBOOK — JavaScript Público
   Website público para clientes
   ============================================ */

import { apiGet, apiPost } from './api.js';
import { showToast } from './components.js';

// ============================================
// NAVBAR
// ============================================

export function initNavbar() {
  const toggle = document.getElementById('menu-toggle');
  const nav = document.getElementById('navbar-nav');

  if (toggle && nav) {
    toggle.addEventListener('click', () => {
      const isOpen = nav.classList.toggle('navbar__nav--open');
      toggle.setAttribute('aria-expanded', isOpen);
      toggle.textContent = isOpen ? '✕' : '☰';
    });
  }
}

// ============================================
// HOMEPAGE
// ============================================

export async function initHomepage() {
  initNavbar();
  await loadServices(document.getElementById('services-grid'));
  await loadContactInfo();
}

// ============================================
// SERVICOS PAGE
// ============================================

export async function initServicesPage() {
  initNavbar();
  const grid = document.getElementById('services-grid');
  if (grid) {
    await loadServices(grid);
  }
}

// ============================================
// LOAD SERVICES
// ============================================

async function loadServices(container) {
  if (!container) return;

  try {
    const data = await apiGet('/api/services');
    const services = data.data || [];
    const activeServices = services.filter(s => s.active);

    if (activeServices.length === 0) {
      container.innerHTML = '<div class="empty-state"><div class="empty-state__icon">✨</div><p>Nenhum serviço disponível no momento.</p></div>';
      return;
    }

    container.innerHTML = activeServices.map(service => `
      <div class="service-card">
        <h3 class="service-card__name">${escapeHtml(service.name)}</h3>
        <p class="service-card__desc">${escapeHtml(service.description || 'Serviço profissional de qualidade.')}</p>
        <div class="service-card__meta">
          <span class="service-card__price">€${Number(service.price).toFixed(2)}</span>
          <span class="service-card__duration">${service.duration_minutes} min</span>
        </div>
        <button class="service-card__btn" onclick="window.selectService('${service.id}')">Escolher</button>
      </div>
    `).join('');
  } catch (err) {
    container.innerHTML = '<div class="error-state"><p>Erro ao carregar serviços</p><button class="btn btn--secondary" onclick="location.reload()">Tentar novamente</button></div>';
  }
}

// ============================================
// LOAD CONTACT INFO
// ============================================

async function loadContactInfo() {
  const grid = document.getElementById('contact-grid');
  if (!grid) return;

  try {
    const data = await apiGet('/api/settings');
    const settings = data.data || {};

    grid.innerHTML = `
      <div class="contact-item">
        <div class="contact-item__label">Telefone</div>
        <div class="contact-item__value">${escapeHtml(settings.phone || '—')}</div>
      </div>
      <div class="contact-item">
        <div class="contact-item__label">Email</div>
        <div class="contact-item__value">${escapeHtml(settings.email || '—')}</div>
      </div>
      <div class="contact-item">
        <div class="contact-item__label">Localização</div>
        <div class="contact-item__value">${escapeHtml(settings.location || '—')}</div>
      </div>
      <div class="contact-item">
        <div class="contact-item__label">Horário</div>
        <div class="contact-item__value">${escapeHtml(settings.business_hours || '—')}</div>
      </div>
    `;
  } catch {
    // Manter conteúdo estático se a API falhar
  }
}

// ============================================
// UTILITY
// ============================================

function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Expor funções globais
window.loadServices = loadServices;
window.escapeHtml = escapeHtml;
