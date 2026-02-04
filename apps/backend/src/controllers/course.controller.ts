import { Response, NextFunction } from 'express';
import { z } from 'zod';
import { CourseFormat, LanguageLevel, CourseDeliveryMode } from '@prisma/client';
import courseService, { CreateCourseData, UpdateCourseData, CreateCourseWithScheduleData } from '../services/course.service';
import { AuthRequest } from '../middleware/auth';
import {
  requiredUuid,
  optionalUuid,
  requiredString,
  optionalString,
  requiredEnum,
  optionalEnum,
  requiredPositiveInt,
  optionalPositiveInt,
  requiredNonNegative,
  optionalNonNegative,
  requiredBoolean,
  optionalBoolean,
  requiredDateString,
  optionalDateString,
  optionalUrl,
} from '../utils/validation-messages';

// Enum values for Zod validation
const languageLevelValues = Object.values(LanguageLevel) as [string, ...string[]];
const courseFormatValues = Object.values(CourseFormat) as [string, ...string[]];
const courseDeliveryModeValues = Object.values(CourseDeliveryMode) as [string, ...string[]];

// Polish labels for enums
const courseTypeLabels = { GROUP: 'Grupowy', INDIVIDUAL: 'Indywidualny' };
const levelLabels = { A1: 'A1', A2: 'A2', B1: 'B1', B2: 'B2', C1: 'C1', C2: 'C2' };
const deliveryModeLabels = { IN_PERSON: 'Stacjonarnie', ONLINE: 'Online', BOTH: 'Hybrydowo' };
const lessonDeliveryModeLabels = { IN_PERSON: 'Stacjonarnie', ONLINE: 'Online' };
const frequencyLabels = { WEEKLY: 'Co tydzień', BIWEEKLY: 'Co dwa tygodnie', MONTHLY: 'Co miesiąc' };
const paymentModeLabels = { PACKAGE: 'Pakiet', PER_LESSON: 'Za lekcję' };

const createCourseSchema = z.object({
  teacherId: requiredUuid('Lektor'),
  name: requiredString('Nazwa kursu', { min: 2 }),
  courseType: requiredEnum('Typ kursu', courseFormatValues, courseTypeLabels),
  language: requiredString('Język', { min: 2 }),
  level: requiredEnum('Poziom', languageLevelValues, levelLabels),
  deliveryMode: requiredEnum('Tryb prowadzenia', courseDeliveryModeValues, deliveryModeLabels),
  defaultDurationMinutes: requiredPositiveInt('Domyślny czas trwania').default(60),
  pricePerLesson: requiredNonNegative('Cena za lekcję'),
  currency: requiredString('Waluta').default('PLN'),
  description: optionalString('Opis'),
  startDate: requiredDateString('Data rozpoczęcia'),
  endDate: optionalDateString('Data zakończenia'),
  maxStudents: optionalPositiveInt('Maksymalna liczba uczniów'),
  locationId: optionalUuid('Lokalizacja'),
  classroomId: optionalUuid('Sala'),
  isActive: requiredBoolean('Aktywny').default(true),
});

const updateCourseSchema = z.object({
  teacherId: optionalUuid('Lektor'),
  name: optionalString('Nazwa kursu', { min: 2 }),
  courseType: optionalEnum('Typ kursu', courseFormatValues, courseTypeLabels),
  language: optionalString('Język', { min: 2 }),
  level: optionalEnum('Poziom', languageLevelValues, levelLabels),
  deliveryMode: optionalEnum('Tryb prowadzenia', courseDeliveryModeValues, deliveryModeLabels),
  defaultDurationMinutes: optionalPositiveInt('Domyślny czas trwania'),
  pricePerLesson: optionalNonNegative('Cena za lekcję'),
  currency: optionalString('Waluta'),
  description: optionalString('Opis'),
  startDate: optionalDateString('Data rozpoczęcia'),
  endDate: optionalDateString('Data zakończenia'),
  maxStudents: optionalPositiveInt('Maksymalna liczba uczniów'),
  locationId: optionalUuid('Lokalizacja'),
  classroomId: optionalUuid('Sala'),
  isActive: optionalBoolean('Aktywny'),
});

const enrollStudentSchema = z.object({
  studentId: requiredUuid('Uczeń'),
  paymentMode: optionalEnum('Tryb płatności', ['PACKAGE', 'PER_LESSON'] as const, paymentModeLabels),
  hoursPurchased: optionalNonNegative('Liczba zakupionych godzin'),
});

const scheduleItemSchema = z.object({
  scheduledAt: requiredDateString('Data i godzina'),
  durationMinutes: requiredPositiveInt('Czas trwania'),
  title: optionalString('Tytuł'),
  deliveryMode: requiredEnum('Tryb lekcji', ['IN_PERSON', 'ONLINE'] as const, lessonDeliveryModeLabels),
  meetingUrl: optionalUrl('Link do spotkania'),
});

// Schema for individual day schedule with time
const dayScheduleSchema = z.object({
  dayOfWeek: z.number().int().min(0, { message: 'Dzień tygodnia musi być od 0 do 6' }).max(6, { message: 'Dzień tygodnia musi być od 0 do 6' }),
  time: z.string().regex(/^\d{2}:\d{2}$/, { message: 'Godzina musi być w formacie HH:MM' }),
});

const schedulePatternSchema = z.object({
  frequency: requiredEnum('Częstotliwość', ['WEEKLY', 'BIWEEKLY', 'MONTHLY'] as const, frequencyLabels),
  startDate: requiredDateString('Data rozpoczęcia'),
  endDate: optionalDateString('Data zakończenia'),
  occurrencesCount: optionalPositiveInt('Liczba powtórzeń'),
  // Legacy format: single time for all days
  daysOfWeek: z.array(z.number().int().min(0, { message: 'Dzień tygodnia musi być od 0 do 6' }).max(6, { message: 'Dzień tygodnia musi być od 0 do 6' })).optional(),
  time: z.string().regex(/^\d{2}:\d{2}$/, { message: 'Godzina musi być w formacie HH:MM' }).optional(),
  // New format: individual time per day
  daySchedules: z.array(dayScheduleSchema).optional(),
  durationMinutes: requiredPositiveInt('Czas trwania'),
  deliveryMode: requiredEnum('Tryb lekcji', ['IN_PERSON', 'ONLINE'] as const, lessonDeliveryModeLabels),
  meetingUrl: optionalUrl('Link do spotkania'),
}).refine(
  (data) => {
    // Either daySchedules or (daysOfWeek + time) or just time must be provided
    const hasNewFormat = data.daySchedules && data.daySchedules.length > 0;
    const hasLegacyFormat = data.time !== undefined;
    return hasNewFormat || hasLegacyFormat;
  },
  { message: 'Musisz podać harmonogram dni z godzinami (daySchedules) lub godzinę (time)' }
);

const createCourseWithScheduleSchema = createCourseSchema.extend({
  schedule: z.object({
    items: z.array(scheduleItemSchema).optional(),
    pattern: schedulePatternSchema.optional(),
  }).optional(),
  studentIds: z.array(requiredUuid('ID ucznia')).optional(),
});

const bulkUpdateLessonsSchema = z.object({
  teacherId: optionalUuid('Lektor'),
  durationMinutes: optionalPositiveInt('Czas trwania'),
  deliveryMode: optionalEnum('Tryb lekcji', ['IN_PERSON', 'ONLINE'] as const, lessonDeliveryModeLabels),
  meetingUrl: optionalUrl('Link do spotkania').nullable(),
  locationId: optionalUuid('Lokalizacja').nullable(),
  classroomId: optionalUuid('Sala').nullable(),
});

class CourseController {
  async getCourses(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { search, teacherId, courseType, isActive } = req.query;

      const filters: any = {};
      if (search) filters.search = String(search);
      if (teacherId) filters.teacherId = String(teacherId);
      if (courseType && (courseType === 'GROUP' || courseType === 'INDIVIDUAL')) {
        filters.courseType = courseType;
      }
      if (isActive !== undefined) filters.isActive = isActive === 'true';

      const courses = await courseService.getCourses(req.user!.organizationId, filters);
      res.json({ message: 'Kursy pobrane pomyślnie', data: courses });
    } catch (error) {
      next(error);
    }
  }

  async getCourseById(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const course = await courseService.getCourseById(id as string, req.user!.organizationId);
      res.json({ message: 'Kurs pobrany pomyślnie', data: course });
    } catch (error) {
      next(error);
    }
  }

  async createCourse(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const data = createCourseSchema.parse(req.body);
      const courseData: CreateCourseData = {
        ...data,
        organizationId: req.user!.organizationId,
        courseType: data.courseType as CourseFormat,
        level: data.level as LanguageLevel,
        deliveryMode: data.deliveryMode as CourseDeliveryMode,
      };
      const course = await courseService.createCourse(courseData);
      res.status(201).json({ message: 'Kurs utworzony pomyślnie', data: course });
    } catch (error) {
      next(error);
    }
  }

  async updateCourse(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const data = updateCourseSchema.parse(req.body);
      const updateData: UpdateCourseData = {
        ...data,
        courseType: data.courseType as CourseFormat | undefined,
        level: data.level as LanguageLevel | undefined,
        deliveryMode: data.deliveryMode as CourseDeliveryMode | undefined,
      };
      const course = await courseService.updateCourse(id as string, req.user!.organizationId, updateData);
      res.json({ message: 'Kurs zaktualizowany pomyślnie', data: course });
    } catch (error) {
      next(error);
    }
  }

  async deleteCourse(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const result = await courseService.deleteCourse(id as string, req.user!.organizationId);
      res.json(result);
    } catch (error) {
      next(error);
    }
  }

  async getStats(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const stats = await courseService.getCourseStats(req.user!.organizationId);
      res.json({ message: 'Statystyki kursu pobrane pomyślnie', data: stats });
    } catch (error) {
      next(error);
    }
  }

  async enrollStudent(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { id: courseId } = req.params;
      const { studentId, paymentMode, hoursPurchased } = enrollStudentSchema.parse(req.body);
      const enrollment = await courseService.enrollStudent(
        courseId as string,
        studentId as string,
        req.user!.organizationId,
        paymentMode,
        hoursPurchased
      );
      res.status(201).json({ message: 'Uczeń zapisany pomyślnie', data: enrollment });
    } catch (error) {
      next(error);
    }
  }

  async unenrollStudent(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { enrollmentId } = req.params;
      const result = await courseService.unenrollStudent(enrollmentId as string, req.user!.organizationId);
      res.json(result);
    } catch (error) {
      next(error);
    }
  }

  async createCourseWithSchedule(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const data = createCourseWithScheduleSchema.parse(req.body);
      const courseData: CreateCourseWithScheduleData = {
        ...data,
        organizationId: req.user!.organizationId,
        courseType: data.courseType as CourseFormat,
        level: data.level as LanguageLevel,
        deliveryMode: data.deliveryMode as CourseDeliveryMode,
      };
      const result = await courseService.createCourseWithSchedule(courseData);
      res.status(201).json({
        message: `Course created with ${result.lessonsCreated} lessons`,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  async bulkUpdateCourseLessons(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { id: courseId } = req.params;
      const updates = bulkUpdateLessonsSchema.parse(req.body);
      const result = await courseService.bulkUpdateCourseLessons(
        courseId as string,
        req.user!.organizationId,
        updates
      );
      res.json({
        message: result.message,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  async getCourseLessonsForEdit(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { id: courseId } = req.params;
      const lessons = await courseService.getCourseLessonsForEdit(
        courseId as string,
        req.user!.organizationId
      );
      res.json({
        message: 'Lekcje kursu pobrane pomyślnie',
        data: lessons,
      });
    } catch (error) {
      next(error);
    }
  }
}

export default new CourseController();
