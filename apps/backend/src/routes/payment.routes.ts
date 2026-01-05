import { Router } from 'express';
import paymentController from '../controllers/payment.controller';
import { authenticate } from '../middleware/auth';

const router = Router();

// All payment routes require authentication
router.use(authenticate);

// Statistics (must be before /:id route)
router.get('/stats', paymentController.getPaymentStats);

// Student payment history
router.get('/student/:studentId', paymentController.getStudentPaymentHistory);

// CRUD operations
router.get('/', paymentController.getPayments);
router.get('/:id', paymentController.getPaymentById);
router.post('/', paymentController.createPayment);
router.put('/:id', paymentController.updatePayment);
router.delete('/:id', paymentController.deletePayment);

export default router;
