/**
 * NAILBOOK — Servidor Principal
 * Entry point da aplicação backend
 * 
 * Versão Fase 3: Backend completo com todos os middlewares
 */

import express from 'express';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

import { join } from 'path';

import { pool } from './config/database.js';
import { AdminUser } from './models/index.js';
import crypto from 'crypto';
import { router as apiRouter } from './routes/index.js';
import { errorHandler } from './middleware/errorHandler.js';
import { generalLimiter as rateLimiter } from './middleware/rateLimiter.js';
import { securityHeaders } from './middleware/security.js';
import { corsMiddleware } from './middleware/cors.js';
import { requestIdMiddleware } from './middleware/requestId.js';
import { csrfTokenResponse, csrfProtection } from './middleware/csrf.js';
import { logger } from './utils/logger.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

const frontendDir = join(__dirname, '..', 'frontend');

// ============================================
// MIDDLEWARES GLOBAIS
// ============================================

// 1. Request ID (primeiro para poder rastrear tudo)
app.use(requestIdMiddleware);

// 2. CORS
app.use(corsMiddleware);

// 3. Headers de segurança
app.use(securityHeaders);

// 4. CSRF Token na resposta (para admin)
app.use(csrfTokenResponse);

// 5. Rate Limiting
app.use(rateLimiter);

// 6. CSRF Protection (para rotas mutativas)
app.use(csrfProtection);

// 7. Body parsing
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: false }));

// ============================================
// HEALTH CHECK
// ============================================

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/health/db', async (req, res) => {
  try {
    const client = await pool.query('SELECT NOW()');
    res.json({
      status: 'ok',
      database: { status: 'connected', latency: `${client.rows[0].now}` },
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    res.status(503).json({
      status: 'degraded',
      database: { status: 'disconnected' },
      timestamp: new Date().toISOString()
    });
  }
});

// ============================================
// STATIC FILES (Frontend Público)
// ============================================

app.use(express.static(frontendDir));

// Páginas públicas
app.get('/', (req, res) => res.sendFile(join(frontendDir, 'index.html')));
app.get('/servicos', (req, res) => res.sendFile(join(frontendDir, 'servicos.html')));
app.get('/privacidade', (req, res) => res.sendFile(join(frontendDir, 'privacidade.html')));
app.get('/termos', (req, res) => res.sendFile(join(frontendDir, 'termos.html')));
app.get('/404', (req, res) => res.sendFile(join(frontendDir, '404.html')));

// Página de sucesso da marcação
app.get('/marcacao/sucesso', (req, res) => res.sendFile(join(frontendDir, 'marcacao/sucesso.html')));
app.get('/marcacao/sucesso.html', (req, res) => res.sendFile(join(frontendDir, 'marcacao/sucesso.html')));

// Página de gestão de marcação por token
app.get('/marcacao/:token', (req, res) => res.sendFile(join(frontendDir, 'marcacao.html')));

// Serve marcacao.html para /marcacao (sem token) como fallback
app.get('/marcacao', (req, res) => res.sendFile(join(frontendDir, 'marcacao.html')));

// ============================================
// API ROUTES (todas sob /api)
// ============================================

app.use('/api', apiRouter);

// ============================================
// ERROR HANDLER (deve ser o último middleware)
// ============================================

app.use(errorHandler);

// ============================================
// ENSURE ADMIN USER
// ============================================

const SALT_SECRET = 'nailbook-secret-key';

function hashPassword(password) {
  return crypto.createHmac('sha256', SALT_SECRET).update(password).digest('hex');
}

async function ensureAdmin() {
  const adminEmail = process.env.ADMIN_EMAIL || 'admin@nailbook.pt';
  const adminPassword = process.env.INITIAL_ADMIN_PASSWORD || 'PasswordSegura123!';
  const adminName = process.env.ADMIN_NAME || 'Admin';

  try {
    const existing = await AdminUser.findByEmail(adminEmail);
    if (!existing) {
      const hash = hashPassword(adminPassword);
      await AdminUser.create({ email: adminEmail, passwordHash: hash, name: adminName, role: 'admin' });
      logger.info(`Default admin created: ${adminEmail}`);
    } else {
      const hash = hashPassword(adminPassword);
      await AdminUser.updatePassword(adminEmail, hash);
      logger.info(`Admin password reset: ${adminEmail}`);
    }
  } catch (err) {
    logger.warn('Could not ensure admin user:', err.message || err);
    console.error('ensureAdmin full error:', err);
  }
}

// ============================================
// START SERVER
// ============================================

async function startServer() {
  try {
    await ensureAdmin();
    const client = await pool.query('SELECT NOW()');
    logger.info(`Database connected: ${client.rows[0].now}`);
    logger.info(`Migration status: Check schema_migrations table`);
  } catch (err) {
    logger.error('Cannot connect to database:', err.message);
    process.exit(1);
  }

  const server = app.listen(PORT, () => {
    logger.info(`Server running on port ${PORT} (${process.env.NODE_ENV || 'development'})`);
    logger.info(`API URL: ${process.env.API_URL || `http://localhost:${PORT}`}`);
    logger.info(`Health check: ${process.env.API_URL || `http://localhost:${PORT}`}/health`);
  });

  return server;
}

// ============================================
// GRACEFUL SHUTDOWN
// ============================================

process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully...');
  pool.end();
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully...');
  pool.end();
  process.exit(0);
});

// Só iniciar o servidor quando executado diretamente
const isMainModule = process.argv[1] === __filename;
if (isMainModule) {
  startServer();
}

// Exportar app e server para testes
export { app, startServer };
