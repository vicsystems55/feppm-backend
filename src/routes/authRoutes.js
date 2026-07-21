import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';

import { getCurrentUser, login, logout, refreshSession } from '../controllers/authController.js';
import { authenticate, requireRole } from '../middleware/auth.js';

const router = Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { success: false, message: 'Too many login attempts. Please try again later.' },
});

router.post('/login', loginLimiter, login);
router.post('/refresh', refreshSession);
router.post('/logout', logout);
router.get('/me', authenticate, requireRole('SUPER_ADMIN'), getCurrentUser);

export default router;
