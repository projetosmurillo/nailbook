/**
 * NAILBOOK — Serviço de Prevenção de Double Booking
 * Combina 3 camadas de proteção
 */

import { Appointment } from '../models/index.js';
import { logger } from '../utils/logger.js';

class DoubleBookingService {
  /**
   * Verificar se há conflito de marcação
   * Usado antes da transação para feedback rápido ao utilizador
   */
  async checkConflict(serviceId, startsAt, endsAt, excludeId = null) {
    const conflicts = await Appointment.findConflicts(
      serviceId, startsAt.toISOString(),
      Math.round((endsAt.getTime() - startsAt.getTime()) / 60000),
      excludeId
    );
    return conflicts.length > 0;
  }

  /**
   * Tentar criar marcação com proteção contra double booking
   * Usado dentro de transação
   *
   * Estratégia:
   * 1. Usar transação SERIALIZABLE (nível mais alto de isolamento)
   * 2. Se ocorrer SerializationFailure (código 40001), fazer retry (máx 3)
   * 3. Se INSERT falhar por constraint EXCLUDE, rejeitar
   *
   * Porquê SERIALIZABLE:
   * - É o nível mais forte de isolamento no PostgreSQL
   * - Previene write-skew anomalies
   * - Quando dois transactions tentam escrever o mesmo intervalo,
   *   um deles recebe SerializationFailure e deve retry
   * - Combinado com EXCLUDE constraint (física), é praticamente impossível
   *   criar double bookings
   */
  async createWithProtection(createFn, maxRetries = 3) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await createFn();
      } catch (err) {
        if (err.code === '40001' && attempt < maxRetries) {
          // Serialization failure - fazer retry com backoff
          logger.warn(`Serialization failure on attempt ${attempt}, retrying...`);
          await this.sleep(100 * attempt); // Backoff progressivo
          continue;
        }
        throw err;
      }
    }
  }

  /**
   * Sleep helper para backoff
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export const doubleBookingService = new DoubleBookingService();
