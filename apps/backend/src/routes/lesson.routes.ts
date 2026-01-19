import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import { UserRole } from '@prisma/client';
import lessonController from '../controllers/lesson.controller';

const router = Router();
router.use(authenticate);

// Get all lessons
router.get('/', lessonController.getLessons.bind(lessonController));

// Get lesson stats
router.get('/stats', lessonController.getStats.bind(lessonController));

// Check for conflicts
router.get('/check-conflicts', lessonController.checkConflicts.bind(lessonController));

// Create recurring lessons (teachers, managers, admins)
router.post(
  '/recurring',
  authorize(UserRole.ADMIN, UserRole.MANAGER, UserRole.TEACHER),
  lessonController.createRecurringLessons.bind(lessonController)
);

// Get cancellation fee preview for a lesson
router.get('/:id/cancellation-fee-preview', lessonController.getCancellationFeePreview.bind(lessonController));

// Get cancellation stats for a student
router.get('/student/:studentId/cancellation-stats', lessonController.getCancellationStats.bind(lessonController));

// Get lesson by ID
router.get('/:id', lessonController.getLessonById.bind(lessonController));

// Create new lesson (teachers, managers, admins)
router.post(
  '/',
  authorize(UserRole.ADMIN, UserRole.MANAGER, UserRole.TEACHER),
  lessonController.createLesson.bind(lessonController)
);

// Update lesson (teachers, managers, admins)
router.put(
  '/:id',
  authorize(UserRole.ADMIN, UserRole.MANAGER, UserRole.TEACHER),
  lessonController.updateLesson.bind(lessonController)
);

// Delete lesson (managers, admins)
router.delete(
  '/:id',
  authorize(UserRole.ADMIN, UserRole.MANAGER),
  lessonController.deleteLesson.bind(lessonController)
);

// Confirm lesson (teachers, managers, admins)
router.post(
  '/:id/confirm',
  authorize(UserRole.ADMIN, UserRole.MANAGER, UserRole.TEACHER),
  lessonController.confirmLesson.bind(lessonController)
);

export default router;
