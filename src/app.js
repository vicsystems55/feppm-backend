import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import morgan from 'morgan';

import { env } from './config/env.js';
import { errorHandler, notFound } from './middleware/error.js';
import apiRouter, { healthCheck } from './routes/index.js';

const app = express();

app.use(helmet());
app.use(cors({ origin: env.clientUrl, credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan(env.nodeEnv === 'production' ? 'combined' : 'dev'));

app.get('/health', healthCheck);
app.use('/api/v1', apiRouter);

app.use(notFound);
app.use(errorHandler);

export default app;
