import { Router, type Router as ExpressRouter } from 'express';
import { getCategoryFilters, listCategories } from '../services/category.service.js';

export const categoriesRouter: ExpressRouter = Router();

categoriesRouter.get('/', (_req, res, next) => {
  try {
    res.status(200).json(listCategories());
  } catch (error) {
    next(error);
  }
});

categoriesRouter.get('/:slug/filters', async (req, res, next) => {
  try {
    const result = await getCategoryFilters(String(req.params.slug));
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
});
