/**
 * NAILBOOK — Middleware de CORS
 */

import cors from 'cors';
import dotenv from 'dotenv';
import { logger } from '../utils/logger.js';

dotenv.config();

const allowedOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(',').map(o => o.trim())
  : [];

// Adicionar URL do Render como origem permitida em produção
if (process.env.NODE_ENV === 'production') {
  const renderUrl = process.env.API_URL || 'https://nailbook-api.onrender.com';
  if (!allowedOrigins.includes(renderUrl)) {
    allowedOrigins.push(renderUrl);
  }
}

if (process.env.NODE_ENV === 'production' && allowedOrigins.length === 0) {
  logger.error('CORS_ORIGIN is not configured in production. Set CORS_ORIGIN environment variable.');
  process.exit(1);
}

export const corsMiddleware = cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (direct URL access in browser)
    if (!origin) {
      return callback(null, true);
    }

    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('CORS: Origin not allowed'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token'],
  maxAge: 86400,
  optionsSuccessStatus: 204,
});
