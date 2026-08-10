import './load-env.js';
import { createApp } from './app.js';
import { logger } from './logger.js';

const port = Number(process.env.API_PORT ?? 3001);
const app = createApp();

app.listen(port, () => {
  logger.info(`API listening on http://localhost:${port}`);
});
