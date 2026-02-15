import { Response } from 'express';
import { Prisma } from '@prisma/client';
import { ZodError } from 'zod';
import { formatZodErrors, messages } from '../utils/validation-messages';

export interface ApiError extends Error {
  statusCode?: number;
  code?: string;
  details?: any;
}

/**
 * Maps Prisma field names to Polish field names for error messages
 */
const fieldNameMap: Record<string, string> = {
  email: 'Email',
  firstName: 'Imię',
  first_name: 'Imię',
  lastName: 'Nazwisko',
  last_name: 'Nazwisko',
  phone: 'Telefon',
  name: 'Nazwa',
  title: 'Tytuł',
  description: 'Opis',
  password: 'Hasło',
  teacherId: 'Lektor',
  teacher_id: 'Lektor',
  studentId: 'Uczeń',
  student_id: 'Uczeń',
  courseId: 'Kurs',
  course_id: 'Kurs',
  enrollmentId: 'Zapisanie',
  enrollment_id: 'Zapisanie',
  organizationId: 'Organizacja',
  organization_id: 'Organizacja',
  locationId: 'Lokalizacja',
  location_id: 'Lokalizacja',
  classroomId: 'Sala',
  classroom_id: 'Sala',
  scheduledAt: 'Data i godzina',
  scheduled_at: 'Data i godzina',
  startDate: 'Data rozpoczęcia',
  start_date: 'Data rozpoczęcia',
  endDate: 'Data zakończenia',
  end_date: 'Data zakończenia',
  durationMinutes: 'Czas trwania',
  duration_minutes: 'Czas trwania',
  pricePerLesson: 'Cena za lekcję',
  price_per_lesson: 'Cena za lekcję',
  hourlyRate: 'Stawka godzinowa',
  hourly_rate: 'Stawka godzinowa',
  maxStudents: 'Maksymalna liczba uczniów',
  max_students: 'Maksymalna liczba uczniów',
};

/**
 * Gets the Polish name for a field, or returns the original if not mapped
 */
function getPolishFieldName(field: string): string {
  return fieldNameMap[field] || field;
}

/**
 * Extracts field name from Prisma unique constraint metadata
 */
function getUniqueFieldFromMeta(meta: any): string {
  if (meta?.target && Array.isArray(meta.target) && meta.target.length > 0) {
    return getPolishFieldName(meta.target[0]);
  }
  if (meta?.modelName) {
    return meta.modelName;
  }
  return 'pole';
}

/**
 * Gets the Polish entity name from Prisma model name
 */
function getPolishEntityName(modelName?: string): string {
  const entityMap: Record<string, string> = {
    User: 'Użytkownik',
    Student: 'Uczeń',
    Teacher: 'Lektor',
    Course: 'Kurs',
    Lesson: 'Lekcja',
    Payment: 'Płatność',
    Enrollment: 'Zapisanie',
    Organization: 'Organizacja',
    Location: 'Lokalizacja',
    Classroom: 'Sala',
    Material: 'Materiał',
    Settlement: 'Rozliczenie',
    Substitution: 'Zastępstwo',
  };
  return modelName ? (entityMap[modelName] || modelName) : 'Rekord';
}

export const errorHandler = (
  err: ApiError,
  _req: any,
  res: Response,
  _next: any
) => {
  console.error('Error:', err);

  // Zod validation errors - use new formatted response
  if (err instanceof ZodError) {
    const formattedError = formatZodErrors(err);
    return res.status(400).json({
      error: formattedError,
    });
  }

  // Prisma errors with Polish messages
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    // Unique constraint violation
    if (err.code === 'P2002') {
      const field = getUniqueFieldFromMeta(err.meta);
      return res.status(409).json({
        error: {
          code: 'DUPLICATE_ENTRY',
          message: `Wartość w polu "${field}" już istnieje. Użyj innej wartości.`,
          field,
          details: err.meta,
        },
      });
    }

    // Foreign key constraint failed
    if (err.code === 'P2003') {
      const fieldName = err.meta?.field_name as string | undefined;
      const polishField = fieldName ? getPolishFieldName(fieldName.replace('_fkey', '').replace('_id', '')) : 'odniesienie';
      return res.status(400).json({
        error: {
          code: 'INVALID_REFERENCE',
          message: messages.business.invalidReference(polishField),
          field: fieldName,
          details: err.meta,
        },
      });
    }

    // Record not found
    if (err.code === 'P2025') {
      const entityName = getPolishEntityName(err.meta?.modelName as string | undefined);
      return res.status(404).json({
        error: {
          code: 'NOT_FOUND',
          message: messages.business.notFound(entityName),
        },
      });
    }
  }

  // Default error response with Polish message for common cases
  const statusCode = err.statusCode || 500;
  let message = err.message || messages.system.internalError;

  // Translate common English error messages to Polish
  if (message === 'Internal server error') {
    message = messages.system.internalError;
  } else if (message === 'Unauthorized' || message === 'Not authenticated') {
    message = messages.system.unauthorized;
  } else if (message === 'Forbidden' || message === 'Access denied') {
    message = messages.system.forbidden;
  }

  return res.status(statusCode).json({
    error: {
      code: err.code || 'INTERNAL_ERROR',
      message,
      ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
    },
  });
};
