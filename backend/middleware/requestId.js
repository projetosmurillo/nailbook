/**
 * NAILBOOK — Middleware de Request ID
 * Gera um ID único para cada request para tracking e logging
 */

import { randomUUID } from 'crypto';
import { logger } from '../utils/logger.js';

/**
 * Middleware que adiciona um requestId ao header e ao logger
 */
export function requestIdMiddleware(req, res, next) {
  const requestId = randomUUID();
  req.requestId = requestId;
  res.setHeader('X-Request-ID', requestId);

  // Log de início da request
  logger.info(`[${requestId}] ${req.method} ${req.path}`, {
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    body: req.body
  });

  // Log de fim da response
  const startTime = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    logger.info(`[${requestId}] ${req.method} ${req.path} ${res.statusCode} ${duration}ms`, {
      requestId,
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      duration
    });
  });

  next();
}

/**
 * Middleware que adiciona headers de segurança adicionais
 */
export function securityHeadersMiddleware(req, res, next) {
  // Headers que não podem ser cobertos pelo helmet
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  next();
}

/**
 * Middleware que bloqueia requests com content-type inválido
 */
export function contentTypeValidator(req, res, next) {
  if (['POST', 'PUT', 'PATCH'].includes(req.method)) {
    const contentType = req.get('Content-Type');
    if (contentType && !contentType.includes('application/json')) {
      return res.status(415).json({
        error: { code: 'UNSUPPORTED_MEDIA_TYPE', message: 'Content-Type deve ser application/json' }
      });
    }
  }
  next();
}
