/**
 * NAILBOOK — Admin Entry Point (Fase 5)
 * Ponto de entrada para o dashboard administrativo
 */

import { initAdminLayout } from './layout.js';
import { initDashboard } from './dashboard.js';
import { initAppointments } from './appointments.js';
import { initServices } from './services.js';
import { initCustomers } from './customers.js';
import { initBusinessHours } from './business-hours.js';
import { initBlockedPeriods } from './blocked-periods.js';
import { initSettings } from './settings.js';

/**
 * Inicializar o sistema administrativo completo
 */
export function initAdmin() {
  initAdminLayout();
  initDashboard();
  initAppointments();
  initServices();
  initCustomers();
  initBusinessHours();
  initBlockedPeriods();
  initSettings();
}
