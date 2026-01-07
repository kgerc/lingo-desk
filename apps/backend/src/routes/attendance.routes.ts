import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import { UserRole } from '@prisma/client';
import attendanceController from '../controllers/attendance.controller';

const router = Router();
router.use(authenticate);

// Get attendance for a specific lesson
router.get('/lesson/:lessonId', attendanceController.getAttendanceByLesson.bind(attendanceController));

// Create attendance record (teachers, managers, admins)
router.post(
  '/',
  authorize(UserRole.ADMIN, UserRole.MANAGER, UserRole.TEACHER),
  attendanceController.createAttendance.bind(attendanceController)
);

// Bulk upsert attendance records (teachers, managers, admins)
router.post(
  '/bulk-upsert',
  authorize(UserRole.ADMIN, UserRole.MANAGER, UserRole.TEACHER),
  attendanceController.bulkUpsertAttendance.bind(attendanceController)
);

// Update attendance record (teachers, managers, admins)
router.put(
  '/:lessonId/:studentId',
  authorize(UserRole.ADMIN, UserRole.MANAGER, UserRole.TEACHER),
  attendanceController.updateAttendance.bind(attendanceController)
);

// Delete attendance record (managers, admins)
router.delete(
  '/:lessonId/:studentId',
  authorize(UserRole.ADMIN, UserRole.MANAGER),
  attendanceController.deleteAttendance.bind(attendanceController)
);

export default router;
