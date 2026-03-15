import { Response, NextFunction } from 'express';
import { z } from 'zod';
import lessonService from '../services/lesson.service';
import { AuthRequest } from '../middleware/auth';
import googleCalendarService from '../services/google-calendar.service';
import microsoftTeamsService from '../services/microsoft-teams.service';
import emailService from '../services/email.service';
import prisma from '../utils/prisma';
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
  CONFIRMED: 'Potwierdzona',
  COMPLETED: 'Zakończona',
  CANCELLED_ON_TIME: 'Odwołana na czas',
  CANCELLED_LATE: 'Odwołana nie na czas',
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
  status: requiredEnum('Status', ['CONFIRMED', 'COMPLETED', 'CANCELLED_ON_TIME', 'CANCELLED_LATE'] as const, lessonStatusLabels).default('CONFIRMED'),
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
  status: optionalEnum('Status', ['CONFIRMED', 'COMPLETED', 'CANCELLED_ON_TIME', 'CANCELLED_LATE'] as const, lessonStatusLabels),
  cancellationReason: optionalString('Powód anulowania'),
  teacherRate: optionalNonNegative('Stawka lektora'),
});

class LessonController {
  async getLessons(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { search, teacherId, studentId, courseId, status, deliveryMode, startDate, endDate, page, pageSize, sortBy, sortOrder } = req.query;

      const filters: any = {};
      if (search) filters.search = String(search);
      if (teacherId) filters.teacherId = String(teacherId);
      if (studentId) filters.studentId = String(studentId);
      if (courseId) filters.courseId = String(courseId);
      if (status) filters.status = String(status);
      if (deliveryMode) filters.deliveryMode = String(deliveryMode);
      if (startDate) filters.startDate = String(startDate);
      if (endDate) filters.endDate = String(endDate);
      if (page) filters.page = parseInt(String(page), 10);
      if (pageSize) filters.pageSize = parseInt(String(pageSize), 10);
      if (sortBy) filters.sortBy = String(sortBy);
      if (sortOrder) filters.sortOrder = String(sortOrder);

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
        // Create Teams meeting if user has Teams connected and lesson is online
        microsoftTeamsService.createMeetingForLesson(lesson.id, req.user.id).catch(error => {
          console.error('Failed to create Microsoft Teams meeting:', error);
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
        // Update or create Teams meeting
        microsoftTeamsService.updateMeetingForLesson(id as string, req.user.id).catch(error => {
          console.error('Failed to update Microsoft Teams meeting:', error);
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

      // Sync to external calendars asynchronously before deleting (don't block response)
      if (req.user?.id) {
        googleCalendarService.deleteEventFromLesson(id as string).catch(error => {
          console.error('Failed to delete lesson from Google Calendar:', error);
        });
        microsoftTeamsService.deleteMeetingForLesson(id as string, req.user.id).catch(error => {
          console.error('Failed to delete Microsoft Teams meeting:', error);
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

  async bulkUpdateStatus(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const organizationId = req.user!.organizationId;
      const { lessonIds, status } = req.body;

      if (!Array.isArray(lessonIds) || lessonIds.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Wymagana jest lista lekcji do aktualizacji',
        });
      }

      const validStatuses = ['CONFIRMED', 'COMPLETED', 'CANCELLED_ON_TIME', 'CANCELLED_LATE'];
      if (!validStatuses.includes(status)) {
        return res.status(400).json({
          success: false,
          message: `Nieprawidłowy status. Dozwolone: ${validStatuses.join(', ')}`,
        });
      }

      const results = await lessonService.bulkUpdateStatus(
        lessonIds,
        status,
        organizationId,
        req.user!.id
      );

      return res.json({
        success: true,
        data: results,
        message: `Zaktualizowano ${results.updated} lekcji${results.failed > 0 ? `, ${results.failed} błędów` : ''}`,
      });
    } catch (error) {
      return next(error);
    }
  }

  async setRecording(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const { recordingUrl, sendEmail } = req.body;
      const organizationId = req.user!.organizationId;

      if (!recordingUrl || typeof recordingUrl !== 'string') {
        return res.status(400).json({ success: false, error: { message: 'Link do nagrania jest wymagany' } });
      }

      const lesson = await prisma.lesson.update({
        where: { id: id as string, organizationId },
        data: { recordingUrl },
        include: {
          student: { include: { user: { select: { email: true, firstName: true, lastName: true } } } },
          teacher: { include: { user: { select: { firstName: true, lastName: true } } } },
        },
      });

      if (sendEmail && lesson.student?.user?.email) {
        const studentName = `${lesson.student.user.firstName} ${lesson.student.user.lastName}`;
        const teacherName = `${lesson.teacher?.user?.firstName} ${lesson.teacher?.user?.lastName}`;
        const lessonDate = new Date(lesson.scheduledAt).toLocaleDateString('pl-PL', {
          day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit',
        });
        await emailService.sendEmail({
          to: lesson.student.user.email,
          subject: `Nagranie z lekcji – ${lesson.title}`,
          html: `
            <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #1e293b;">Nagranie z Twojej lekcji jest dostępne</h2>
              <p>Cześć ${studentName},</p>
              <p>Nagranie z lekcji <strong>${lesson.title}</strong> z dnia ${lessonDate} (lektor: ${teacherName}) jest gotowe do obejrzenia.</p>
              <p style="margin: 24px 0;">
                <a href="${recordingUrl}" style="background: #3b82f6; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: bold;">
                  Obejrzyj nagranie
                </a>
              </p>
              <p style="color: #64748b; font-size: 14px;">Jeśli przycisk nie działa, skopiuj i wklej poniższy link w przeglądarce:<br>${recordingUrl}</p>
            </div>
          `,
        });
      }

      return res.json({ success: true, data: lesson });
    } catch (error) {
      return next(error);
    }
  }

  async deleteRecording(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const organizationId = req.user!.organizationId;

      const lesson = await prisma.lesson.update({
        where: { id: id as string, organizationId },
        data: { recordingUrl: null },
      });

      return res.json({ success: true, data: lesson });
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
