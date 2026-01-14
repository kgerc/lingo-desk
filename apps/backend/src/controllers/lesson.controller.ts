import { Response, NextFunction } from 'express';
import { z } from 'zod';
import lessonService from '../services/lesson.service';
import { AuthRequest } from '../middleware/auth';
import googleCalendarService from '../services/google-calendar.service';

const createLessonSchema = z.object({
  courseId: z.string().uuid().optional(),
  enrollmentId: z.string().optional(),
  teacherId: z.string().uuid(),
  studentId: z.string().uuid(),
  title: z.string().min(2),
  description: z.string().optional(),
  scheduledAt: z.string().transform((str) => new Date(str)),
  durationMinutes: z.number().int().positive().default(60),
  locationId: z.string().uuid().optional(),
  classroomId: z.string().uuid().optional(),
  deliveryMode: z.enum(['IN_PERSON', 'ONLINE']),
  meetingUrl: z.string().url().optional(),
  status: z.enum(['SCHEDULED', 'CONFIRMED', 'COMPLETED', 'CANCELLED', 'PENDING_CONFIRMATION', 'NO_SHOW']).default('SCHEDULED'),
  isRecurring: z.boolean().default(false),
  recurringPatternId: z.string().uuid().optional(),
  teacherRate: z.number().optional()
});

const updateLessonSchema = z.object({
  title: z.string().min(2).optional(),
  description: z.string().optional(),
  scheduledAt: z
    .string()
    .optional()
    .transform((str) => (str ? new Date(str) : undefined)),
  durationMinutes: z.number().int().positive().optional(),
  locationId: z.string().uuid().optional(),
  classroomId: z.string().uuid().optional(),
  deliveryMode: z.enum(['IN_PERSON', 'ONLINE']).optional(),
  meetingUrl: z.string().url().optional(),
  status: z.enum(['SCHEDULED', 'CONFIRMED', 'COMPLETED', 'CANCELLED', 'PENDING_CONFIRMATION', 'NO_SHOW']).optional(),
  cancellationReason: z.string().optional(),
  teacherRate: z.number().optional()
});

class LessonController {
  async getLessons(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { search, teacherId, studentId, courseId, status, startDate, endDate } = req.query;

      const filters: any = {};
      if (search) filters.search = String(search);
      if (teacherId) filters.teacherId = String(teacherId);
      if (studentId) filters.studentId = String(studentId);
      if (courseId) filters.courseId = String(courseId);
      if (status) filters.status = String(status);
      if (startDate) filters.startDate = String(startDate);
      if (endDate) filters.endDate = String(endDate);

      const lessons = await lessonService.getLessons(req.user.organizationId, filters);
      res.json({ message: 'Lessons retrieved successfully', data: lessons });
    } catch (error) {
      next(error);
    }
  }

  async getLessonById(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const lesson = await lessonService.getLessonById(id, req.user.organizationId);
      res.json({ message: 'Lesson retrieved successfully', data: lesson });
    } catch (error) {
      next(error);
    }
  }

  async createLesson(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const data = createLessonSchema.parse(req.body);
      const lesson = await lessonService.createLesson({
        ...data,
        organizationId: req.user.organizationId,
      });

      // Sync to Google Calendar asynchronously (don't block response)
      if (req.user?.id) {
        googleCalendarService.createEventFromLesson(lesson.id, req.user.id).catch(error => {
          console.error('Failed to sync lesson to Google Calendar:', error);
        });
      }

      res.status(201).json({ message: 'Lesson created successfully', data: lesson });
    } catch (error) {
      next(error);
    }
  }

  async updateLesson(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const data = updateLessonSchema.parse(req.body);
      const lesson = await lessonService.updateLesson(id, req.user.organizationId, data, req.user.id);

      // Sync to Google Calendar asynchronously (don't block response)
      if (req.user?.id) {
        googleCalendarService.updateEventFromLesson(id, req.user.id).catch(error => {
          console.error('Failed to update lesson in Google Calendar:', error);
        });
      }

      res.json({ message: 'Lesson updated successfully', data: lesson });
    } catch (error) {
      next(error);
    }
  }

  async deleteLesson(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;

      // Sync to Google Calendar asynchronously before deleting (don't block response)
      if (req.user?.id) {
        googleCalendarService.deleteEventFromLesson(id).catch(error => {
          console.error('Failed to delete lesson from Google Calendar:', error);
        });
      }

      const result = await lessonService.deleteLesson(id, req.user.organizationId);
      res.json(result);
    } catch (error) {
      next(error);
    }
  }

  async confirmLesson(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const lesson = await lessonService.confirmLesson(id, req.user.organizationId);
      res.json({ message: 'Lesson confirmed successfully', data: lesson });
    } catch (error) {
      next(error);
    }
  }

  async getStats(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const stats = await lessonService.getLessonStats(req.user.organizationId);
      res.json({ message: 'Lesson stats retrieved successfully', data: stats });
    } catch (error) {
      next(error);
    }
  }

  async checkConflicts(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { teacherId, studentId, scheduledAt, durationMinutes, excludeLessonId } = req.query;

      if (!teacherId || !studentId || !scheduledAt || !durationMinutes) {
        return res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Missing required parameters: teacherId, studentId, scheduledAt, durationMinutes',
          },
        });
      }

      const conflicts = await lessonService.checkConflicts(
        req.user.organizationId,
        String(teacherId),
        String(studentId),
        new Date(String(scheduledAt)),
        Number(durationMinutes),
        excludeLessonId ? String(excludeLessonId) : undefined
      );

      res.json({ message: 'Conflict check completed', data: conflicts });
    } catch (error) {
      next(error);
    }
  }

  async createRecurringLessons(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { lessonData, pattern } = req.body;

      if (!lessonData || !pattern) {
        return res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Missing lessonData or pattern',
          },
        });
      }

      const result = await lessonService.createRecurringLessons(
        req.user.organizationId,
        {
          ...lessonData,
          durationMinutes: Number(lessonData.durationMinutes),
        },
        {
          ...pattern,
          startDate: new Date(pattern.startDate),
          endDate: pattern.endDate ? new Date(pattern.endDate) : undefined,
          occurrencesCount: pattern.occurrencesCount ? Number(pattern.occurrencesCount) : undefined,
          interval: pattern.interval ? Number(pattern.interval) : 1,
        }
      );

      res.status(201).json({
        message: `Successfully created ${result.totalCreated} recurring lessons`,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }
}

export default new LessonController();
