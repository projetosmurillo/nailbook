/**
 * NAILBOOK — Middleware de Autenticação JWT
 */

import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import { AdminUser } from '../models/index.js';
import { logger } from '../utils/logger.js';

dotenv.config();

/**
 * Middleware que verifica o JWT no cookie
 * Protege todas as rotas administrativas
 */
export function requireAuth(req, res, next) {
  const token = req.cookies?.access_token;

  if (!token) {
    return res.status(401).json({ error: 'Autenticação necessária' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded; // { id, email }
    next();
  } catch (err) {
    logger.warn('Token inválido ou expirado');
    return res.status(401).json({ error: 'Sessão inválida. Faça login novamente.' });
  }
}

/**
 * Gera o par de tokens JWT
 */
export function generateTokens(userId, email) {
  const accessToken = jwt.sign(
    { id: userId, email },
    process.env.JWT_SECRET,
    { expiresIn: '15m' }
  );

  const refreshToken = jwt.sign(
    { id: userId },
    process.env.JWT_REFRESH_SECRET,
    { expiresIn: '7d' }
  );

  return { accessToken, refreshToken };
}

/**
 * Gera tokens puros (para testes ou funções internas)
 */
export function generateTokensForUser(user) {
  const accessToken = jwt.sign(
    { id: user.id, email: user.email },
    process.env.JWT_SECRET,
    { expiresIn: '15m' }
  );

  return { accessToken };
}
