/* ============================================
   NAILBOOK — Fluxo de Marcação (Fase 6)
   Gestão completa do processo de booking
   ============================================ */

import { apiGet, apiPost } from './api.js';
import { showToast } from './components.js';
import { initNavbar } from './public.js';

// ============================================
// STATE
// ============================================

let bookingState = {
  serviceId: null,
  service: null,
  date: null,
  time: null,
  availableSlots: [],
  currentStep: 1
};

// ============================================
// INIT
// ============================================

export async function initBookingFlow() {
  initNavbar();

  // Check if this is a token-based management page
  const token = getTokenFromURL();
  if (token) {
    // Show management, hide booking
    document.getElementById('booking-app').hidden = true;
    document.getElementById('management-app').hidden = false;
    await initAppointmentManagement(token);
    return;
  }

  // Initialize booking flow
  await loadServicesForBooking();
  setupNavigation();
  setupFormHandlers();
}

export async function initHomepage() {
  initNavbar();
  await loadServices(document.getElementById('services-grid'));
  await loadContactInfo();
}

export async function initServicesPage() {
  initNavbar();
  const grid = document.getElementById('services-grid');
  if (grid) await loadServices(grid);
}

export async function initSuccessPage() {
  initNavbar();
  await loadSuccessDetails();
}

export async function initAppointmentManagement(token) {
  const container = document.getElementById('management-container');
  if (!container) return;

  container.innerHTML = '<div class="loading"><div class="loading__spinner"></div><p>A carregar marcação...</p></div>';

  try {
    const data = await apiGet(`/api/appointments/${token}`);
    const appointment = data.data;

    container.innerHTML = `
      <div class="management__card">
        <div style="text-align: center; margin-bottom: var(--space-xl);">
          <span class="management__badge management__badge--${appointment.status}">${getStatusLabel(appointment.status)}</span>
        </div>
        <h2 style="font-family: var(--font-display); font-size: var(--font-size-xl); text-align: center; margin-bottom: var(--space-xl);">
          ${escapeHtml(appointment.service?.name || 'Serviço')}
        </h2>
        <div style="margin-bottom: var(--space-lg);">
          <div class="summary__row">
            <span class="summary__label">Data</span>
            <span class="summary__value">${formatDate(appointment.start_at)}</span>
          </div>
          <div class="summary__row">
            <span class="summary__label">Hora</span>
            <span class="summary__value">${formatTime(appointment.start_at)}</span>
          </div>
          <div class="summary__row">
            <span class="summary__label">Duração</span>
            <span class="summary__value">${appointment.duration_snapshot_minutes || '?'} min</span>
          </div>
          <div class="summary__row">
            <span class="summary__label">Preço</span>
            <span class="summary__value">€${Number(appointment.price).toFixed(2)}</span>
          </div>
          <div class="summary__row">
            <span class="summary__label">Nome</span>
            <span class="summary__value">${escapeHtml(appointment.customer_name)}</span>
          </div>
          <div class="summary__row">
            <span class="summary__label">Telefone</span>
            <span class="summary__value">${escapeHtml(appointment.customer_phone)}</span>
          </div>
          ${appointment.customer_email ? `
          <div class="summary__row">
            <span class="summary__label">Email</span>
            <span class="summary__value">${escapeHtml(appointment.customer_email)}</span>
          </div>` : ''}
          ${appointment.customer_notes ? `
          <div class="summary__row">
            <span class="summary__label">Observações</span>
            <span class="summary__value">${escapeHtml(appointment.customer_notes)}</span>
          </div>` : ''}
        </div>
        ${appointment.status === 'confirmed' ? `
        <div style="text-align: center;">
          <button class="btn btn--danger btn--full" id="btn-cancel-appointment">Cancelar Marcação</button>
        </div>
        ` : `
        <div style="text-align: center;">
          <p style="color: var(--color-text-muted);">Esta marcação já não pode ser cancelada.</p>
        </div>
        `}
      </div>
    `;

    // Setup cancel button
    const cancelBtn = document.getElementById('btn-cancel-appointment');
    if (cancelBtn) {
      cancelBtn.addEventListener('click', async () => {
        if (!confirm('Tem a certeza que pretende cancelar esta marcação?')) return;

        cancelBtn.disabled = true;
        cancelBtn.textContent = 'A cancelar...';

        try {
          const result = await apiPost(`/api/appointments/${token}/cancel`, {});
          if (result.success) {
            showToast('Marcação cancelada com sucesso', 'success');
            container.innerHTML = `
              <div class="management__card" style="text-align: center;">
                <div class="success__icon" aria-hidden="true">✓</div>
                <h2 class="success__title">Marcação Cancelada</h2>
                <p style="color: var(--color-text-muted); margin-top: var(--space-md);">
                  A sua marcação foi cancelada com sucesso.
                </p>
                <a href="/marcacao" class="btn btn--primary" style="margin-top: var(--space-lg); display: inline-block;">Nova Marcação</a>
              </div>
            `;
          }
        } catch (err) {
          if (err.message && err.message.includes('prazo')) {
            showToast(err.message || 'Esta marcação já não pode ser cancelada online.', 'error');
          } else {
            showToast('Erro ao cancelar. Tente novamente.', 'error');
          }
          cancelBtn.disabled = false;
          cancelBtn.textContent = 'Cancelar Marcação';
        }
      });
    }
  } catch (err) {
    container.innerHTML = `
      <div class="management__card" style="text-align: center;">
        <div class="empty-state__icon" aria-hidden="true">🔍</div>
        <h2 style="font-family: var(--font-display); color: var(--color-primary); margin-bottom: var(--space-md);">
          Não foi possível encontrar esta marcação.
        </h2>
        <p style="color: var(--color-text-muted); margin-bottom: var(--space-lg);">
          O token pode ser inválido ou a marcação foi eliminada.
        </p>
        <a href="/marcacao" class="btn btn--primary">Nova Marcação</a>
      </div>
    `;
  }
}

// ============================================
// NAVIGATION
// ============================================

function setupNavigation() {
  // Back buttons
  document.getElementById('btn-back-2')?.addEventListener('click', () => goToStep(1));
  document.getElementById('btn-back-3')?.addEventListener('click', () => goToStep(2));
  document.getElementById('btn-back-4')?.addEventListener('click', () => goToStep(3));
  document.getElementById('btn-back-5')?.addEventListener('click', () => goToStep(4));

  // Next buttons
  document.getElementById('btn-next-2')?.addEventListener('click', () => goToStep(3));
  document.getElementById('btn-next-3')?.addEventListener('click', () => goToStep(4));

  // Change date button
  document.getElementById('btn-change-date')?.addEventListener('click', () => goToStep(2));

  // Form submission
  document.getElementById('customer-form')?.addEventListener('submit', handleConfirm);

  // Create button
  document.getElementById('btn-create')?.addEventListener('click', handleConfirm);
}

function goToStep(step) {
  bookingState.currentStep = step;

  // Hide all panels
  document.querySelectorAll('.booking-step-panel').forEach(panel => {
    panel.hidden = true;
  });

  // Show target panel
  const targetPanel = document.getElementById(`step-${step}`);
  if (targetPanel) targetPanel.hidden = false;

  // Update step indicators
  document.querySelectorAll('.booking__step').forEach((el, i) => {
    const stepNum = i + 1;
    el.classList.remove('booking__step--active', 'booking__step--done');
    if (stepNum < step) el.classList.add('booking__step--done');
    else if (stepNum === step) el.classList.add('booking__step--active');
  });

  // Scroll to top of booking
  document.getElementById('booking-app')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// ============================================
// SERVICE SELECTION
// ============================================

async function loadServicesForBooking() {
  const container = document.getElementById('booking-services');
  if (!container) return;

  try {
    const data = await apiGet('/api/services');
    const services = (data.data || []).filter(s => s.active);

    if (services.length === 0) {
      container.innerHTML = '<div class="empty-state"><div class="empty-state__icon">✨</div><p>Nenhum serviço disponível no momento.</p></div>';
      return;
    }

    container.innerHTML = services.map(service => `
      <div class="service-card" style="cursor: pointer;" onclick="window.selectService('${service.id}')">
        <h3 class="service-card__name">${escapeHtml(service.name)}</h3>
        <p class="service-card__desc">${escapeHtml(service.description || 'Serviço profissional de qualidade.')}</p>
        <div class="service-card__meta">
          <span class="service-card__price">€${Number(service.price).toFixed(2)}</span>
          <span class="service-card__duration">${service.duration_minutes} min</span>
        </div>
        <button class="service-card__btn" onclick="event.stopPropagation(); window.selectService('${service.id}')">Escolher</button>
      </div>
    `).join('');
  } catch (err) {
    container.innerHTML = '<div class="error-state"><p>Erro ao carregar serviços</p><button class="btn btn--secondary" onclick="location.reload()">Tentar novamente</button></div>';
  }
}

window.selectService = async function(serviceId) {
  try {
    const data = await apiGet(`/api/services/${serviceId}`);
    const service = data.data;

    if (!service || !service.active) {
      showToast('Serviço não disponível', 'error');
      return;
    }

    bookingState.serviceId = serviceId;
    bookingState.service = service;

    // Update step indicator
    goToStep(2);

    // Initialize calendar
    await initCalendar();
  } catch (err) {
    showToast('Erro ao selecionar serviço', 'error');
  }
};

// ============================================
// CALENDAR
// ============================================

async function initCalendar() {
  const container = document.getElementById('calendar-container');
  if (!container) return;

  const today = new Date();
  const currentMonth = today.getMonth();
  const currentYear = today.getFullYear();

  // Set min date to today
  const minDate = new Date(today);
  minDate.setHours(0, 0, 0, 0);

  container.innerHTML = `
    <div class="calendar__header">
      <button class="calendar__nav-btn" id="cal-prev" aria-label="Mês anterior">‹</button>
      <span class="calendar__month" id="cal-month">Carregando...</span>
      <button class="calendar__nav-btn" id="cal-next" aria-label="Próximo mês">›</button>
    </div>
    <div class="calendar__grid" id="cal-grid" role="grid" aria-label="Calendário">
      <div class="calendar__day-name" role="columnheader">Seg</div>
      <div class="calendar__day-name" role="columnheader">Ter</div>
      <div class="calendar__day-name" role="columnheader">Qua</div>
      <div class="calendar__day-name" role="columnheader">Qui</div>
      <div class="calendar__day-name" role="columnheader">Sex</div>
      <div class="calendar__day-name" role="columnheader">Sáb</div>
      <div class="calendar__day-name" role="columnheader">Dom</div>
    </div>
  `;

  const monthNames = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

  function renderCalendar(month, year) {
    const monthEl = document.getElementById('cal-month');
    const gridEl = document.getElementById('cal-grid');
    if (!monthEl || !gridEl) return;

    monthEl.textContent = `${monthNames[month]} ${year}`;

    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Get selected date from state
    const selectedDate = bookingState.date ? new Date(bookingState.date + 'T00:00:00') : null;

    // Clear day cells (keep day names)
    const existingDays = gridEl.querySelectorAll('.calendar__day');
    existingDays.forEach(d => d.remove());

    // Empty cells before first day
    const startDay = firstDay === 0 ? 6 : firstDay - 1; // Monday = 0
    for (let i = 0; i < startDay; i++) {
      const empty = document.createElement('div');
      empty.className = 'calendar__day';
      empty.style.visibility = 'hidden';
      gridEl.appendChild(empty);
    }

    // Day cells
    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const dateObj = new Date(year, month, day);
      dateObj.setHours(0, 0, 0, 0);

      const cell = document.createElement('div');
      cell.className = 'calendar__day';
      cell.textContent = day;
      cell.setAttribute('role', 'gridcell');
      cell.setAttribute('tabindex', '0');
      cell.setAttribute('aria-label', `${formatDateShort(dateStr)}`);
      cell.dataset.date = dateStr;

      // Check if disabled
      if (dateObj < minDate) {
        cell.classList.add('calendar__day--disabled');
        cell.setAttribute('aria-disabled', 'true');
      } else if (selectedDate && dateStr === bookingState.date) {
        cell.classList.add('calendar__day--selected');
        cell.setAttribute('aria-selected', 'true');
      } else if (dateObj.getTime() === today.getTime()) {
        cell.classList.add('calendar__day--today');
      }

      if (!cell.classList.contains('calendar__day--disabled')) {
        cell.addEventListener('click', () => selectDate(dateStr));
        cell.addEventListener('keydown', (e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            selectDate(dateStr);
          }
        });
      }

      gridEl.appendChild(cell);
    }
  }

  function selectDate(dateStr) {
    bookingState.date = dateStr;
    bookingState.time = null;
    bookingState.availableSlots = [];

    // Update calendar
    renderCalendar(currentMonth, currentYear);

    // Update UI
    document.getElementById('selected-date-text').textContent = formatDate(dateStr);
    document.getElementById('btn-next-2').disabled = false;

    // Clear time slots
    const slotsContainer = document.getElementById('time-slots');
    if (slotsContainer) slotsContainer.innerHTML = '';
    document.getElementById('no-slots-message').hidden = true;
  }

  // Navigation
  document.getElementById('cal-prev')?.addEventListener('click', () => {
    let m = currentMonth;
    let y = currentYear;
    m--;
    if (m < 0) { m = 11; y--; }
    renderCalendar(m, y);
  });

  document.getElementById('cal-next')?.addEventListener('click', () => {
    let m = currentMonth;
    let y = currentYear;
    m++;
    if (m > 11) { m = 0; y++; }
    renderCalendar(m, y);
  });

  renderCalendar(currentMonth, currentYear);
}

// ============================================
// TIME SLOTS
// ============================================

window.loadTimeSlots = async function(date) {
  if (!bookingState.serviceId) return;

  const slotsContainer = document.getElementById('time-slots');
  const noSlots = document.getElementById('no-slots-message');
  if (!slotsContainer || !noSlots) return;

  slotsContainer.innerHTML = '<div class="loading"><div class="loading__spinner"></div><p>A consultar horários...</p></div>';
  noSlots.hidden = true;

  try {
    const data = await apiGet(`/api/availability?date=${date}&service_id=${bookingState.serviceId}`);
    const slots = data.data?.availableSlots || data.data?.slots || [];

    bookingState.availableSlots = slots;

    if (slots.length === 0) {
      slotsContainer.innerHTML = '';
      noSlots.hidden = false;
      document.getElementById('btn-next-3').disabled = true;
      return;
    }

    slotsContainer.innerHTML = slots.map(slot => `
      <button class="slot ${bookingState.time === slot ? 'slot--selected' : ''}" 
              onclick="window.selectTime('${slot}')" 
              aria-label="${slot}">
        ${slot}
      </button>
    `).join('');

    document.getElementById('btn-next-3').disabled = true;
  } catch (err) {
    slotsContainer.innerHTML = '<div class="error-state"><p>Erro ao carregar horários</p><button class="btn btn--secondary" onclick="window.loadTimeSlots(\'' + date + '\')">Tentar novamente</button></div>';
  }
};

window.selectTime = function(time) {
  bookingState.time = time;
  document.getElementById('btn-next-3').disabled = false;

  // Update slot buttons
  document.querySelectorAll('.slot').forEach(btn => {
    btn.classList.toggle('slot--selected', btn.textContent === time);
  });
};

// ============================================
// FORM HANDLERS
// ============================================

function setupFormHandlers() {
  // Next from step 2 to 3 (load times)
  document.getElementById('btn-next-2')?.addEventListener('click', async () => {
    if (!bookingState.date) return;
    document.getElementById('selected-date-text').textContent = formatDate(bookingState.date);
    await window.loadTimeSlots(bookingState.date);
    goToStep(3);
  });

  // Next from step 3 to 4 (validate form)
  document.getElementById('btn-next-3')?.addEventListener('click', () => {
    if (!validateStep4()) return;
    goToStep(5);
    updateSummary();
  });
}

function validateStep4() {
  let valid = true;
  const name = document.getElementById('customer-name');
  const phone = document.getElementById('customer-phone');
  const email = document.getElementById('customer-email');
  const notes = document.getElementById('customer-notes');

  // Clear errors
  ['error-name', 'error-phone', 'error-email', 'error-notes'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.textContent = '';
  });

  // Name
  if (!name.value.trim() || name.value.trim().length < 2) {
    document.getElementById('error-name').textContent = 'O nome é obrigatório (mínimo 2 caracteres).';
    name.classList.add('form-group__input--error');
    valid = false;
  } else {
    name.classList.remove('form-group__input--error');
  }

  // Phone
  if (!phone.value.trim() || phone.value.trim().length < 7) {
    document.getElementById('error-phone').textContent = 'O telefone é obrigatório.';
    phone.classList.add('form-group__input--error');
    valid = false;
  } else {
    phone.classList.remove('form-group__input--error');
  }

  // Email (optional but validate if provided)
  if (email.value.trim()) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.value.trim())) {
      document.getElementById('error-email').textContent = 'Formato de email inválido.';
      email.classList.add('form-group__input--error');
      valid = false;
    } else {
      email.classList.remove('form-group__input--error');
    }
  }

  // Notes (max 500)
  if (notes.value.length > 500) {
    document.getElementById('error-notes').textContent = 'Máximo 500 caracteres.';
    notes.classList.add('form-group__input--error');
    valid = false;
  } else {
    notes.classList.remove('form-group__input--error');
  }

  return valid;
}

// ============================================
// SUMMARY & CONFIRM
// ============================================

function updateSummary() {
  const summary = document.getElementById('booking-summary');
  if (!summary) return;

  const service = bookingState.service;
  const date = bookingState.date;
  const time = bookingState.time;

  summary.innerHTML = `
    <div class="summary__row">
      <span class="summary__label">Serviço</span>
      <span class="summary__value">${escapeHtml(service?.name || '—')}</span>
    </div>
    <div class="summary__row">
      <span class="summary__label">Data</span>
      <span class="summary__value">${formatDate(date)}</span>
    </div>
    <div class="summary__row">
      <span class="summary__label">Hora</span>
      <span class="summary__value">${formatTime(date + 'T' + time)}</span>
    </div>
    <div class="summary__row">
      <span class="summary__label">Duração</span>
      <span class="summary__value">${service?.duration_minutes || '?'} min</span>
    </div>
    <div class="summary__row">
      <span class="summary__label">Preço</span>
      <span class="summary__value">€${Number(service?.price || 0).toFixed(2)}</span>
    </div>
    <div class="summary__row">
      <span class="summary__label">Nome</span>
      <span class="summary__value">${escapeHtml(document.getElementById('customer-name').value)}</span>
    </div>
    <div class="summary__row">
      <span class="summary__label">Telefone</span>
      <span class="summary__value">${escapeHtml(document.getElementById('customer-phone').value)}</span>
    </div>
    ${document.getElementById('customer-email').value ? `
    <div class="summary__row">
      <span class="summary__label">Email</span>
      <span class="summary__value">${escapeHtml(document.getElementById('customer-email').value)}</span>
    </div>` : ''}
    ${document.getElementById('customer-notes').value ? `
    <div class="summary__row">
      <span class="summary__label">Observações</span>
      <span class="summary__value">${escapeHtml(document.getElementById('customer-notes').value)}</span>
    </div>` : ''}
  `;

  document.getElementById('btn-create').disabled = false;
}

async function handleConfirm() {
  const btn = document.getElementById('btn-create');
  if (!btn || btn.disabled) return;

  // Disable button
  btn.disabled = true;
  btn.textContent = 'A confirmar...';

  const loading = document.getElementById('booking-loading');
  if (loading) loading.hidden = false;

  const name = document.getElementById('customer-name').value.trim();
  const phone = document.getElementById('customer-phone').value.trim();
  const email = document.getElementById('customer-email').value.trim();
  const notes = document.getElementById('customer-notes').value.trim();

  try {
    const result = await apiPost('/api/appointments', {
      service_id: bookingState.serviceId,
      date: bookingState.date,
      time: bookingState.time,
      customer_name: name,
      customer_phone: phone,
      customer_email: email || '',
      notes: notes || ''
    });

    if (result.success) {
      const token = result.data?.token;
      showToast('Marcação criada com sucesso!', 'success');
      window.location.href = `/marcacao/sucesso.html${token ? `?token=${token}` : ''}`;
    }
  } catch (err) {
    if (loading) loading.hidden = true;
    btn.disabled = false;
    btn.textContent = 'Confirmar marcação';

    if (err.message && err.includes('Horário') || err.message?.includes('disponível') || err.message?.includes('409')) {
      document.getElementById('conflict-banner').hidden = false;
      showToast('Este horário acabou de ser reservado. Escolha outro.', 'error');
    } else if (err.message && err.includes('prazo')) {
      showToast('Não é possível cancelar a menos de 24 horas da marcação.', 'error');
    } else {
      showToast('Erro ao criar marcação. Tente novamente.', 'error');
    }
  }
}

// ============================================
// SUCCESS PAGE
// ============================================

async function loadSuccessDetails() {
  const details = document.getElementById('success-details');
  if (!details) return;

  // Check for token in URL
  const params = new URLSearchParams(window.location.search);
  const token = params.get('token');

  if (!token) {
    details.innerHTML = '<p style="color: var(--color-text-muted);">A sua marcação foi criada com sucesso.</p>';
    return;
  }

  try {
    const data = await apiGet(`/api/appointments/${token}`);
    const app = data.data;

    details.innerHTML = `
      <div class="success__detail-row">
        <span class="summary__label">Serviço</span>
        <span class="summary__value">${escapeHtml(app.service?.name || '—')}</span>
      </div>
      <div class="success__detail-row">
        <span class="summary__label">Data</span>
        <span class="summary__value">${formatDate(app.start_at)}</span>
      </div>
      <div class="success__detail-row">
        <span class="summary__label">Hora</span>
        <span class="summary__value">${formatTime(app.start_at)}</span>
      </div>
      <div class="success__detail-row">
        <span class="summary__label">Duração</span>
        <span class="summary__value">${app.duration_snapshot_minutes || '?'} min</span>
      </div>
      <div class="success__detail-row">
        <span class="summary__label">Preço</span>
        <span class="summary__value">€${Number(app.price).toFixed(2)}</span>
      </div>
      <div class="success__detail-row">
        <span class="summary__label">Token</span>
        <span class="summary__value" style="font-size: var(--font-size-xs); word-break: break-all;">${token}</span>
      </div>
      <div style="margin-top: var(--space-lg); display: flex; gap: var(--space-md); justify-content: center; flex-wrap: wrap;">
        <a href="/marcacao/${token}/calendar.ics" class="btn btn--secondary" download="nailbook-${token}.ics">📅 Adicionar ao Calendário</a>
        <a href="/marcacao/${token}/calendar" class="btn btn--primary">📅 Google Calendar</a>
      </div>
    `;
  } catch {
    details.innerHTML = '<p style="color: var(--color-text-muted);">A sua marcação foi criada com sucesso.</p>';
  }
}

// ============================================
// CONTACT INFO (Homepage)
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
    grid.innerHTML = '';
  }
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

function formatDate(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  return d.toLocaleDateString('pt-PT', { day: '2-digit', month: 'long', year: 'numeric' });
}

function formatTime(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  return d.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit', hour12: false });
}

function formatDateShort(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  const days = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];
  return `${days[d.getDay()]} ${d.getDate()}`;
}

function getStatusLabel(status) {
  const labels = { confirmed: 'Confirmada', cancelled: 'Cancelada', completed: 'Concluída', no_show: 'Faltou' };
  return labels[status] || status;
}

function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function getTokenFromPath() {
  const path = window.location.pathname;
  const match = path.match(/\/marcacao\/([a-f0-9-]+)/);
  return match ? match[1] : null;
}

// Expose globally for onclick handlers
window.selectService = window.selectService || function() {};
window.selectTime = window.selectTime || function() {};
window.loadTimeSlots = window.loadTimeSlots || function() {};
