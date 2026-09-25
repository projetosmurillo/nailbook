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

if (process.env.NODE_ENV === 'production' && allowedOrigins.length === 0) {
  logger.error('CORS_ORIGIN is not configured in production. Set CORS_ORIGIN environment variable.');
  process.exit(1);
}

export const corsMiddleware = cors({
  origin: function (origin, callback) {
    // Allow requests with no origin ONLY in development
    if (!origin) {
      if (process.env.NODE_ENV === 'development') {
        return callback(null, true);
      }
      // In production, reject requests without origin
      return callback(new Error('CORS: Origin not allowed'));
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
