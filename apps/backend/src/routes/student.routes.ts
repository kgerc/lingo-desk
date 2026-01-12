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

// GET /api/students/enrollment/:enrollmentId/budget - Get enrollment budget
router.get(
  '/enrollment/:enrollmentId/budget',
  studentController.getEnrollmentBudget.bind(studentController)
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

// DELETE /api/students/:id - Delete student
router.delete(
  '/:id',
  authorize(UserRole.ADMIN),
  studentController.deleteStudent.bind(studentController)
);

export default router;
