import express, { type Application } from 'express';
import { prisma } from '@hardware-scrapping/database';
import { logger } from './logger.js';

export function createApp(): Application {
  const app = express();
  app.use(express.json());

  app.get('/health', async (_req, res) => {
    try {
      await prisma.$queryRaw`SELECT 1`;
      res.status(200).json({ status: 'ok', db: 'up' });
    } catch (err) {
      logger.error('Health check DB failed', { err });
      res.status(503).json({ status: 'degraded', db: 'down' });
    }
  });

  return app;
}
