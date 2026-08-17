import { Router, type Router as ExpressRouter } from 'express';
import { getProductById, listProducts } from '../services/product.service.js';
import { validateProductQuery } from '../validators/product-query.validator.js';

export const productsRouter: ExpressRouter = Router();

productsRouter.get('/', async (req, res, next) => {
  try {
    const validated = validateProductQuery(req.query as Record<string, unknown>);
    const result = await listProducts(validated);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
});

productsRouter.get('/:id', async (req, res, next) => {
  try {
    const result = await getProductById(Number(req.params.id));
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
});
