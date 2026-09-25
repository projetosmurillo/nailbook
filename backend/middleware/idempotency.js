/**
 * NAILBOOK — Middleware de Idempotência
 * Previne que retries criem recursos duplicados
 *
 * Uso:
 * Cliente envia header Idempotency-Key com valor único
 * O servidor verifica se já processou aquela chave
 * Se sim, retorna a resposta original sem criar duplicata
 */

import { v4 as uuid } from 'uuid';
import { logger } from '../utils/logger.js';

// Store simples para idempotency keys (em produção, usar Redis)
const idempotencyStore = new Map();

// TTL para idempotency keys (1 hora)
const IDEMPOTENCY_TTL_MS = 60 * 60 * 1000;

/**
 * Middleware de idempotência
 * Verifica se a request já foi processada com o mesmo Idempotency-Key
 */
export function idempotencyMiddleware(req, res, next) {
  const idempotencyKey = req.headers['idempotency-key'];

  // Se não há chave idempotência, passar adiante
  if (!idempotencyKey) {
    return next();
  }

  // Verificar se a chave já existe
  const existing = idempotencyStore.get(idempotencyKey);

  if (existing) {
    // Verificar se expirou
    if (Date.now() - existing.timestamp > IDEMPOTENCY_TTL_MS) {
      idempotencyStore.delete(idempotencyKey);
      return next(); // Processar novamente
    }

    // Retornar resposta original
    logger.info(`Idempotency key hit: ${idempotencyKey}`, { requestId: req.requestId });
    return res.status(existing.statusCode).json(existing.body);
  }

  // Guardar referência para futura verificação
  // O response será interceptado para guardar o resultado
  const originalJson = res.json.bind(res);
  res.json = (body) => {
    idempotencyStore.set(idempotencyKey, {
      body,
      statusCode: res.statusCode,
      timestamp: Date.now()
    });

    // Limpar entradas expiradas periodicamente
    if (idempotencyStore.size > 10000) {
      const now = Date.now();
      for (const [key, value] of idempotencyStore) {
        if (now - value.timestamp > IDEMPOTENCY_TTL_MS) {
          idempotencyStore.delete(key);
        }
      }
    }

    return originalJson(body);
  };

  next();
}

/**
 * Limpar entradas expiradas (chamado periodicamente)
 */
export function cleanupIdempotencyStore() {
  const now = Date.now();
  let cleaned = 0;
  for (const [key, value] of idempotencyStore) {
    if (now - value.timestamp > IDEMPOTENCY_TTL_MS) {
      idempotencyStore.delete(key);
      cleaned++;
    }
  }
  if (cleaned > 0) {
    logger.info(`Cleaned ${cleaned} expired idempotency keys`);
  }
}

// Limpar a cada 5 minutos
setInterval(cleanupIdempotencyStore, 5 * 60 * 1000);
