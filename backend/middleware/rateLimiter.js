/**
 * NAILBOOK — Rate Limiter
 */

import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';

dotenv.config();

// Limite geral para todas as rotas
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 100, // Máximo 100 requests por janela
  message: { error: 'Muitos pedidos. Tente novamente mais tarde.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Limite mais restrito para login
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 5, // Máximo 5 tentativas de login
  message: { error: 'Muitas tentativas de login. Tente novamente em 15 minutos.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Limite para criação de marcações
const bookingLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hora
  max: 20, // Máximo 20 marcações por hora
  message: { error: 'Limite de marcações atingido. Tente novamente mais tarde.' },
  standardHeaders: true,
  legacyHeaders: false,
});

export { generalLimiter, loginLimiter, bookingLimiter };
