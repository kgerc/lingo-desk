import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import {
  previewPayout,
  createPayout,
  getPayouts,
  getPayoutById,
  getTeacherPayouts,
  updatePayoutStatus,
  deletePayout,
  getTeachersSummary,
  getLessonsForDay,
} from '../controllers/payout.controller';

const router = Router();

// All routes require authentication
router.use(authenticate);

// Teachers summary for payouts overview
router.get('/teachers-summary', getTeachersSummary);

// Get all payouts (with optional filters)
router.get('/', getPayouts);

// Create new payout
router.post('/', createPayout);

// Get specific payout by ID
router.get('/:id', getPayoutById);

// Update payout status
router.patch('/:id/status', updatePayoutStatus);

// Delete payout
router.delete('/:id', deletePayout);

// Teacher-specific routes
router.get('/teacher/:teacherId', getTeacherPayouts);
router.get('/teacher/:teacherId/preview', previewPayout);
router.get('/teacher/:teacherId/lessons', getLessonsForDay);

export default router;
