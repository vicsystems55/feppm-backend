import { Router } from 'express';

const router = Router();

router.get('/health', (_request, response) => {
  response.json({
    success: true,
    message: 'FEPPM API is healthy',
    timestamp: new Date().toISOString(),
  });
});

export default router;
