import { Response, NextFunction } from 'express';
import { z } from 'zod';
import lessonService from '../services/lesson.service';
import { AuthRequest } from '../middleware/auth';
import googleCalendarService from '../services/google-calendar.service';
import {
  requiredUuid,
  optionalUuid,
  requiredString,
  optionalString,
  requiredEnum,
  optionalEnum,
  requiredPositiveInt,
  optionalPositiveInt,
  optionalNonNegative,
  requiredBoolean,
  requiredDateString,
  optionalDateString,
  optionalUrl,
} from '../utils/validation-messages';

// Polish labels for enums
const lessonDeliveryModeLabels = { IN_PERSON: 'Stacjonarnie', ONLINE: 'Online' };
const lessonStatusLabels = {
  SCHEDULED: 'Zaplanowana',
  CONFIRMED: 'Potwierdzona',
  COMPLETED: 'Zakończona',
  CANCELLED: 'Anulowana',
  PENDING_CONFIRMATION: 'Oczekuje na potwierdzenie',
  NO_SHOW: 'Nieobecność',
};

const createLessonSchema = z.object({
  courseId: optionalUuid('Kurs'),
  enrollmentId: optionalString('Zapisanie'),
  teacherId: requiredUuid('Lektor'),
  studentId: requiredUuid('Uczeń'),
  title: requiredString('Tytuł', { min: 2 }),
  description: optionalString('Opis'),
  scheduledAt: requiredDateString('Data i godzina'),
  durationMinutes: requiredPositiveInt('Czas trwania').default(60),
  locationId: optionalUuid('Lokalizacja'),
  classroomId: optionalUuid('Sala'),
  deliveryMode: requiredEnum('Tryb lekcji', ['IN_PERSON', 'ONLINE'] as const, lessonDeliveryModeLabels),
  meetingUrl: optionalUrl('Link do spotkania'),
  status: requiredEnum('Status', ['SCHEDULED', 'CONFIRMED', 'COMPLETED', 'CANCELLED', 'PENDING_CONFIRMATION', 'NO_SHOW'] as const, lessonStatusLabels).default('SCHEDULED'),
  isRecurring: requiredBoolean('Cykliczna').default(false),
  recurringPatternId: optionalUuid('Wzorzec cykliczny'),
  teacherRate: optionalNonNegative('Stawka lektora'),
});

const updateLessonSchema = z.object({
  title: optionalString('Tytuł', { min: 2 }),
  description: optionalString('Opis'),
  scheduledAt: optionalDateString('Data i godzina'),
  durationMinutes: optionalPositiveInt('Czas trwania'),
  locationId: optionalUuid('Lokalizacja'),
  classroomId: optionalUuid('Sala'),
  deliveryMode: optionalEnum('Tryb lekcji', ['IN_PERSON', 'ONLINE'] as const, lessonDeliveryModeLabels),
  meetingUrl: optionalUrl('Link do spotkania'),
  status: optionalEnum('Status', ['SCHEDULED', 'CONFIRMED', 'COMPLETED', 'CANCELLED', 'PENDING_CONFIRMATION', 'NO_SHOW'] as const, lessonStatusLabels),
  cancellationReason: optionalString('Powód anulowania'),
  teacherRate: optionalNonNegative('Stawka lektora'),
});

class LessonController {
  async getLessons(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { search, teacherId, studentId, courseId, status, startDate, endDate, page, limit } = req.query;

      const filters: any = {};
      if (search) filters.search = String(search);
      if (teacherId) filters.teacherId = String(teacherId);
      if (studentId) filters.studentId = String(studentId);
      if (courseId) filters.courseId = String(courseId);
      if (status) filters.status = String(status);
      if (startDate) filters.startDate = String(startDate);
      if (endDate) filters.endDate = String(endDate);
      if (page) filters.page = parseInt(String(page), 10);
      if (limit) filters.limit = parseInt(String(limit), 10);

      const result = await lessonService.getLessons(req.user!.organizationId, filters);
      res.json({
        message: 'Lekcje pobrane pomyślnie',
        data: result.data,
        pagination: result.pagination,
      });
    } catch (error) {
      next(error);
    }
  }

  // Unpaginated endpoint for calendar views that need all lessons in date range
  async getLessonsForCalendar(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { teacherId, studentId, courseId, status, startDate, endDate } = req.query;

      const filters: any = {};
      if (teacherId) filters.teacherId = String(teacherId);
      if (studentId) filters.studentId = String(studentId);
      if (courseId) filters.courseId = String(courseId);
      if (status) filters.status = String(status);
      if (startDate) filters.startDate = String(startDate);
      if (endDate) filters.endDate = String(endDate);

      const lessons = await lessonService.getLessonsUnpaginated(req.user!.organizationId, filters);
      res.json({ message: 'Lekcje pobrane pomyślnie', data: lessons });
    } catch (error) {
      next(error);
    }
  }

  async getLessonById(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const lesson = await lessonService.getLessonById(id as string, req.user!.organizationId);
      res.json({ message: 'Lekcja pobrana pomyślnie', data: lesson });
    } catch (error) {
      next(error);
    }
  }

  async createLesson(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const data = createLessonSchema.parse(req.body);
      const lesson = await lessonService.createLesson({
        ...data,
        organizationId: req.user!.organizationId
      });

      // Sync to Google Calendar asynchronously (don't block response)
      if (req.user?.id) {
        googleCalendarService.createEventFromLesson(lesson.id, req.user.id).catch(error => {
          console.error('Failed to sync lesson to Google Calendar:', error);
        });
      }

      res.status(201).json({ message: 'Lekcja utworzona pomyślnie', data: lesson });
    } catch (error) {
      next(error);
    }
  }

  async updateLesson(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const data = updateLessonSchema.parse(req.body);
      const lesson = await lessonService.updateLesson(id as string, req.user!.organizationId, data, req.user!.id);

      // Sync to Google Calendar asynchronously (don't block response)
      if (req.user?.id) {
        googleCalendarService.updateEventFromLesson(id as string, req.user.id).catch(error => {
          console.error('Failed to update lesson in Google Calendar:', error);
        });
      }

      res.json({ message: 'Lekcja zaktualizowana pomyślnie', data: lesson });
    } catch (error) {
      next(error);
    }
  }

  async deleteLesson(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;

      // Sync to Google Calendar asynchronously before deleting (don't block response)
      if (req.user?.id) {
        googleCalendarService.deleteEventFromLesson(id as string).catch(error => {
          console.error('Failed to delete lesson from Google Calendar:', error);
        });
      }

      const result = await lessonService.deleteLesson(id as string, req.user!.organizationId);
      res.json(result);
    } catch (error) {
      next(error);
    }
  }

  async confirmLesson(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const lesson = await lessonService.confirmLesson(id as string, req.user!.organizationId);
      res.json({ message: 'Lekcja potwierdzona pomyślnie', data: lesson });
    } catch (error) {
      next(error);
    }
  }

  async getStats(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const stats = await lessonService.getLessonStats(req.user!.organizationId);
      res.json({ message: 'Statystyki lekcji pobrane pomyślnie', data: stats });
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
            message: 'Brak wymaganych parametrów: lektor, uczeń, data i godzina, czas trwania',
          },
        });
      }

      const conflicts = await lessonService.checkConflicts(
        req.user!.organizationId,
        String(teacherId),
        String(studentId),
        new Date(String(scheduledAt)),
        Number(durationMinutes),
        excludeLessonId ? String(excludeLessonId) : undefined
      );

      return res.json({ message: 'Conflict check completed', data: conflicts });
    } catch (error) {
      return next(error);
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
        req.user!.organizationId,
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

      return res.status(201).json({
        message: `Successfully created ${result.totalCreated} recurring lessons`,
        data: result,
      });
    } catch (error) {
      return next(error);
    }
  }

  async getCancellationFeePreview(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const preview = await lessonService.getCancellationFeePreview(id as string, req.user!.organizationId);
      return res.json({ message: 'Cancellation fee preview retrieved', data: preview });
    } catch (error) {
      return next(error);
    }
  }

  async getCancellationStats(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { studentId } = req.params;
      const stats = await lessonService.getCancellationStats(studentId as string, req.user!.organizationId);
      return res.json({ message: 'Cancellation stats retrieved', data: stats });
    } catch (error) {
      return next(error);
    }
  }
}

export default new LessonController();
