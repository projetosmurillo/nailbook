/**
 * NAILBOOK — Controlador de Notificações (Admin)
 * Consulta de logs de notificações
 */

import { NotificationLog } from '../models/notificationLog.js';
import { logger } from '../utils/logger.js';

/**
 * Obter todas as notificações (admin)
 */
async function getNotifications(req, res, next) {
  try {
    const { appointment_id, type, status, channel, page = 1, limit = 50 } = req.query;

    const offset = (page - 1) * limit;
    const filters = [];
    const params = [];
    let paramIndex = 1;

    let where = 'WHERE 1=1';

    if (appointment_id) {
      where += ` AND appointment_id = $${paramIndex}`;
      params.push(appointment_id);
      paramIndex++;
    }

    if (type) {
      where += ` AND type = $${paramIndex}`;
      params.push(type);
      paramIndex++;
    }

    if (status) {
      where += ` AND status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }

    if (channel) {
      where += ` AND channel = $${paramIndex}`;
      params.push(channel);
      paramIndex++;
    }

    const result = await NotificationLog.findAllFiltered(where, params, limit, offset);

    res.json({ success: true, data: result.rows, total: result.total });
  } catch (err) {
    next(err);
  }
}

/**
 * Obter estatísticas de notificações (admin)
 */
async function getNotificationStats(req, res, next) {
  try {
    const stats = await NotificationLog.getStats();
    const pendingCount = await NotificationLog.countPending();

    res.json({
      success: true,
      data: {
        stats,
        pendingCount
      }
    });
  } catch (err) {
    next(err);
  }
}

export { getNotifications, getNotificationStats };
