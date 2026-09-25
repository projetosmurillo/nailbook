/**
 * NAILBOOK — Página Principal
 * Carrega contactos e dados dinâmicos da landing page
 */

document.addEventListener('DOMContentLoaded', () => {
  loadSettings();
});

/**
 * Carrega as configurações do negócio (contactos, etc.)
 */
async function loadSettings() {
  try {
    const data = await api.get('/api/settings');
    if (data.success && data.data) {
      const settings = data.data;
      updateContactInfo(settings);
    }
  } catch (e) {
    // Silencioso — a landing page funciona mesmo sem dados
  }
}

/**
 * Atualiza informação de contacto na página
 */
function updateContactInfo(settings) {
  const phoneEl = document.getElementById('contact-phone');
  const emailEl = document.getElementById('contact-email');

  if (phoneEl && settings.business_phone) {
    phoneEl.textContent = settings.business_phone;
  }
  if (emailEl && settings.business_email) {
    emailEl.textContent = settings.business_email;
  }
}
