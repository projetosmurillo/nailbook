/**
 * NAILBOOK — Migrações de Base de Dados
 */

import { pool } from '../config/database.js';
import { logger } from '../utils/logger.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function runMigrations() {
  const client = await pool.connect();

  try {
    // Criar tabela de controle de migrações se não existir
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version VARCHAR(255) PRIMARY KEY,
        applied_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    // Obter migrações já aplicadas
    const applied = await client.query(
      'SELECT version FROM schema_migrations ORDER BY version'
    );
    const appliedVersions = new Set(applied.rows.map(r => r.version));

    // Listar ficheiros de migração
    const migrationsDir = join(__dirname, 'migrations');
    const files = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.sql')).sort();

    for (const file of files) {
      const version = file.replace('.sql', '');

      if (!appliedVersions.has(version)) {
        logger.info(`Running migration: ${version}`);
        const sql = fs.readFileSync(join(migrationsDir, file), 'utf-8');

        await client.query('BEGIN');
        try {
          await client.query(sql);
          await client.query(
            'INSERT INTO schema_migrations (version) VALUES ($1)',
            [version]
          );
          await client.query('COMMIT');
          logger.info(`Migration ${version} completed successfully`);
        } catch (err) {
          await client.query('ROLLBACK');
          logger.error(`Migration ${version} failed:`, err.message);
          throw err;
        }
      }
    }

    logger.info('All migrations completed');
  } finally {
    client.release();
  }
}

runMigrations().catch(err => {
  logger.error('Migration failed:', err);
  process.exit(1);
});
