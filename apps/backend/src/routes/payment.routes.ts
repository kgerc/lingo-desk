import { Router } from 'express';
import paymentController from '../controllers/payment.controller';
import { authenticate } from '../middleware/auth';

const router = Router();

// All payment routes require authentication
router.use(authenticate);

// Statistics (must be before /:id route)
router.get('/stats', paymentController.getPaymentStats);

// Debtors list
router.get('/debtors', paymentController.getDebtors);

// Student payment history
router.get('/student/:studentId', paymentController.getStudentPaymentHistory);

// Import payments from CSV (legacy)
router.post('/import', paymentController.importPayments);

// Smart CSV import (analyze + execute)
router.post('/import/analyze', paymentController.analyzeCsvImport);
router.post('/import/execute', paymentController.executeCsvImport);
router.post('/import/assign-unmatched', paymentController.assignUnmatchedPayment);

// CRUD operations
router.get('/', paymentController.getPayments);
router.get('/:id', paymentController.getPaymentById);
router.post('/', paymentController.createPayment);
router.put('/:id', paymentController.updatePayment);
router.delete('/:id', paymentController.deletePayment);

// Payment reminders
router.post('/:id/reminder', paymentController.sendReminder);
router.get('/:id/reminder/status', paymentController.getReminderStatus);
router.get('/:id/reminders', paymentController.getPaymentReminders);

export default router;
