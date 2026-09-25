/**
 * NAILBOOK — Rotas de Marcações
 * Estrutura: /api/appointments/*
 * Todas as rotas são montadas sob /api pelo server.js
 */

import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { appointmentController } from '../controllers/appointmentController.js';

const router = Router();

// Marcações admin
router.get('/appointments', requireAuth, appointmentController.getAll);
router.get('/appointments/:id', requireAuth, appointmentController.getById);

export { router };
