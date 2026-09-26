/**
 * NAILBOOK — Controladores Administrativos
 */

import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { AdminUser } from '../models/index.js';
import { Appointment } from '../models/index.js';
import { Customer } from '../models/index.js';
import { Service } from '../models/index.js';
import { BusinessHour } from '../models/index.js';
import { BlockedPeriod } from '../models/index.js';
import { Setting } from '../models/index.js';
import { generateTokens } from '../middleware/auth.js';
import { pool } from '../config/database.js';

// ============================================
// AUTH
// ============================================

/**
 * Login do administrador
 */
async function adminLogin(req, res, next) {
  try {
    const { email, password } = req.body;

    // 1. Procurar utilizador
    const admin = await AdminUser.findByEmail(email);
    if (!admin) {
      return res.status(401).json({ error: 'Email ou password inválidos' });
    }

    if (!admin.active) {
      return res.status(403).json({ error: 'Conta desativada' });
    }

    const SALT_SECRET = 'nailbook-secret-key';
    const inputHash = crypto.createHmac('sha256', SALT_SECRET).update(password).digest('hex');
    const validPassword = inputHash === admin.password_hash;
    if (!validPassword) {
      return res.status(401).json({ error: 'Email ou password inválidos' });
    }

    // 3. Gerar tokens JWT
    const { accessToken, refreshToken } = generateTokens(admin.id, admin.email);

    // 4. Guardar refresh token (para futura rotação)
    // Em produção, guardar num cookie httpOnly e seguro

    // 5. Atualizar último login
    await AdminUser.updateLastLogin(admin.id);

    res.json({
      success: true,
      data: {
        user: { id: admin.id, email: admin.email, name: admin.name, active: admin.active },
        accessToken,
        // refresh token é enviado no cookie httpOnly
      }
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Logout
 */
async function adminLogout(req, res, next) {
  try {
    // O frontend elimina os cookies
    // Em produção, podemos adicionar o token a uma blacklist
    res.clearCookie('access_token');
    res.clearCookie('refresh_token');
    res.json({ success: true, data: { message: 'Logout realizado' } });
  } catch (err) {
    next(err);
  }
}

/**
 * Obter perfil do admin
 */
async function getAdminProfile(req, res, next) {
  try {
    const admin = await AdminUser.findById(req.user.id);
    if (!admin) {
      return res.status(404).json({ error: 'Utilizador não encontrado' });
    }
    res.json({ success: true, data: admin });
  } catch (err) {
    next(err);
  }
}

// ============================================
// APPOINTMENTS
// ============================================

async function getAppointments(req, res, next) {
  try {
    const { date, status, page, limit } = req.query;
    const appointments = await Appointment.findAll({ date, status, page, limit });
    res.json({ success: true, data: appointments });
  } catch (err) {
    next(err);
  }
}

async function getAppointmentById(req, res, next) {
  try {
    const { id } = req.params;
    const appointment = await Appointment.findById(id);
    if (!appointment) {
      return res.status(404).json({ error: 'Marcação não encontrada' });
    }
    res.json({ success: true, data: appointment });
  } catch (err) {
    next(err);
  }
}

async function updateAppointment(req, res, next) {
  try {
    const { id } = req.params;
    const { status } = req.body;  // Novo schema: status em vez de state

    const validStatuses = ['confirmed', 'cancelled', 'completed', 'no_show'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Estado inválido' });
    }

    const updated = await Appointment.updateState(id, status, req.user.id);
    if (!updated) {
      return res.status(404).json({ error: 'Marcação não encontrada' });
    }

    res.json({ success: true, data: updated });
  } catch (err) {
    next(err);
  }
}

// ============================================
// CUSTOMERS
// ============================================

async function getCustomers(req, res, next) {
  try {
    const customers = await Customer.findAll();
    res.json({ success: true, data: customers });
  } catch (err) {
    next(err);
  }
}

async function getCustomerById(req, res, next) {
  try {
    const { id } = req.params;
    const customer = await Customer.findById(id);
    if (!customer) {
      return res.status(404).json({ error: 'Cliente não encontrado' });
    }
    res.json({ success: true, data: customer });
  } catch (err) {
    next(err);
  }
}

// ============================================
// SERVICES
// ============================================

async function getServices(req, res, next) {
  try {
    const services = await Service.findAll(false); // Todos, incluindo inativos
    res.json({ success: true, data: services });
  } catch (err) {
    next(err);
  }
}

async function createService(req, res, next) {
  try {
    const { name, description, price, duration_minutes } = req.body;
    const service = await Service.create({ name, description, price, duration_minutes });
    res.status(201).json({ success: true, data: service });
  } catch (err) {
    next(err);
  }
}

async function updateService(req, res, next) {
  try {
    const { id } = req.params;
    const { name, description, price, duration_minutes, active } = req.body;
    const service = await Service.update(id, { name, description, price, duration_minutes, active });
    if (!service) {
      return res.status(404).json({ error: 'Serviço não encontrado' });
    }
    res.json({ success: true, data: service });
  } catch (err) {
    next(err);
  }
}

async function getServiceById(req, res, next) {
  try {
    const { id } = req.params;
    const service = await Service.findById(id);
    if (!service) {
      return res.status(404).json({ error: 'Serviço não encontrado' });
    }
    res.json({ success: true, data: service });
  } catch (err) {
    next(err);
  }
}

async function deleteService(req, res, next) {
  try {
    const { id } = req.params;
    await Service.delete(id);
    res.json({ success: true, data: { message: 'Serviço removido' } });
  } catch (err) {
    next(err);
  }
}

// ============================================
// CUSTOMERS (cont.)
// ============================================

async function updateCustomer(req, res, next) {
  try {
    const { id } = req.params;
    const { name, phone, email, notes } = req.body;

    const customer = await Customer.findById(id);
    if (!customer) {
      return res.status(404).json({ error: 'Cliente não encontrado' });
    }

    const now = new Date().toISOString();

    const updated = await pool.query(
      `UPDATE customers SET name = $1, phone = $2, email = $3, notes = $4, updated_at = $5
       WHERE id = $6 RETURNING *`,
      [name, phone, email || null, notes || null, now, id]
    );

    res.json({ success: true, data: updated.rows[0] });
  } catch (err) {
    next(err);
  }
}

// ============================================
// BUSINESS HOURS
// ============================================

async function getBusinessHours(req, res, next) {
  try {
    const hours = await BusinessHour.findAll();
    res.json({ success: true, data: hours });
  } catch (err) {
    next(err);
  }
}

async function updateBusinessHours(req, res, next) {
  try {
    const { hours } = req.body; // Array de { dayOfWeek, opensAt, closesAt }
    await BusinessHour.bulkReplace(hours);
    res.json({ success: true, data: { message: 'Horários atualizados' } });
  } catch (err) {
    next(err);
  }
}

// ============================================
// BLOCKED PERIODS
// ============================================

async function getBlockedPeriods(req, res, next) {
  try {
    const periods = await BlockedPeriod.findAll();
    res.json({ success: true, data: periods });
  } catch (err) {
    next(err);
  }
}

async function createBlockedPeriod(req, res, next) {
  try {
    const { starts_at, ends_at, reason } = req.body;
    const period = await BlockedPeriod.create({ starts_at, ends_at, reason });
    res.status(201).json({ success: true, data: period });
  } catch (err) {
    next(err);
  }
}

async function deleteBlockedPeriod(req, res, next) {
  try {
    const { id } = req.params;
    await BlockedPeriod.delete(id);
    res.json({ success: true, data: { message: 'Período desbloqueado' } });
  } catch (err) {
    next(err);
  }
}

// ============================================
// SETTINGS
// ============================================

async function getSettings(req, res, next) {
  try {
    const settings = await Setting.find();
    res.json({ success: true, data: settings });
  } catch (err) {
    next(err);
  }
}

async function updateSettings(req, res, next) {
  try {
    const { businessName, businessPhone, businessEmail, timezone } = req.body;
    const settings = await Setting.upsert({
      businessName, businessPhone, businessEmail, timezone
    });
    res.json({ success: true, data: settings });
  } catch (err) {
    next(err);
  }
}

export {
  adminLogin, adminLogout, getAdminProfile,
  getAppointments, getAppointmentById, updateAppointment,
  getCustomers, getCustomerById, updateCustomer,
  getServices, createService, getServiceById, updateService, deleteService,
  getBusinessHours, updateBusinessHours,
  getBlockedPeriods, createBlockedPeriod, deleteBlockedPeriod,
  getSettings, updateSettings
};
