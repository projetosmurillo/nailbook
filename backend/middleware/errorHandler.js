/**
 * NAILBOOK — Error Handler Centralizado
 */

import { logger } from '../utils/logger.js';
import { sanitizeError } from './security.js';

/**
 * Middleware de tratamento de erros
 * Deve ser o último middleware registrado
 */
export function errorHandler(err, req, res, next) {
  // Log do erro
  logger.error(`${err.method} ${err.path} - ${err.message}`, {
    stack: err.stack,
    body: req.body,
    userId: req.user?.id,
  });

  // Tipos de erro conhecidos
  const error = sanitizeError(err);

  // Códigos de erro HTTP específicos
  const statusCode = err.statusCode || err.status || 500;

  // Não expor detalhes de erro em produção
  const response = process.env.NODE_ENV === 'production'
    ? { error: err.message || 'Erro interno do servidor' }
    : { error: err.message || 'Erro interno do servidor', details: err.details };

  res.status(statusCode).json(response);
}

/**
 * Handler para rotas não encontradas
 */
export function notFoundHandler(req, res) {
  res.status(404).json({ error: 'Rota não encontrada' });
}
