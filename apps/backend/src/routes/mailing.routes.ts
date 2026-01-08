import express from 'express';
import { sendBulkEmail } from '../controllers/mailing.controller';
import { authenticate, authorize } from '../middleware/auth';
import { UserRole } from '@prisma/client';

const router = express.Router();

router.use(authenticate);

// Send bulk email - only ADMIN and MANAGER can send bulk emails
router.post('/send-bulk', authorize(UserRole.ADMIN, UserRole.MANAGER), sendBulkEmail);

export default router;
