/**
 * NAILBOOK — Rotas da API
 * Todas as rotas são montadas sob /api pelo server.js
 * Este ficheiro NÃO adiciona prefixo /api adicional
 */

import { Router } from 'express';
import { router as publicRoutes } from './public.js';
import { router as appointmentsRoutes } from './appointments.js';
import { router as adminRoutes } from './admin.js';
import { router as authRoutes } from './auth.js';
import { serveDocs } from '../docs/openapi.js';

export const router = Router();

// Rotas públicas
router.use('/', publicRoutes);

// Rotas de marcações (públicas)
router.use('/', appointmentsRoutes);

// Rotas administrativas (requerem autenticação)
router.use('/', authRoutes);
router.use('/', adminRoutes);

// Documentação OpenAPI
router.get('/docs', serveDocs);

// Rotas desconhecidas (404 catch-all)
router.use('*', (req, res) => {
  res.status(404).json({ error: { code: 'ROUTE_NOT_FOUND', message: 'Rota não encontrada' } });
});
