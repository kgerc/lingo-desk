import { Response, NextFunction } from 'express';
import { z } from 'zod';
import attendanceService from '../services/attendance.service';
import { AuthRequest } from '../middleware/auth';
import { requiredUuid, optionalString, requiredEnum, optionalEnum } from '../utils/validation-messages';

const attendanceStatusValues = ['PRESENT', 'ABSENT', 'LATE', 'EXCUSED'] as const;
const attendanceStatusLabels = {
  PRESENT: 'Obecny',
  ABSENT: 'Nieobecny',
  LATE: 'Spóźniony',
  EXCUSED: 'Usprawiedliwiony',
};

const createAttendanceSchema = z.object({
  lessonId: requiredUuid('Lekcja'),
  studentId: requiredUuid('Uczeń'),
  status: requiredEnum('Status obecności', attendanceStatusValues, attendanceStatusLabels),
  notes: optionalString('Notatki'),
});

const updateAttendanceSchema = z.object({
  status: optionalEnum('Status obecności', attendanceStatusValues, attendanceStatusLabels),
  notes: optionalString('Notatki'),
});

const bulkUpsertAttendanceSchema = z.object({
  lessonId: requiredUuid('Lekcja'),
  attendances: z.array(
    z.object({
      studentId: requiredUuid('Uczeń'),
      status: requiredEnum('Status obecności', attendanceStatusValues, attendanceStatusLabels),
      notes: optionalString('Notatki'),
    })
  ),
});

class AttendanceController {
  async createAttendance(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const data = createAttendanceSchema.parse(req.body);
      const attendance = await attendanceService.createAttendance(data, req.user!.organizationId);
      res.status(201).json({ message: 'Obecność została zapisana pomyślnie', data: attendance });
    } catch (error) {
      next(error);
    }
  }

  async updateAttendance(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { lessonId, studentId } = req.params;
      const data = updateAttendanceSchema.parse(req.body);
      const attendance = await attendanceService.updateAttendance(
        lessonId as string,
        studentId as string,
        data, 
        req.user!.organizationId
      );
      res.json({ message: 'Obecność została zaktualizowana pomyślnie', data: attendance });
    } catch (error) {
      next(error);
    }
  }

  async getAttendanceByLesson(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { lessonId } = req.params;
      const attendances = await attendanceService.getAttendanceByLesson(lessonId as string, req.user!.organizationId);
      res.json({ message: 'Lista obecności pobrana pomyślnie', data: attendances });
    } catch (error) {
      next(error);
    }
  }

  async deleteAttendance(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { lessonId, studentId } = req.params;
      const result = await attendanceService.deleteAttendance(lessonId as string, studentId as string, req.user!.organizationId);
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
        req.user!.organizationId
      );
      res.json({ message: 'Lista obecności zaktualizowana pomyślnie', data: result });
    } catch (error) {
      next(error);
    }
  }
}

export default new AttendanceController();
