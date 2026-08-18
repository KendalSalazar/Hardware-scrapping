import { Router, type Router as ExpressRouter } from 'express';
import { requireAdmin } from '../middleware/require-admin.js';
import { requireAuth } from '../middleware/require-auth.js';
import {
  getAdminStats,
  getScrapeRunById,
  listScrapeRuns,
} from '../services/admin.service.js';
import { validateScrapeRunsQuery } from '../validators/admin-query.validator.js';

export const adminRouter: ExpressRouter = Router();

adminRouter.use(requireAuth, requireAdmin);

adminRouter.get('/stats', async (_req, res, next) => {
  try {
    res.status(200).json(await getAdminStats());
  } catch (error) {
    next(error);
  }
});

adminRouter.get('/scrape-runs', async (req, res, next) => {
  try {
    const query = validateScrapeRunsQuery(req.query as Record<string, unknown>);
    res.status(200).json(await listScrapeRuns(query));
  } catch (error) {
    next(error);
  }
});

adminRouter.get('/scrape-runs/:id', async (req, res, next) => {
  try {
    res.status(200).json(await getScrapeRunById(Number(req.params.id)));
  } catch (error) {
    next(error);
  }
});
