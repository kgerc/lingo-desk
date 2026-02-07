import express from 'express';
import { authenticate, authorize } from '../middleware/auth';
import { UserRole } from '@prisma/client';
import courseApplicationController from '../controllers/courseApplication.controller';

const router = express.Router();

// === PUBLIC ENDPOINTS (no auth required) ===
router.get(
  '/public/:orgSlug/courses',
  courseApplicationController.getPublicCourses.bind(courseApplicationController),
);

router.post(
  '/public/:orgSlug',
  courseApplicationController.createPublicApplication.bind(courseApplicationController),
);

// === PROTECTED ENDPOINTS ===
router.use(authenticate);

router.get(
  '/',
  authorize(UserRole.ADMIN, UserRole.MANAGER),
  courseApplicationController.getApplications.bind(courseApplicationController),
);

router.get(
  '/:id',
  authorize(UserRole.ADMIN, UserRole.MANAGER),
  courseApplicationController.getApplicationById.bind(courseApplicationController),
);

router.put(
  '/:id/status',
  authorize(UserRole.ADMIN, UserRole.MANAGER),
  courseApplicationController.updateStatus.bind(courseApplicationController),
);

router.post(
  '/:id/convert',
  authorize(UserRole.ADMIN, UserRole.MANAGER),
  courseApplicationController.convertToStudent.bind(courseApplicationController),
);

export default router;
