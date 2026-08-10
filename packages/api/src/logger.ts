import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import winston from 'winston';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const logsDir = path.resolve(__dirname, '../logs');
fs.mkdirSync(logsDir, { recursive: true });

const isDev = process.env.NODE_ENV !== 'production';

export const logger = winston.createLogger({
  level: isDev ? 'debug' : 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json(),
  ),
  transports: [
    new winston.transports.File({
      filename: path.join(logsDir, 'error.log'),
      level: 'error',
    }),
    new winston.transports.File({
      filename: path.join(logsDir, 'combined.log'),
    }),
  ],
});

if (isDev) {
  logger.add(
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.printf(({ level, message, timestamp, stack }) => {
          const base = `${String(timestamp)} [${level}]: ${String(message)}`;
          return stack ? `${base}\n${String(stack)}` : base;
        }),
      ),
    }),
  );
}
