/**
 * NAILBOOK — Modelos de Base de Dados
 * Cada modelo encapsula queries para uma tabela.
 * Todos os timestamps são timestamptz UTC.
 * Os horários de funcionamento são TIME (local).
 */

import { pool } from '../config/database.js';
import { v4 as uuid } from 'uuid';
import crypto from 'crypto';

// ============================================
// UTILIDADES DE CONVENIÊNCIA
// ============================================

function now() {
  return new Date().toISOString();
}

function toPgTimestamp(date) {
  return date instanceof Date ? date.toISOString() : new Date(date).toISOString();
}

const SALT_SECRET = 'nailbook-secret-key';

function hashPassword(password) {
  return crypto.createHmac('sha256', SALT_SECRET).update(password).digest('hex');
}

/**
 * Hash um token para armazenamento seguro
 */
async function hashToken(token) {
  return hashPassword(token);
}

/**
 * Verificar se um token corresponde ao hash
 */
async function verifyToken(token, tokenHash) {
  return hashPassword(token) === tokenHash;
}

// ============================================
// ADMIN_USERS
// ============================================

export const AdminUser = {
  /**
   * Criar novo admin user
   */
  async create({ email, passwordHash, name, role = 'admin' }) {
    const result = await pool.query(
      `INSERT INTO admin_users (id, email, password_hash, name, role, active, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, true, $6, $7)
       RETURNING id, email, name, role, active, created_at, updated_at`,
      [uuid(), email, passwordHash, name, role, toPgTimestamp(now()), toPgTimestamp(now()),
          ]
    );
    return result.rows[0];
  },

  /**
   * Find por email
   */
  async findByEmail(email) {
    const result = await pool.query(
      'SELECT id, email, password_hash, name, role, active, last_login_at, created_at, updated_at FROM admin_users WHERE email = $1',
      [email]
    );
    return result.rows[0] || null;
  },

  /**
   * Find por ID
   */
  async findById(id) {
    const result = await pool.query(
      'SELECT id, email, name, role, active, last_login_at, created_at, updated_at FROM admin_users WHERE id = $1',
      [id]
    );
    return result.rows[0] || null;
  },

  /**
   * Atualizar último login
   */
  async updateLastLogin(id) {
    await pool.query(
      'UPDATE admin_users SET last_login_at = $1, updated_at = $2 WHERE id = $3',
      [toPgTimestamp(now()), toPgTimestamp(now()), id]
    );
  },

  /**
   * Ativar/desativar
   */
  async toggleActive(id, active) {
    const result = await pool.query(
      'UPDATE admin_users SET active = $1, updated_at = $2 WHERE id = $3 RETURNING id, email, name, role, active',
      [active, toPgTimestamp(now()), id]
    );
    return result.rows[0] || null;
  },

  /**
   * Atualizar password
   */
  async updatePassword(email, passwordHash) {
    await pool.query(
      'UPDATE admin_users SET password_hash = $1, updated_at = $2 WHERE email = $3',
      [passwordHash, toPgTimestamp(now()), email]
    );
  }
};

// ============================================
// CUSTOMERS
// ============================================

export const Customer = {
  /**
   * Criar ou encontrar cliente por telefone
   * O telefone é o identificador principal para evitar duplicação.
   */
  async findOrCreate({ name, phone, email, notes }) {
    // Verificar se já existe pelo telefone
    const existing = await pool.query(
      'SELECT id, name, phone, email, notes, created_at FROM customers WHERE phone = $1',
      [phone]
    );

    if (existing.rows[0]) {
      return existing.rows[0];
    }

    const result = await pool.query(
      `INSERT INTO customers (id, name, phone, email, notes, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, name, phone, email, notes, created_at, updated_at`,
      [uuid(), name, phone, email || null, notes || null, toPgTimestamp(now()), toPgTimestamp(now()),
          ]
    );
    return result.rows[0];
  },

  /**
   * Find por ID com estatísticas
   */
  async findById(id) {
    const result = await pool.query(
      `SELECT c.*,
       COUNT(a.id) as total_appointments,
       MAX(a.start_at) as last_appointment,
       MIN(CASE WHEN a.start_at > NOW() THEN a.start_at END) as next_appointment,
       COALESCE(SUM(a.price), 0) as total_spent
       FROM customers c
       LEFT JOIN appointments a ON c.id = a.customer_id
       WHERE c.id = $1
       GROUP BY c.id`,
      [id]
    );
    return result.rows[0] || null;
  },

  /**
   * Listar todos os clientes com estatísticas
   */
  async findAll() {
    const result = await pool.query(`
      SELECT c.*,
       COUNT(a.id) as total_appointments,
       MAX(a.start_at) as last_appointment,
       MIN(CASE WHEN a.start_at > NOW() THEN a.start_at END) as next_appointment,
       COALESCE(SUM(a.price), 0) as total_spent
       FROM customers c
       LEFT JOIN appointments a ON c.id = a.customer_id
       GROUP BY c.id
       ORDER BY c.created_at DESC
    `);
    return result.rows;
  },

  /**
   * Estatísticas gerais
   */
  async getStats() {
    const result = await pool.query('SELECT COUNT(*) as total FROM customers');
    return parseInt(result.rows[0].total);
  }
};

// ============================================
// SERVICES
// ============================================

export const Service = {
  /**
   * Listar serviços (ativos por defeito ou todos)
   */
  async findAll(activeOnly = true) {
    const query = activeOnly
      ? 'SELECT * FROM services WHERE active = true ORDER BY name'
      : 'SELECT * FROM services ORDER BY name';
    const result = await pool.query(query);
    return result.rows;
  },

  /**
   * Find por ID
   */
  async findById(id) {
    const result = await pool.query('SELECT * FROM services WHERE id = $1', [id]);
    return result.rows[0] || null;
  },

  /**
   * Criar serviço
   */
  async create({ name, description, price, duration_minutes }) {
    const result = await pool.query(
      `INSERT INTO services (id, name, description, price, duration_minutes, active, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, true, $6, $7)
       RETURNING *`,
      [uuid(), name, description || null, price, duration_minutes, toPgTimestamp(now()), toPgTimestamp(now()),
          ]
    );
    return result.rows[0];
  },

  /**
   * Atualizar serviço
   */
  async update(id, { name, description, price, duration_minutes, active }) {
    const result = await pool.query(
      `UPDATE services SET name = $1, description = $2, price = $3, duration_minutes = $4, active = $5, updated_at = $6
       WHERE id = $7 RETURNING *`,
      [name, description, price, duration_minutes, active, toPgTimestamp(now()), id]
    );
    return result.rows[0] || null;
  },

  /**
   * Ativar/desativar
   */
  async toggleActive(id, active) {
    const result = await pool.query(
      'UPDATE services SET active = $1, updated_at = $2 WHERE id = $3 RETURNING *',
      [active, toPgTimestamp(now()), id]
    );
    return result.rows[0] || null;
  },

  /**
   * Eliminar serviço
   */
  async delete(id) {
    await pool.query('DELETE FROM services WHERE id = $1', [id]);
  }
};

// ============================================
// APPOINTMENTS
// ============================================

export const Appointment = {
  /**
   * Criar nova marcação
   * O estado é sempre 'confirmed' (marcação confirmada automaticamente).
   * O end_at é calculado como start_at + duration_snapshot_minutes.
   * O preço e duração são snapshot no momento da reserva.
   */
  async create({ customerId, serviceId, startAt, endAt, price, durationSnapshotMinutes, customerNotes }) {
    const result = await pool.query(
      `INSERT INTO appointments (id, customer_id, service_id, status, start_at, end_at, price, duration_snapshot_minutes, customer_notes, created_at, updated_at)
       VALUES ($1, $2, $3, 'confirmed', $4, $5, $6, $7, $8, $9, $10)
       RETURNING *`,
      [uuid(), customerId, serviceId, toPgTimestamp(startAt), toPgTimestamp(endAt), price, durationSnapshotMinutes, customerNotes || null, toPgTimestamp(now()), toPgTimestamp(now()),
          ]
    );
    return result.rows[0];
  },

  /**
   * Find por token (validação com hash)
   */
  async findByToken(token) {
    // Procurar o token que não expirou
    const tokenResult = await pool.query(
      `SELECT bt.*, a.*
       FROM booking_tokens bt
       JOIN appointments a ON bt.appointment_id = a.id
       WHERE bt.expires_at > NOW() AND bt.appointment_id = (
         SELECT appointment_id FROM booking_tokens WHERE token_hash = $1 AND expires_at > NOW() LIMIT 1
       )`,
      [token] // Note: o token é passado como hash para validação
    );

    if (tokenResult.rows[0]) {
      // Verificar se o token corresponde ao hash
      const valid = await verifyToken(token, tokenResult.rows[0].token_hash);
      if (!valid) return null;

      return tokenResult.rows[0];
    }

    // Fallback: procurar appointment por token direto (backward compatibility)
    const result = await pool.query(
      `SELECT a.*, bt.token_hash
       FROM appointments a
       LEFT JOIN booking_tokens bt ON a.id = bt.appointment_id
       WHERE a.id = $1`,
      [token]
    );
    return result.rows[0] || null;
  },

  /**
   * Find por ID (admin) com dados completos
   */
  async findById(id) {
    const result = await pool.query(
      `SELECT a.*,
       c.name as customer_name, c.phone as customer_phone, c.email as customer_email,
       s.name as service_name, s.duration_minutes as service_duration, s.price as service_price
       FROM appointments a
       LEFT JOIN customers c ON a.customer_id = c.id
       LEFT JOIN services s ON a.service_id = s.id
       WHERE a.id = $1`,
      [id]
    );
    return result.rows[0] || null;
  },

  /**
   * Listar marcações com filtros
   */
  async findAll(filters = {}) {
    const { date, status, page = 1, limit = 50 } = filters;
    const offset = (page - 1) * limit;
    let query = `
      SELECT a.*,
       c.name as customer_name, c.phone as customer_phone, c.email as customer_email,
       s.name as service_name, s.duration_minutes as service_duration, s.price as service_price
      FROM appointments a
      LEFT JOIN customers c ON a.customer_id = c.id
      LEFT JOIN services s ON a.service_id = s.id
      WHERE 1=1
    `;
    const params = [];
    let paramIndex = 1;

    if (date) {
      query += ` AND DATE(a.start_at) = $${paramIndex++}`;
      params.push(date);
    }
    if (status) {
      query += ` AND a.status = $${paramIndex++}`;
      params.push(status);
    }

    query += ` ORDER BY a.start_at DESC LIMIT $${paramIndex++} OFFSET $${paramIndex++}`;
    params.push(limit, offset);

    const result = await pool.query(query, params);
    return result.rows;
  },

  /**
   * Verificar conflitos de marcação (usado antes da transação)
   * Retorna marcações que sobrepõem o intervalo
   */
  async findConflicts(serviceId, startAt, endAt, excludeId = null) {
    const query = `
      SELECT * FROM appointments
      WHERE service_id = $1
        AND status = 'confirmed'
        AND start_at < $2
        AND end_at > $3
    `;
    const params = [serviceId, toPgTimestamp(endAt), toPgTimestamp(startAt)];

    if (excludeId) {
      query += ` AND id != $${params.length + 1}`;
      params.push(excludeId);
    }

    const result = await pool.query(query, params);
    return result.rows;
  },

  /**
   * Atualizar estado da marcação
   */
  async updateState(id, newStatus, adminUserId = null) {
    const updates = {
      status: newStatus,
      updated_at: toPgTimestamp(now())
    };
    if (newStatus === 'cancelled') updates.cancelled_at = toPgTimestamp(now());
    if (newStatus === 'completed' || newStatus === 'no_show') updates.completed_at = toPgTimestamp(now());
    if (adminUserId) updates.admin_user_id = adminUserId;

    const setClause = Object.entries(updates)
      .map(([k, v], i) => `${k} = $${i + 1}`).join(', ');
    const values = Object.values(updates);
    values.push(id);

    const result = await pool.query(
      `UPDATE appointments SET ${setClause} WHERE id = $${values.length} RETURNING *`,
      values
    );
    return result.rows[0] || null;
  },

  /**
   * Contar marcações para dashboards
   */
  async getStats(date) {
    const dateStr = date || new Date().toISOString().split('T')[0];

    const todayResult = await pool.query(
      `SELECT COUNT(*) as count, COALESCE(SUM(price), 0) as revenue FROM appointments
       WHERE DATE(start_at) = $1 AND status = 'confirmed'`,
      [dateStr]
    );

    const weekResult = await pool.query(
      `SELECT COUNT(*) as count FROM appointments
       WHERE start_at >= NOW() AND start_at < NOW() + interval '7 days' AND status = 'confirmed'`
    );

    return {
      today: parseInt(todayResult.rows[0].count),
      week: parseInt(weekResult.rows[0].count),
      revenue_today: parseFloat(todayResult.rows[0].revenue)
    };
  }
};

// ============================================
// BUSINESS_HOURS
// ============================================

export const BusinessHour = {
  /**
   * Obter horários por dia da semana
   */
  async findByDay(dayOfWeek) {
    const result = await pool.query(
      `SELECT * FROM business_hours WHERE day_of_week = $1 AND active = true ORDER BY opens_at`,
      [dayOfWeek]
    );
    return result.rows;
  },

  /**
   * Obter todos os horários ativos
   */
  async findAll() {
    const result = await pool.query(
      `SELECT * FROM business_hours WHERE active = true ORDER BY day_of_week, opens_at`
    );
    return result.rows;
  },

  /**
   * Atualizar todos os horários (bulk replace)
   */
  async bulkReplace(hours) {
    await pool.query('DELETE FROM business_hours');
    const values = hours.map(h => [
      uuid(), h.dayOfWeek, h.opensAt, h.closesAt, true, toPgTimestamp(now()), toPgTimestamp(now())
    ]);

    const query = `
      INSERT INTO business_hours (id, day_of_week, opens_at, closes_at, active, created_at, updated_at)
      VALUES ${values.map((_, i) => `($${i * 7 + 1}, $${i * 7 + 2}, $${i * 7 + 3}, $${i * 7 + 4}, $${i * 7 + 5}, $${i * 7 + 6}, $${i * 7 + 7})`).join(', ')}
    `;
    const flatValues = values.flat();
    await pool.query(query, flatValues);
  },

  /**
   * Verificar se o dia tem horário de funcionamento
   */
  async isDayOpen(dayOfWeek) {
    const hours = await this.findByDay(dayOfWeek);
    return hours.length > 0;
  }
};

// ============================================
// BREAKS
// ============================================

export const Break = {
  /**
   * Obter pausas por dia da semana
   */
  async findByDay(dayOfWeek) {
    const result = await pool.query(
      `SELECT * FROM breaks WHERE day_of_week = $1 AND active = true ORDER BY starts_at`,
      [dayOfWeek]
    );
    return result.rows;
  }
};

// ============================================
// BLOCKED PERIODS
// ============================================

export const BlockedPeriod = {
  /**
   * Obter períodos bloqueados que sobrepõem uma data
   */
  async findOverlapping(date) {
    const dateStart = new Date(date + 'T00:00:00Z');
    const dateEnd = new Date(dateStart.getTime() + 86400000);

    const result = await pool.query(
      `SELECT * FROM blocked_periods WHERE starts_at < $2 AND ends_at > $1`,
      [toPgTimestamp(dateStart), toPgTimestamp(dateEnd)]
    );
    return result.rows;
  },

  /**
   * Criar período bloqueado
   */
  async create({ startsAt, endsAt, reason }) {
    const result = await pool.query(
      `INSERT INTO blocked_periods (id, starts_at, ends_at, reason, created_at) VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [uuid(), toPgTimestamp(startsAt), toPgTimestamp(endsAt), reason || null, toPgTimestamp(now())]
    );
    return result.rows[0];
  },

  /**
   * Eliminar período bloqueado
   */
  async delete(id) {
    await pool.query('DELETE FROM blocked_periods WHERE id = $1', [id]);
  },

  /**
   * Listar todos os períodos bloqueados
   */
  async findAll() {
    const result = await pool.query('SELECT * FROM blocked_periods ORDER BY starts_at DESC');
    return result.rows;
  }
};

// ============================================
// SETTINGS
// ============================================

export const Setting = {
  /**
   * Obter configurações
   */
  async find() {
    const result = await pool.query('SELECT * FROM settings LIMIT 1');
    return result.rows[0] || null;
  },

  /**
   * Criar ou atualizar configurações
   */
  async upsert(data) {
    const existing = await this.find();
    if (existing) {
      const result = await pool.query(
        `UPDATE settings SET business_name = $1, business_phone = $2, business_email = $3,
         timezone = $4, minimum_advance_hours = $5, maximum_booking_days = $6,
         cancellation_deadline_hours = $7, min_interval_minutes = $8, buffer_minutes = $9, currency = $10,
         whatsapp_enabled = $11, whatsapp_phone = $12,
         google_calendar_enabled = $13, email_notifications_enabled = $14,
         reminder_24h_enabled = $15, reminder_2h_enabled = $16, business_url = $17, admin_notification_email = $18, updated_at = $19
         WHERE id = $20 RETURNING *`,
        [data.businessName, data.businessPhone, data.businessEmail, data.timezone,
         data.minimumAdvanceHours, data.maximumBookingDays, data.cancellationDeadlineHours,
         data.minIntervalMinutes, data.buffer_minutes ?? 0, data.currency, data.whatsappEnabled, data.whatsappPhone,
         data.googleCalendarEnabled, data.emailNotificationsEnabled,
         data.reminder24hEnabled, data.reminder2hEnabled, data.businessUrl || '', data.adminNotificationEmail, toPgTimestamp(now()), existing.id]
      );
      return result.rows[0];
    } else {
      const result = await pool.query(
        `INSERT INTO settings (id, business_name, business_phone, business_email, timezone,
         minimum_advance_hours, maximum_booking_days, cancellation_deadline_hours,
         min_interval_minutes, buffer_minutes, currency, whatsapp_enabled, whatsapp_phone,
         google_calendar_enabled, email_notifications_enabled,
         reminder_24h_enabled, reminder_2h_enabled, created_at, updated_at,
          business_url, admin_notification_email)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21) RETURNING *`,
        [uuid(), data.businessName || '', data.businessPhone || '', data.businessEmail || null,
         data.timezone || 'Europe/Lisbon',
         data.minimumAdvanceHours ?? 0, data.maximumBookingDays ?? 30, data.cancellationDeadlineHours ?? 24,
         data.minIntervalMinutes ?? 0, data.buffer_minutes ?? 0, data.currency || 'EUR', false, null,
         false, true, true, true, toPgTimestamp(now()), toPgTimestamp(now()),
          ]
      );
      return result.rows[0];
    }
  }
};
// BOOKING_TOKENS
// ============================================

export const BookingToken = {
  /**
   * Criar token para uma marcação
   * O token é guardado como HASH (bcrypt), nunca em texto simples.
   * Retorna o token em texto simples para envio à cliente.
   */
  async create(appointmentId) {
    const token = uuid();
    const tokenHash = await hashToken(token);
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30); // 30 dias

    await pool.query(
      `INSERT INTO booking_tokens (id, appointment_id, token_hash, expires_at, created_at)
       VALUES ($1, $2, $3, $4, $5)`,
      [uuid(), appointmentId, tokenHash, toPgTimestamp(expiresAt), toPgTimestamp(now())]
    );
    return token; // Retorna o token original para envio à cliente
  },

  /**
   * Validar token comparando com o hash
   */
  async validate(token) {
    // Procurar todos os tokens válidos da appointment
    const result = await pool.query(
      `SELECT bt.id as token_id, bt.token_hash, bt.expires_at, bt.appointment_id, a.*
       FROM booking_tokens bt
       JOIN appointments a ON bt.appointment_id = a.id
       WHERE bt.expires_at > NOW()`
    );

    for (const row of result.rows) {
      const valid = await verifyToken(token, row.token_hash);
      if (valid) {
        return { ...row, valid: true };
      }
    }
    return null;
  },

  /**
   * Invalidar todos os tokens de uma marcação (ex: ao cancelar)
   */
  async invalidateByAppointment(appointmentId) {
    await pool.query(
      'DELETE FROM booking_tokens WHERE appointment_id = $1',
      [appointmentId]
    );
  }
};

// ============================================
// NOTIFICATION_LOGS
// ============================================

import { NotificationLog as NotificationLogModel } from './notificationLog.js';

export { NotificationLogModel as NotificationLog };
