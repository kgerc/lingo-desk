import { Router } from 'express';
import balanceController from '../controllers/balance.controller';
import { authenticate, authorize } from '../middleware/auth';

const router = Router();

// All routes require authentication
router.use(authenticate);

// Student portal routes (own balance)
router.get('/my', balanceController.getMyBalance);
router.get('/my/transactions', balanceController.getMyTransactionHistory);

// Admin/Manager routes (any student's balance)
router.get('/:studentId', authorize('ADMIN', 'MANAGER'), balanceController.getStudentBalance);
router.get('/:studentId/transactions', authorize('ADMIN', 'MANAGER'), balanceController.getTransactionHistory);
router.post('/:studentId/adjust', authorize('ADMIN', 'MANAGER'), balanceController.adjustBalance);

export default router;
