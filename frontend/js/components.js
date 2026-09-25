/**
 * NAILBOOK — Componentes Reutilizáveis
 * Sistema de componentes para o dashboard administrativo
 */

// ============================================
// BADGE — Estado da marcação
// ============================================

export function badge(status) {
  const labels = {
    confirmed: 'Confirmada',
    cancelled: 'Cancelada',
    completed: 'Concluída',
    no_show: 'Faltou'
  };

  const colors = {
    confirmed: 'badge--success',
    cancelled: 'badge--muted',
    completed: 'badge--info',
    no_show: 'badge--warning'
  };

  return `<span class="badge ${colors[status] || 'badge--muted'}">${labels[status] || status}</span>`;
}

// ============================================
// MODAL — Diálogo de confirmação
// ============================================

export function showModal(title, message, confirmText = 'Confirmar', cancelText = 'Cancelar') {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-labelledby', 'modal-title');

    overlay.innerHTML = `
      <div class="modal">
        <h3 class="modal__title" id="modal-title">${title}</h3>
        <p class="modal__message">${message}</p>
        <div class="modal__actions">
          <button class="btn btn--secondary" id="modal-cancel">${cancelText}</button>
          <button class="btn btn--primary" id="modal-confirm">${confirmText}</button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    const close = (result) => {
      overlay.remove();
      resolve(result);
    };

    overlay.querySelector('#modal-cancel').addEventListener('click', () => close(false));
    overlay.querySelector('#modal-confirm').addEventListener('click', () => close(true));
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) close(false);
    });

    // Focus no botão de confirmar
    overlay.querySelector('#modal-confirm').focus();
  });
}

// ============================================
// TOAST — Notificação temporária
// ============================================

export function showToast(message, type = 'success', duration = 4000) {
  const toast = document.createElement('div');
  toast.className = `toast toast--${type}`;
  toast.setAttribute('role', 'alert');
  toast.textContent = message;

  document.body.appendChild(toast);

  // Trigger animation
  requestAnimationFrame(() => {
    toast.classList.add('toast--visible');
  });

  setTimeout(() => {
    toast.classList.remove('toast--visible');
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

// ============================================
// TABLE — Tabela de dados
// ============================================

export function createTable(headers, rows, actions = []) {
  const table = document.createElement('table');
  table.className = 'table';
  table.setAttribute('role', 'table');

  // Header
  const thead = document.createElement('thead');
  thead.innerHTML = `<tr>${headers.map(h => `<th scope="col">${h}</th>`).join('')}</tr>`;
  table.appendChild(thead);

  // Body
  const tbody = document.createElement('tbody');

  if (rows.length === 0) {
    tbody.innerHTML = `<tr><td colspan="${headers.length + actions.length}" class="table__empty">Não existem registos</td></tr>`;
  } else {
    rows.forEach(row => {
      const tr = document.createElement('tr');
      const cells = headers.map(h => {
        const value = row[h.key] !== undefined ? row[h.key] : '';
        if (h.render) return h.render(value, row);
        return `<td>${value}</td>`;
      });

      // Action buttons
      if (actions.length > 0) {
        cells.push(`<td class="table__actions">${actions.map(a => `<button class="btn btn--small ${a.class || 'btn--secondary'}" data-action="${a.name}" data-id="${row.id}">${a.label}</button>`).join('')}</td>`);
      }

      tr.innerHTML = cells.join('');
      tbody.appendChild(tr);
    });
  }

  table.appendChild(tbody);
  return table;
}

// ============================================
// LOADING STATE
// ============================================

export function showLoading(container, message = 'A carregar...') {
  container.innerHTML = `
    <div class="loading" role="status" aria-live="polite">
      <div class="loading__spinner"></div>
      <p>${message}</p>
    </div>
  `;
}

// ============================================
// EMPTY STATE
// ============================================

export function showEmpty(container, message = 'Não existem registos') {
  container.innerHTML = `
    <div class="empty-state" role="status">
      <svg class="empty-state__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
        <circle cx="12" cy="12" r="10"/>
        <path d="M8 12h8M12 8v8"/>
      </svg>
      <p>${message}</p>
    </div>
  `;
}

// ============================================
// ERROR STATE
// ============================================

export function showError(container, message = 'Erro ao carregar dados') {
  container.innerHTML = `
    <div class="error-state" role="alert">
      <p>${message}</p>
      <button class="btn btn--secondary" id="retry-btn">Tentar novamente</button>
    </div>
  `;

  container.querySelector('#retry-btn')?.addEventListener('click', () => {
    container.dispatchEvent(new CustomEvent('retry'));
  });
}

// ============================================
// FORM GROUP — Input com label
// ============================================

export function formGroup(label, type = 'text', id, value = '', placeholder = '', required = false) {
  return `
    <div class="form-group">
      <label for="${id}" class="form-group__label">${label}</label>
      <input type="${type}" id="${id}" class="form-group__input" 
             value="${value}" placeholder="${placeholder}" ${required ? 'required' : ''}>
    </div>
  `;
}

// ============================================
// DATE PICKER — Simples
// ============================================

export function datePicker(id, value = '', label = 'Data') {
  return `
    <div class="form-group">
      <label for="${id}" class="form-group__label">${label}</label>
      <input type="date" id="${id}" class="form-group__input" value="${value}" required>
    </div>
  `;
}

// ============================================
// TIME INPUT
// ============================================

export function timeInput(id, value = '', label = 'Hora') {
  return `
    <div class="form-group">
      <label for="${id}" class="form-group__label">${label}</label>
      <input type="time" id="${id}" class="form-group__input" value="${value}" required>
    </div>
  `;
}
