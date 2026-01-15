import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import { UserRole } from '@prisma/client';
import courseController from '../controllers/course.controller';

const router = Router();
router.use(authenticate);

// GET /api/courses/stats - Get course statistics
router.get(
  '/stats',
  authorize(UserRole.ADMIN, UserRole.MANAGER),
  courseController.getStats.bind(courseController)
);

// GET /api/courses - List all courses
router.get(
  '/',
  authorize(UserRole.ADMIN, UserRole.MANAGER, UserRole.TEACHER),
  courseController.getCourses.bind(courseController)
);

// GET /api/courses/:id - Get course by ID
router.get('/:id', courseController.getCourseById.bind(courseController));

// POST /api/courses - Create course
router.post(
  '/',
  authorize(UserRole.ADMIN, UserRole.MANAGER),
  courseController.createCourse.bind(courseController)
);

// PUT /api/courses/:id - Update course
router.put(
  '/:id',
  authorize(UserRole.ADMIN, UserRole.MANAGER),
  courseController.updateCourse.bind(courseController)
);

// POST /api/courses/:id/enroll - Enroll student in course
router.post(
  '/:id/enroll',
  authorize(UserRole.ADMIN, UserRole.MANAGER),
  courseController.enrollStudent.bind(courseController)
);

// DELETE /api/courses/enrollments/:enrollmentId - Unenroll student
router.delete(
  '/enrollments/:enrollmentId',
  authorize(UserRole.ADMIN, UserRole.MANAGER),
  courseController.unenrollStudent.bind(courseController)
);

// DELETE /api/courses/:id - Delete course
router.delete(
  '/:id',
  authorize(UserRole.ADMIN, UserRole.MANAGER),
  courseController.deleteCourse.bind(courseController)
);

export default router;
