import { Router } from 'express';

import authRouter from './authRoutes.js';

const router = Router();

export function healthCheck(_request, response) {
  response.json({
    success: true,
    message: 'FEPPM API is healthy',
    timestamp: new Date().toISOString(),
  });
}

router.get('/health', healthCheck);
router.use('/auth', authRouter);

export default router;
