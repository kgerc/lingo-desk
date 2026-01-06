import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import { UserRole } from '@prisma/client';
import teacherController from '../controllers/teacher.controller';

const router = Router();
router.use(authenticate);

// GET /api/teachers/stats - Get teacher statistics
router.get(
  '/stats',
  authorize(UserRole.ADMIN, UserRole.MANAGER),
  teacherController.getStats.bind(teacherController)
);

// GET /api/teachers - List all teachers
router.get(
  '/',
  authorize(UserRole.ADMIN, UserRole.MANAGER),
  teacherController.getTeachers.bind(teacherController)
);

// GET /api/teachers/me - Get logged-in teacher's data (MUST be before /:id)
router.get(
  '/me',
  authorize(UserRole.TEACHER),
  teacherController.getMe.bind(teacherController)
);

// GET /api/teachers/:id - Get teacher by ID
router.get('/:id', teacherController.getTeacherById.bind(teacherController));

// POST /api/teachers - Create teacher
router.post(
  '/',
  authorize(UserRole.ADMIN, UserRole.MANAGER),
  teacherController.createTeacher.bind(teacherController)
);

// PUT /api/teachers/:id - Update teacher
router.put('/:id', teacherController.updateTeacher.bind(teacherController));

// PUT /api/teachers/:id/availability - Set teacher availability
router.put(
  '/:id/availability',
  teacherController.setAvailability.bind(teacherController)
);

// ============================================
// TEACHER SCHEDULE MANAGEMENT
// ============================================

// GET /api/teachers/me/schedule - Get logged-in teacher's schedule
router.get(
  '/me/schedule',
  authorize(UserRole.TEACHER),
  teacherController.getMySchedule.bind(teacherController)
);

// GET /api/teachers/:id/availability/exceptions - Get availability exceptions
router.get(
  '/:id/availability/exceptions',
  teacherController.getAvailabilityExceptions.bind(teacherController)
);

// POST /api/teachers/:id/availability/exceptions - Add availability exception
router.post(
  '/:id/availability/exceptions',
  teacherController.addAvailabilityException.bind(teacherController)
);

// DELETE /api/teachers/:id/availability/exceptions/:exceptionId - Delete exception
router.delete(
  '/:id/availability/exceptions/:exceptionId',
  teacherController.deleteAvailabilityException.bind(teacherController)
);

// GET /api/teachers/:id/preferences - Get teacher preferences
router.get(
  '/:id/preferences',
  teacherController.getPreferences.bind(teacherController)
);

// PUT /api/teachers/:id/preferences - Update teacher preferences
router.put(
  '/:id/preferences',
  teacherController.updatePreferences.bind(teacherController)
);

// DELETE /api/teachers/:id - Delete teacher
router.delete(
  '/:id',
  authorize(UserRole.ADMIN),
  teacherController.deleteTeacher.bind(teacherController)
);

export default router;
