import express, { type Application } from 'express';
import cors from 'cors';
import { prisma } from '@hardware-scrapping/database';
import { logger } from './logger.js';
import { safeErrorDetails } from './utils/safe-error.js';
import { ApiError, ErrorCodes } from './errors/api-error.js';
import { errorHandler } from './errors/error-handler.js';
import { adminRouter } from './routes/admin.routes.js';
import { authRouter } from './routes/auth.routes.js';
import { categoriesRouter } from './routes/categories.routes.js';
import { productsRouter } from './routes/products.routes.js';

export function createApp(): Application {
  const app = express();

  app.use(cors({ origin: true }));
  app.use(express.json());

  app.get('/health', async (_req, res) => {
    try {
      await prisma.$queryRaw`SELECT 1`;
      res.status(200).json({ status: 'ok', db: 'up' });
    } catch (err) {
      logger.error('Health check DB failed', { error: safeErrorDetails(err) });
      res.status(503).json({ status: 'degraded', db: 'down' });
    }
  });

  app.use('/api/categories', categoriesRouter);
  app.use('/api/products', productsRouter);
  app.use('/api/auth', authRouter);
  app.use('/api/admin', adminRouter);

  app.use('/api', (_req, _res, next) => {
    next(new ApiError(404, ErrorCodes.NOT_FOUND, 'API route not found'));
  });

  app.use(errorHandler);

  return app;
}
