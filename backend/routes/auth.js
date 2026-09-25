/**
 * NAILBOOK — Rotas de Autenticação Administrativa
 * Estrutura: /api/admin/auth/*
 */

import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { adminLogin, adminLogout, getAdminProfile } from '../controllers/adminController.js';
import { loginLimiter } from '../middleware/rateLimiter.js';
import { validateLogin } from '../validators/adminValidator.js';

const router = Router();

// Login (público, com rate limiting)
router.post('/login', loginLimiter, validateLogin, adminLogin);

// Logout (requer autenticação)
router.post('/logout', requireAuth, adminLogout);

// Perfil (requer autenticação)
router.get('/me', requireAuth, getAdminProfile);

export { router };
