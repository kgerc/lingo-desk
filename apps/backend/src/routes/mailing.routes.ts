import express from 'express';
import multer from 'multer';
import { sendBulkEmail, getDebtorsCount } from '../controllers/mailing.controller';
import { authenticate, authorize } from '../middleware/auth';
import { UserRole } from '@prisma/client';

const router = express.Router();

// Configure multer for file uploads
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB per file
    files: 10, // Maximum 10 files
  },
});

router.use(authenticate);

// Get debtors count
router.get('/debtors-count', authorize(UserRole.ADMIN, UserRole.MANAGER), getDebtorsCount);

// Send bulk email with attachments - only ADMIN and MANAGER can send bulk emails
router.post('/send-bulk', authorize(UserRole.ADMIN, UserRole.MANAGER), upload.array('attachments', 10), sendBulkEmail);

export default router;
