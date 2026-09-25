/**
 * NAILBOOK — Configuração da Base de Dados
 * Pool de conexões PostgreSQL
 */

import { Pool } from 'pg';
import dotenv from 'dotenv';
import { logger } from '../utils/logger.js';

dotenv.config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20, // Máximo de conexões no pool
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// Eventos do pool
pool.on('connect', () => {
  logger.debug('Cliente database conectado');
});

pool.on('error', (err, client) => {
  logger.error('Erro inesperado no cliente database:', err.message);
});

export { pool };
