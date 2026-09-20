import { Router } from 'express';
import * as authController from '../controllers/auth.controller';
import { authenticate } from '../middleware/auth.middleware';
import rateLimit from 'express-rate-limit';
import { config } from '../config/env';

const router = Router();

const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: config.AUTH_RATE_LIMIT_MAX,
    // Only failed attempts count, so a whole office behind one IP is not locked out
    // by everyone signing in on Monday morning.
    skipSuccessfulRequests: true,
    message: {
        data: null,
        error: { message: 'Too many failed sign-in attempts, please try again in 15 minutes', code: 429 },
        message: 'Too many failed sign-in attempts, please try again in 15 minutes'
    },
    standardHeaders: true,
    legacyHeaders: false,
});

router.post('/login', authLimiter, authController.login);
router.post('/refresh', authController.refresh);
router.post('/logout', authController.logout);
router.get('/me', authenticate, authController.getMe);

export default router;
