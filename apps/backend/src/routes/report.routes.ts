import { Router } from 'express';
import reportController from '../controllers/report.controller';
import { authenticate } from '../middleware/auth';

const router = Router();

// All report routes require authentication
router.use(authenticate);

// Report data endpoints
router.get('/teacher-payouts', reportController.getTeacherPayoutsReport);
router.get('/new-students', reportController.getNewStudentsReport);
router.get('/margins', reportController.getMarginsReport);
router.get('/debtors', reportController.getDebtorsReport);
router.get('/retention', reportController.getRetentionReport);

// Export endpoint
router.get('/export/:reportType', reportController.exportReport);

export default router;
