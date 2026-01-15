import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import { UserRole } from '@prisma/client';
import courseTypeController from '../controllers/courseType.controller';

const router = Router();
router.use(authenticate);

// GET /api/course-types - List all course types
router.get('/', courseTypeController.getCourseTypes.bind(courseTypeController));

// GET /api/course-types/:id - Get course type by ID
router.get('/:id', courseTypeController.getCourseTypeById.bind(courseTypeController));

// POST /api/course-types - Create course type
router.post(
  '/',
  authorize(UserRole.ADMIN, UserRole.MANAGER),
  courseTypeController.createCourseType.bind(courseTypeController)
);

// PUT /api/course-types/:id - Update course type
router.put(
  '/:id',
  authorize(UserRole.ADMIN, UserRole.MANAGER),
  courseTypeController.updateCourseType.bind(courseTypeController)
);

// DELETE /api/course-types/:id - Delete course type
router.delete(
  '/:id',
  authorize(UserRole.ADMIN, UserRole.MANAGER),
  courseTypeController.deleteCourseType.bind(courseTypeController)
);

export default router;
