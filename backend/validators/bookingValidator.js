/**
 * NAILBOOK — Validadores
 * Validação de input usando Joi com o novo schema
 */

import Joi from 'joi';

// ============================================
// VALIDADORES DE BOOKING
// ============================================

export const validateAvailability = (req, res, next) => {
  const schema = Joi.object({
    date: Joi.string()
      .pattern(/^\d{4}-\d{2}-\d{2}$/)
      .required()
      .messages({
        'string.pattern.base': 'Formato de data inválido. Use YYYY-MM-DD',
        'any.required': 'A data é obrigatória'
      }),
    service_id: Joi.string()
      .uuid()
      .required()
      .messages({
        'string.uuid': 'ID de serviço inválido',
        'any.required': 'O ID do serviço é obrigatório'
      })
  });

  const { error } = schema.validate(req.query);
  if (error) {
    return res.status(400).json({ error: error.details[0].message });
  }
  next();
};

export const validateCreateAppointment = (req, res, next) => {
  const schema = Joi.object({
    service_id: Joi.string().uuid().required(),
    date: Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/).required(),
    time: Joi.string().pattern(/^\d{2}:\d{2}$/).required(),
    customer_name: Joi.string()
      .min(2)
      .max(100)
      .required()
      .pattern(/^[a-zA-ZÀ-ÿ\s'-]+$/)
      .messages({
        'string.pattern.base': 'Nome contém caracteres inválidos'
      }),
    customer_phone: Joi.string()
      .min(7)
      .max(20)
      .required(),
    customer_email: Joi.string().email().allow(''),
    notes: Joi.string().max(500).allow('')
  });

  const { error } = schema.validate(req.body);
  if (error) {
    return res.status(400).json({ error: error.details[0].message });
  }
  next();
};

// ============================================
// VALIDADORES DE ADMIN
// ============================================

export const validateLogin = (req, res, next) => {
  const schema = Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string().min(6).required()
  });

  const { error } = schema.validate(req.body);
  if (error) {
    return res.status(400).json({ error: error.details[0].message });
  }
  next();
};

export const validateService = (req, res, next) => {
  const schema = Joi.object({
    name: Joi.string().min(1).max(100).required(),
    description: Joi.string().max(1000).allow(''),
    price: Joi.number().positive().precision(2).required().messages({
      'number.positive': 'O preço deve ser um valor positivo',
      'number.precision': 'O preço deve ter no máximo 2 casas decimais'
    }),
    duration_minutes: Joi.number().integer().min(5).max(480).required(),
    active: Joi.boolean()
  });

  const { error } = schema.validate(req.body);
  if (error) {
    return res.status(400).json({ error: error.details[0].message });
  }
  next();
};

export const validateAppointmentUpdate = (req, res, next) => {
  const validStatuses = ['confirmed', 'cancelled', 'completed', 'no_show'];
  const schema = Joi.object({
    status: Joi.string().valid(...validStatuses).required(),
    notes: Joi.string().max(500).allow('')
  });

  const { error } = schema.validate(req.body);
  if (error) {
    return res.status(400).json({ error: error.details[0].message });
  }
  next();
};

export const validateBlockedPeriod = (req, res, next) => {
  const schema = Joi.object({
    starts_at: Joi.string().isoDate().required(),
    ends_at: Joi.string().isoDate().required(),
    reason: Joi.string().max(255).allow('')
  });

  const { error } = schema.validate(req.body);
  if (error) {
    return res.status(400).json({ error: error.details[0].message });
  }
  // Verificar que ends_at > starts_at
  if (new Date(req.body.starts_at) >= new Date(req.body.ends_at)) {
    return res.status(400).json({ error: 'A data de fim deve ser posterior à data de início' });
  }
  next();
};

export const validateBusinessHours = (req, res, next) => {
  const schema = Joi.object({
    hours: Joi.array().items(
      Joi.object({
        dayOfWeek: Joi.number().integer().min(0).max(6).required(),
        opensAt: Joi.string().pattern(/^([01]\d|2[0-3]):[0-5]\d$/).required(),
        closesAt: Joi.string().pattern(/^([01]\d|2[0-3]):[0-5]\d$/).required()
      })
    ).min(1).required()
  });

  const { error } = schema.validate(req.body);
  if (error) {
    return res.status(400).json({ error: error.details[0].message });
  }
  next();
};

// ============================================
// VALIDADORES DE DISPONIBILIDADE (Fase 4)
// ============================================

export const validateCheckSlot = (req, res, next) => {
  const schema = Joi.object({
    date: Joi.string()
      .pattern(/^\d{4}-\d{2}-\d{2}$/)
      .required(),
    service_id: Joi.string()
      .uuid()
      .required(),
    time: Joi.string()
      .pattern(/^\d{2}:\d{2}$/)
      .required()
  });

  const { error } = schema.validate(req.query);
  if (error) {
    return res.status(400).json({ error: error.details[0].message });
  }
  next();
};

export const validateBooking = (req, res, next) => {
  const schema = Joi.object({
    date: Joi.string()
      .pattern(/^\d{4}-\d{2}-\d{2}$/)
      .required(),
    service_id: Joi.string()
      .uuid()
      .required(),
    time: Joi.string()
      .pattern(/^\d{2}:\d{2}$/)
      .required()
  });

  const { error } = schema.validate(req.body);
  if (error) {
    return res.status(400).json({ error: error.details[0].message });
  }
  next();
};
