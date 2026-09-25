/**
 * NAILBOOK — Seed de Dados Iniciais
 * Prepara a base de dados para desenvolvimento.
 * A password do admin é lida de variáveis de ambiente (nunca em código).
 */

import { pool } from '../config/database.js';
import bcrypt from 'bcrypt';
import { v4 as uuid } from 'uuid';
import dotenv from 'dotenv';
import { logger } from '../utils/logger.js';

dotenv.config();

async function seed() {
  const client = await pool.connect();

  try {
    // ============================================
    // ADMIN INICIAL
    // ============================================
    // A password é configurada via variável de ambiente:
    // INITIAL_ADMIN_PASSWORD
    // Nunca colocar password diretamente no código.

    const existingAdmin = await client.query(
      'SELECT id FROM admin_users WHERE email = $1',
      [process.env.INITIAL_ADMIN_EMAIL]
    );

    if (existingAdmin.rows.length === 0) {
      const password = process.env.INITIAL_ADMIN_PASSWORD;
      if (!password) {
        throw new Error('INITIAL_ADMIN_PASSWORD não definida na variável de ambiente');
      }

      const passwordHash = await bcrypt.hash(password, 12);

      await client.query(`
        INSERT INTO admin_users (id, email, password_hash, name, role, active, last_login_at, created_at, updated_at)
        VALUES ($1, $2, $3, $4, 'admin', true, NULL, $5, $6)
      `, [
        uuid(),
        process.env.INITIAL_ADMIN_EMAIL,
        passwordHash,
        'Administrador',
        new Date().toISOString(),
        new Date().toISOString()
      ]);

      logger.info(`Admin user created: ${process.env.INITIAL_ADMIN_EMAIL}`);
    } else {
      logger.info(`Admin user already exists: ${process.env.INITIAL_ADMIN_EMAIL}`);
    }

    // ============================================
    // SERVIÇOS PADRÃO
    // ============================================
    // Preços em NUMERIC(10,2). Duração em minutos.

    const existingServices = await client.query('SELECT COUNT(*) as count FROM services');

    if (parseInt(existingServices.rows[0].count) === 0) {
      const defaultServices = [
        { name: 'Manicure Completa', description: 'Corte, lixamento, empurrar cutícula, hidratação e verniz', price: 25.00, duration_minutes: 60 },
        { name: 'Manicure Simples', description: 'Corte, lixamento, cutícula e verniz', price: 18.00, duration_minutes: 45 },
        { name: 'Gel Nails', description: 'Aplicação de gel nas unhas com modelagem', price: 35.00, duration_minutes: 90 },
        { name: 'Gel Nails + Design', description: 'Gel nails com design exclusivo', price: 45.00, duration_minutes: 120 },
        { name: 'Pedicure Completa', description: 'Tratamento completo dos pés incluindo cutícula e verniz', price: 30.00, duration_minutes: 75 },
        { name: 'Remoção de Verniz Gel', description: 'Remoção segura de verniz em gel', price: 15.00, duration_minutes: 30 },
        { name: 'Manicure + Extensões', description: 'Manicure com extensões de gel ou acrílico', price: 55.00, duration_minutes: 150 },
        { name: 'Reforma de Unhas', description: 'Reforma e fortalecimento de unhas naturais', price: 35.00, duration_minutes: 60 }
      ];

      for (const svc of defaultServices) {
        await client.query(`
          INSERT INTO services (id, name, description, price, duration_minutes, active, created_at, updated_at)
          VALUES ($1, $2, $3, $4, $5, true, $6, $7)
        `, [
          uuid(), svc.name, svc.description, svc.price, svc.duration_minutes,
          new Date().toISOString(), new Date().toISOString()
        ]);
      }

      logger.info('Default services created');
    }

    // ============================================
    // HORÁRIOS DE FUNCIONAMENTO PADRÃO
    // ============================================
    // Segunda a sábado (0=Sunday, 1=Monday, ..., 6=Saturday)
    // Domingo fechado.

    const existingHours = await client.query('SELECT COUNT(*) as count FROM business_hours');

    if (parseInt(existingHours.rows[0].count) === 0) {
      const businessHours = [
        // Segunda (1): 09-13, 14-18
        { dayOfWeek: 1, opensAt: '09:00', closesAt: '13:00' },
        { dayOfWeek: 1, opensAt: '14:00', closesAt: '18:00' },
        // Terça (2): 09-18
        { dayOfWeek: 2, opensAt: '09:00', closesAt: '18:00' },
        // Quarta (3): FECHADO
        // Quinta (4): 09-13, 14-18
        { dayOfWeek: 4, opensAt: '09:00', closesAt: '13:00' },
        { dayOfWeek: 4, opensAt: '14:00', closesAt: '18:00' },
        // Sexta (5): 09-18
        { dayOfWeek: 5, opensAt: '09:00', closesAt: '18:00' },
        // Sábado (6): 09-14
        { dayOfWeek: 6, opensAt: '09:00', closesAt: '14:00' },
      ];

      for (const bh of businessHours) {
        await client.query(`
          INSERT INTO business_hours (id, day_of_week, opens_at, closes_at, active, created_at, updated_at)
          VALUES ($1, $2, $3, $4, true, $5, $6)
        `, [
          uuid(), bh.dayOfWeek, bh.opensAt, bh.closesAt,
          new Date().toISOString(), new Date().toISOString()
        ]);
      }

      logger.info('Business hours created');
    }

    // ============================================
    // PAUSAS PADRÃO
    // ============================================

    const existingBreaks = await client.query('SELECT COUNT(*) as count FROM breaks');

    if (parseInt(existingBreaks.rows[0].count) === 0) {
      const defaultBreaks = [
        { dayOfWeek: 1, startsAt: '13:00', endsAt: '14:00', description: 'Almoço' },
        { dayOfWeek: 2, startsAt: '13:00', endsAt: '14:00', description: 'Almoço' },
        { dayOfWeek: 4, startsAt: '13:00', endsAt: '14:00', description: 'Almoço' },
        { dayOfWeek: 5, startsAt: '13:00', endsAt: '14:00', description: 'Almoço' },
      ];

      for (const br of defaultBreaks) {
        await client.query(`
          INSERT INTO breaks (id, day_of_week, starts_at, ends_at, description, active, created_at)
          VALUES ($1, $2, $3, $4, $5, true, $6)
        `, [
          uuid(), br.dayOfWeek, br.startsAt, br.endsAt, br.description,
          new Date().toISOString()
        ]);
      }

      logger.info('Default breaks created');
    }

    // ============================================
    // CONFIGURAÇÕES PADRÃO
    // ============================================

    const existingSettings = await client.query('SELECT COUNT(*) as count FROM settings');

    if (parseInt(existingSettings.rows[0].count) === 0) {
      await client.query(`
        INSERT INTO settings (
          id, business_name, business_phone, business_email, timezone,
          minimum_advance_hours, maximum_booking_days, cancellation_deadline_hours,
          min_interval_minutes, buffer_minutes, currency,
          whatsapp_enabled, whatsapp_phone,
          google_calendar_enabled, email_notifications_enabled,
          reminder_24h_enabled, reminder_2h_enabled,
          created_at, updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
      `, [
        uuid(),
        'NailBook', '', null, 'Europe/Lisbon',
        0, 30, 24, 15, 15, 'EUR',
        false, null,
        false, true,
        true, true,
        new Date().toISOString(), new Date().toISOString()
      ]);

      logger.info('Default settings created');
    }

    // ============================================
    // CONFIGURAÇÕES DE NOTIFICAÇÃO (opcional)
    // ============================================
    // O sistema está preparado para envio de notificações,
    // mas requer credenciais do provedor para ativar.

    logger.info('Seed completed successfully');
    logger.info('==============================================');
    logger.info('Dados de acesso para desenvolvimento:');
    logger.info(`  Email: ${process.env.INITIAL_ADMIN_EMAIL}`);
    logger.info('  Password: (ver .env)');
    logger.info('==============================================');
  } catch (err) {
    logger.error('Seed failed:', err.message);
    throw err;
  } finally {
    client.release();
  }
}

seed();
