/**
 * NAILBOOK — Middleware de CSRF Protection
 * Proteção CSRF para cookies com autenticação administrativa
 *
 * Estratégia:
 * 1. SameSite=Strict nos cookies
 * 2. Verificação de origem no CORS
 * 3. Para rotas mutativas (POST, PATCH, DELETE), verificar header X-CSRF-Token
 * 4. O token CSRF é gerado na resposta do login e enviado no cookie
 */

import { randomUUID } from 'crypto';
import { logger } from '../utils/logger.js';

/**
 * Gerar token CSRF
 */
export function generateCsrfToken() {
  return randomUUID();
}

/**
 * Middleware CSRF para rotas administrativas mutativas
 */
export function csrfProtection(req, res, next) {
  // Apenas métodos mutativos precisam de verificação CSRF
  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
    return next();
  }

  const csrfToken = req.headers['x-csrf-token'];
  const cookieToken = req.cookies?.csrf_token;

  // Se não há token no cookie, gerar um (primeira visita)
  if (!cookieToken) {
    const newToken = generateCsrfToken();
    res.cookie('csrf_token', newToken, {
      httpOnly: false,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 3600000 // 1 hora
    });
  }

  // Se o token não corresponde, rejeitar
  if (csrfToken && cookieToken && csrfToken !== cookieToken) {
    logger.warn('CSRF token mismatch', { requestId: req.requestId });
    return res.status(403).json({
      error: { code: 'CSRF_TOKEN_INVALID', message: 'Token CSRF inválido' }
    });
  }

  // Adicionar token ao request para uso posterior
  req.csrfToken = cookieToken || csrfToken;
  next();
}

/**
 * Middleware que retorna o token CSRF na resposta
 */
export function csrfTokenResponse(req, res, next) {
  if (!req.cookies?.csrf_token) {
    const token = generateCsrfToken();
    res.cookie('csrf_token', token, {
      httpOnly: false,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 3600000
    });
  }
  res.setHeader('X-CSRF-Token', req.cookies?.csrf_token || '');
  next();
}
