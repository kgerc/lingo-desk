import express from 'express';
import { sendBulkEmail, getDebtorsCount } from '../controllers/mailing.controller';
import { authenticate, authorize } from '../middleware/auth';
import { UserRole } from '@prisma/client';

const router = express.Router();

router.use(authenticate);

// Get debtors count
router.get('/debtors-count', authorize(UserRole.ADMIN, UserRole.MANAGER), getDebtorsCount);

// Send bulk email - only ADMIN and MANAGER can send bulk emails
router.post('/send-bulk', authorize(UserRole.ADMIN, UserRole.MANAGER), sendBulkEmail);

export default router;
