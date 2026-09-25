/**
 * NAILBOOK — Middleware de Segurança
 */

import helmet from 'helmet';
import dotenv from 'dotenv';

dotenv.config();

export const securityHeaders = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'"],
    },
  },
  hsts: {
    maxAge: 31536000, // 1 ano
    includeSubDomains: true,
    preload: true,
  },
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  frameguard: { action: 'deny' },
  xssFilter: true,
  noSniff: true,
  dnsPrefetchControl: { allow: false },
});

/**
 * Middleware que garante que respostas de erro nunca expõem stack traces em produção
 */
export const sanitizeError = (err) => {
  const isProduction = process.env.NODE_ENV === 'production';

  return {
    error: err.message || 'Erro interno do servidor',
    ...(isProduction ? {} : { stack: err.stack }),
    code: err.code || null,
    details: err.details || null,
  };
};
