import { Response, NextFunction } from 'express';
import { z } from 'zod';
import attendanceService from '../services/attendance.service';
import { AuthRequest } from '../middleware/auth';

const createAttendanceSchema = z.object({
  lessonId: z.string().uuid(),
  studentId: z.string().uuid(),
  status: z.enum(['PRESENT', 'ABSENT', 'LATE', 'EXCUSED']),
  notes: z.string().optional(),
});

const updateAttendanceSchema = z.object({
  status: z.enum(['PRESENT', 'ABSENT', 'LATE', 'EXCUSED']).optional(),
  notes: z.string().optional(),
});

const bulkUpsertAttendanceSchema = z.object({
  lessonId: z.string().uuid(),
  attendances: z.array(
    z.object({
      studentId: z.string().uuid(),
      status: z.enum(['PRESENT', 'ABSENT', 'LATE', 'EXCUSED']),
      notes: z.string().optional(),
    })
  ),
});

class AttendanceController {
  async createAttendance(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const data = createAttendanceSchema.parse(req.body);
      const attendance = await attendanceService.createAttendance(data, req.user.organizationId);
      res.status(201).json({ message: 'Attendance created successfully', data: attendance });
    } catch (error) {
      next(error);
    }
  }

  async updateAttendance(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { lessonId, studentId } = req.params;
      const data = updateAttendanceSchema.parse(req.body);
      const attendance = await attendanceService.updateAttendance(
        lessonId,
        studentId,
        data,
        req.user.organizationId
      );
      res.json({ message: 'Attendance updated successfully', data: attendance });
    } catch (error) {
      next(error);
    }
  }

  async getAttendanceByLesson(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { lessonId } = req.params;
      const attendances = await attendanceService.getAttendanceByLesson(lessonId, req.user.organizationId);
      res.json({ message: 'Attendances retrieved successfully', data: attendances });
    } catch (error) {
      next(error);
    }
  }

  async deleteAttendance(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { lessonId, studentId } = req.params;
      const result = await attendanceService.deleteAttendance(lessonId, studentId, req.user.organizationId);
      res.json(result);
    } catch (error) {
      next(error);
    }
  }

  async bulkUpsertAttendance(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { lessonId, attendances } = bulkUpsertAttendanceSchema.parse(req.body);
      const result = await attendanceService.bulkUpsertAttendance(
        lessonId,
        attendances,
        req.user.organizationId
      );
      res.json({ message: 'Attendances updated successfully', data: result });
    } catch (error) {
      next(error);
    }
  }
}

export default new AttendanceController();
