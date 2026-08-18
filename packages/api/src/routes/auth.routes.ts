import { Router, type Router as ExpressRouter } from 'express';
import { login } from '../services/auth.service.js';
import { validateLoginBody } from '../validators/auth.validator.js';

export const authRouter: ExpressRouter = Router();

/** POST /api/auth/login — ruta pública. */
authRouter.post('/login', async (req, res, next) => {
  try {
    const body = validateLoginBody(req.body);
    const result = await login(body.email, body.password);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
});
