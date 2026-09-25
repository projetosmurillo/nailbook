/**
 * NAILBOOK — Rotas Administrativas
 * Estrutura: /api/admin/*
 * Todas requerem autenticação via requireAuth
 */

import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import {
  getAppointments, getAppointmentById, updateAppointment,
  getCustomers, getCustomerById, updateCustomer,
  getServices, createService, getServiceById, updateService, deleteService,
  getBusinessHours, updateBusinessHours,
  getBlockedPeriods, createBlockedPeriod, deleteBlockedPeriod,
  getSettings, updateSettings
} from '../controllers/adminController.js';
import { validateService } from '../validators/adminValidator.js';
import { validateAppointmentUpdate } from '../validators/adminValidator.js';
import { validateBlockedPeriod } from '../validators/adminValidator.js';

const router = Router();

// Todas as rotas aqui requerem autenticação
router.use(requireAuth);

// ============================================
// MARCACOES
// ============================================
router.route('/appointments')
  .get(getAppointments);

router.route('/appointments/:id')
  .get(getAppointmentById)
  .patch(validateAppointmentUpdate, updateAppointment);

// ============================================
// CLIENTES
// ============================================
router.route('/customers')
  .get(getCustomers);

router.route('/customers/:id')
  .get(getCustomerById)
  .patch(updateCustomer);

// ============================================
// SERVIÇOS
// ============================================
router.route('/services')
  .get(getServices)
  .post(validateService, createService);

router.route('/services/:id')
  .get(getServiceById)
  .patch(validateService, updateService)
  .delete(deleteService);

// ============================================
// HORÁRIOS DE FUNCIONAMENTO
// ============================================
router.route('/business-hours')
  .get(getBusinessHours)
  .patch(updateBusinessHours);

// ============================================
// PERÍODOS BLOQUEADOS
// ============================================
router.route('/blocked-periods')
  .get(getBlockedPeriods)
  .post(validateBlockedPeriod, createBlockedPeriod);

router.route('/blocked-periods/:id')
  .delete(deleteBlockedPeriod);

// ============================================
// CONFIGURAÇÕES
// ============================================
router.route('/settings')
  .get(getSettings)
  .patch(updateSettings);

// ============================================
// NOTIFICAÇÕES (admin)
// ============================================
import { getNotifications, getNotificationStats } from '../controllers/notificationController.js';

router.route('/notifications')
  .get(getNotifications);

router.route('/notifications/stats')
  .get(getNotificationStats);

export { router };
