import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import { UserRole } from '@prisma/client';
import studentController from '../controllers/student.controller';

const router = Router();
router.use(authenticate);

// GET /api/students/stats - Get student statistics
router.get(
  '/stats',
  authorize(UserRole.ADMIN, UserRole.MANAGER),
  studentController.getStats.bind(studentController)
);

// GET /api/students - List all students
router.get(
  '/',
  authorize(UserRole.ADMIN, UserRole.MANAGER),
  studentController.getStudents.bind(studentController)
);

// GET /api/students/archived - List archived students (must be before /:id)
router.get(
  '/archived',
  authorize(UserRole.ADMIN, UserRole.MANAGER),
  studentController.getArchivedStudents.bind(studentController)
);

// GET /api/students/enrollment/:enrollmentId/budget - Get enrollment budget
router.get(
  '/enrollment/:enrollmentId/budget',
  studentController.getEnrollmentBudget.bind(studentController)
);

// GET /api/students/me - Get current student's own profile (for STUDENT role)
router.get('/me', studentController.getMe.bind(studentController));

// GET /api/students/:id/activity - Get student login activity history
router.get(
  '/:id/activity',
  authorize(UserRole.ADMIN, UserRole.MANAGER),
  studentController.getStudentActivity.bind(studentController)
);

// GET /api/students/:id - Get student by ID
router.get('/:id', studentController.getStudentById.bind(studentController));

// POST /api/students - Create student
router.post(
  '/',
  authorize(UserRole.ADMIN, UserRole.MANAGER),
  studentController.createStudent.bind(studentController)
);

// POST /api/students/import/preview - Preview CSV file
router.post(
  '/import/preview',
  authorize(UserRole.ADMIN, UserRole.MANAGER),
  studentController.previewCSV.bind(studentController)
);

// POST /api/students/import - Import students from CSV
router.post(
  '/import',
  authorize(UserRole.ADMIN, UserRole.MANAGER),
  studentController.importCSV.bind(studentController)
);

// PUT /api/students/:id - Update student
router.put('/:id', studentController.updateStudent.bind(studentController));

// POST /api/students/:id/restore - Restore archived student
router.post(
  '/:id/restore',
  authorize(UserRole.ADMIN, UserRole.MANAGER),
  studentController.restoreStudent.bind(studentController)
);

// DELETE /api/students/bulk - Bulk delete students
router.delete(
  '/bulk',
  authorize(UserRole.ADMIN, UserRole.MANAGER),
  studentController.bulkDelete.bind(studentController)
);

// DELETE /api/students/:id/purge - Permanently delete archived student (ADMIN only)
router.delete(
  '/:id/purge',
  authorize(UserRole.ADMIN),
  studentController.purgeStudent.bind(studentController)
);

// DELETE /api/students/:id - Archive student (soft delete)
router.delete(
  '/:id',
  authorize(UserRole.ADMIN, UserRole.MANAGER),
  studentController.deleteStudent.bind(studentController)
);

export default router;
