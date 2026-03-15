import { Router } from 'express';
import authController from '../controllers/auth.controller';
import { authenticate } from '../middleware/auth';
import { authLimiter } from '../middleware/rateLimiter';

const router = Router();

router.post('/register', authLimiter, authController.register.bind(authController));
router.post('/login', authLimiter, authController.login.bind(authController));
router.post('/google', authLimiter, authController.googleAuth.bind(authController));
router.get('/me', authenticate, authController.getMe.bind(authController));
router.post('/forgot-password', authLimiter, authController.forgotPassword.bind(authController));
router.post('/reset-password', authLimiter, authController.resetPassword.bind(authController));

export default router;
