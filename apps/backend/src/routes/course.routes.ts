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

// POST /api/courses/with-schedule - Create course with schedule (lessons)
router.post(
  '/with-schedule',
  authorize(UserRole.ADMIN, UserRole.MANAGER),
  courseController.createCourseWithSchedule.bind(courseController)
);

// PUT /api/courses/:id - Update course
router.put(
  '/:id',
  authorize(UserRole.ADMIN, UserRole.MANAGER),
  courseController.updateCourse.bind(courseController)
);

// GET /api/courses/:id/delete-impact - Get impact summary before deleting
router.get(
  '/:id/delete-impact',
  authorize(UserRole.ADMIN, UserRole.MANAGER),
  courseController.getDeleteImpact.bind(courseController)
);

// GET /api/courses/:id/lessons - Get course lessons with edit status
router.get(
  '/:id/lessons',
  authorize(UserRole.ADMIN, UserRole.MANAGER),
  courseController.getCourseLessonsForEdit.bind(courseController)
);

// PUT /api/courses/:id/lessons/bulk - Bulk update future lessons
router.put(
  '/:id/lessons/bulk',
  authorize(UserRole.ADMIN, UserRole.MANAGER),
  courseController.bulkUpdateCourseLessons.bind(courseController)
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

// DELETE /api/courses/bulk - Bulk delete courses
router.delete(
  '/bulk',
  authorize(UserRole.ADMIN, UserRole.MANAGER),
  courseController.bulkDelete.bind(courseController)
);

// DELETE /api/courses/:id - Delete course
router.delete(
  '/:id',
  authorize(UserRole.ADMIN, UserRole.MANAGER),
  courseController.deleteCourse.bind(courseController)
);

export default router;
