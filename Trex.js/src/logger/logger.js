/**
 * Trex.js Logger
 * Structured logging via Winston. Outputs to console + log files.
 */

import { createLogger as winstonLogger, format, transports } from 'winston';
import { existsSync, mkdirSync } from 'fs';

if (!existsSync('./logs')) mkdirSync('./logs');

const baseFormat = format.combine(
  format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  format.errors({ stack: true }),
  format.printf(({ timestamp, level, label, message, stack }) => {
    const prefix = label ? `[${label}]` : '';
    return `${timestamp} ${level.toUpperCase()} ${prefix} ${stack || message}`;
  })
);

const logger = winstonLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: baseFormat,
  transports: [
    new transports.Console({
      format: format.combine(format.colorize(), baseFormat),
    }),
    new transports.File({ filename: './logs/error.log', level: 'error' }),
    new transports.File({ filename: './logs/combined.log' }),
  ],
});

export function createLogger(label) {
  return logger.child({ label });
}

export default logger;
