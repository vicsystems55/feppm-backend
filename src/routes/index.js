import { Router } from 'express';

const router = Router();

export function healthCheck(_request, response) {
  response.json({
    success: true,
    message: 'FEPPM API is healthy',
    timestamp: new Date().toISOString(),
  });
}

router.get('/health', healthCheck);

export default router;
