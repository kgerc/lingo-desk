import { Response, NextFunction } from 'express';
import { z } from 'zod';
import studentService from '../services/student.service';
import { AuthRequest } from '../middleware/auth';
import { LanguageLevel } from '@prisma/client';
import {
  requiredEmail,
  optionalEmail,
  requiredString,
  optionalString,
  optionalPhone,
  requiredEnum,
  optionalEnum,
  optionalBoolean,
  optionalPositiveInt,
  messages,
} from '../utils/validation-messages';

// Polish labels for enums
const languageLevelLabels = { A1: 'A1', A2: 'A2', B1: 'B1', B2: 'B2', C1: 'C1', C2: 'C2' };
const languageLevelValues = Object.values(LanguageLevel) as [string, ...string[]];
const cancellationPeriodLabels = {
  month: 'Miesiąc',
  quarter: 'Kwartał',
  year: 'Rok',
  enrollment: 'Czas zapisania',
};

const createStudentSchema = z.object({
  email: requiredEmail('Email'),
  password: requiredString('Hasło', { min: 8 }),
  firstName: requiredString('Imię', { min: 2 }),
  lastName: requiredString('Nazwisko', { min: 2 }),
  phone: optionalPhone('Telefon'),
  address: optionalString('Adres'),
  languageLevel: requiredEnum('Poziom języka', languageLevelValues, languageLevelLabels),
  language: optionalString('Język'), // Language being learned (ISO 639-1 code)
  goals: optionalString('Cele nauki'),
  isMinor: optionalBoolean('Niepełnoletni'),
  paymentDueDays: optionalPositiveInt('Termin płatności (dni)').nullable(),
  paymentDueDayOfMonth: z.number({
    invalid_type_error: 'Pole "Dzień miesiąca płatności" musi być liczbą',
  }).min(1, { message: 'Dzień miesiąca musi być od 1 do 28' }).max(28, { message: 'Dzień miesiąca musi być od 1 do 28' }).nullable().optional(),
});

const updateStudentSchema = z.object({
  firstName: optionalString('Imię', { min: 2 }),
  lastName: optionalString('Nazwisko', { min: 2 }),
  phone: optionalPhone('Telefon'),
  email: optionalEmail('Email'),
  address: optionalString('Adres'),
  languageLevel: optionalEnum('Poziom języka', languageLevelValues, languageLevelLabels),
  language: optionalString('Język'), // Language being learned
  goals: optionalString('Cele nauki'),
  isMinor: optionalBoolean('Niepełnoletni'),
  isActive: optionalBoolean('Aktywny'),
  paymentDueDays: optionalPositiveInt('Termin płatności (dni)').nullable(),
  paymentDueDayOfMonth: z.number({
    invalid_type_error: 'Pole "Dzień miesiąca płatności" musi być liczbą',
  }).min(1, { message: 'Dzień miesiąca musi być od 1 do 28' }).max(28, { message: 'Dzień miesiąca musi być od 1 do 28' }).nullable().optional(),
  // Cancellation fee settings
  cancellationFeeEnabled: optionalBoolean('Opłata za anulowanie'),
  cancellationHoursThreshold: optionalPositiveInt('Próg godzin anulowania').nullable(),
  cancellationFeePercent: z.number({
    invalid_type_error: 'Pole "Procent opłaty za anulowanie" musi być liczbą',
  }).min(0, { message: 'Procent musi być od 0 do 100' }).max(100, { message: 'Procent musi być od 0 do 100' }).nullable().optional(),
  // Cancellation limit settings
  cancellationLimitEnabled: optionalBoolean('Limit anulowań'),
  cancellationLimitCount: optionalPositiveInt('Limit liczby anulowań').nullable(),
  cancellationLimitPeriod: optionalEnum('Okres limitu anulowań', ['month', 'quarter', 'year', 'enrollment'] as const, cancellationPeriodLabels).nullable(),
  internalNotes: z.string().max(10000, { message: 'Notatki nie mogą przekraczać 10 000 znaków' }).nullable().optional(),
});

export class StudentController {
  async createStudent(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      if (!req.user?.organizationId) {
        return res.status(401).json({
          error: {
            code: 'UNAUTHORIZED',
            message: messages.system.unauthorized,
          },
        });
      }

      const data = createStudentSchema.parse(req.body);
      const student = await studentService.createStudent({
        ...data,
        organizationId: req.user.organizationId,
        languageLevel: data.languageLevel as LanguageLevel,
      });

      return res.status(201).json({
        message: 'Uczeń został utworzony pomyślnie',
        data: student,
      });
    } catch (error) {
      return next(error);
    }
  }

  async getStudents(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      if (!req.user?.organizationId) {
        return res.status(401).json({
          error: {
            code: 'UNAUTHORIZED',
            message: 'Organization ID not found',
          },
        });
      }

      const { search, languageLevel, isActive, balanceMin, balanceMax, sortBy, sortOrder } = req.query;

      const students = await studentService.getStudentsWithVisibility(
        req.user.organizationId,
        req.user.role,
        {
          search: search as string,
          languageLevel: languageLevel as LanguageLevel,
          isActive: isActive === 'true' ? true : isActive === 'false' ? false : undefined,
          balanceMin: balanceMin ? Number(balanceMin) : undefined,
          balanceMax: balanceMax ? Number(balanceMax) : undefined,
          sortBy: sortBy as 'studentNumber' | 'firstName' | 'languageLevel' | 'balance' | undefined,
          sortOrder: sortOrder as 'asc' | 'desc' | undefined,
        }
      );

      return res.json({
        data: students,
      });
    } catch (error) {
      return next(error);
    }
  }

  async getStudentById(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      if (!req.user?.organizationId) {
        return res.status(401).json({
          error: {
            code: 'UNAUTHORIZED',
            message: 'Organization ID not found',
          },
        });
      }

      const { id } = req.params;
      const student = await studentService.getStudentByIdWithVisibility(
        id as string,
        req.user.organizationId,
        req.user.role
      );

      return res.json({
        data: student,
      });
    } catch (error) {
      return next(error);
    }
  }

  async updateStudent(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      if (!req.user?.organizationId) {
        return res.status(401).json({
          error: {
            code: 'UNAUTHORIZED',
            message: 'Organization ID not found',
          },
        });
      }

      const { id } = req.params;
      const data = updateStudentSchema.parse(req.body);
      if (typeof data.paymentDueDays === 'number' ||
        typeof data.paymentDueDayOfMonth === 'undefined') {
        data.paymentDueDayOfMonth = null;
      }

      if (typeof data.paymentDueDayOfMonth === 'number' ||
        typeof data.paymentDueDays === 'undefined') {
        data.paymentDueDays = null;
      }
      const student = await studentService.updateStudent(
        id as string,
        req.user.organizationId,
        {
          ...data,
          languageLevel: data.languageLevel as LanguageLevel | undefined,
        }
      );

      return res.json({
        message: 'Dane ucznia zostały zaktualizowane',
        data: student,
      });
    } catch (error) {
      return next(error);
    }
  }

  async deleteStudent(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      if (!req.user?.organizationId) {
        return res.status(401).json({
          error: {
            code: 'UNAUTHORIZED',
            message: 'Organization ID not found',
          },
        });
      }

      const { id } = req.params;
      const result = await studentService.deleteStudent(id as string, req.user.organizationId);

      return res.json(result);
    } catch (error) {
      return next(error);
    }
  }

  async bulkDelete(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      if (!req.user?.organizationId) {
        return res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Organization ID not found' } });
      }
      const { ids } = req.body;
      if (!Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({ error: { code: 'BAD_REQUEST', message: 'Lista ID jest wymagana' } });
      }
      const results = { deleted: 0, failed: 0, errors: [] as { id: string; error: string }[] };
      for (const id of ids) {
        try {
          await studentService.deleteStudent(id as string, req.user.organizationId);
          results.deleted++;
        } catch (error: any) {
          results.failed++;
          results.errors.push({ id, error: error.message || 'Nieznany błąd' });
        }
      }
      return res.json(results);
    } catch (error) {
      return next(error);
    }
  }

  async getArchivedStudents(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      if (!req.user?.organizationId) {
        return res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Organization ID not found' } });
      }
      const students = await studentService.getArchivedStudents(req.user.organizationId);
      return res.json({ data: students });
    } catch (error) {
      return next(error);
    }
  }

  async restoreStudent(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      if (!req.user?.organizationId) {
        return res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Organization ID not found' } });
      }
      const { id } = req.params;
      const result = await studentService.restoreStudent(id, req.user.organizationId);
      return res.json(result);
    } catch (error) {
      return next(error);
    }
  }

  async purgeStudent(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      if (!req.user?.organizationId) {
        return res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Organization ID not found' } });
      }
      const { id } = req.params;
      const result = await studentService.purgeStudent(id, req.user.organizationId);
      return res.json(result);
    } catch (error) {
      return next(error);
    }
  }

  async getStats(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      if (!req.user?.organizationId) {
        return res.status(401).json({
          error: {
            code: 'UNAUTHORIZED',
            message: 'Organization ID not found',
          },
        });
      }

      const stats = await studentService.getStudentStats(req.user.organizationId);

      return res.json({
        data: stats,
      });
    } catch (error) {
      return next(error);
    }
  }

  async getEnrollmentBudget(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      if (!req.user?.organizationId) {
        return res.status(401).json({
          error: {
            code: 'UNAUTHORIZED',
            message: 'Organization ID not found',
          },
        });
      }

      const { enrollmentId } = req.params;
      const budget = await studentService.getEnrollmentBudget(
        enrollmentId as string,
        req.user.organizationId
      );

      return res.json({
        data: budget,
      });
    } catch (error) {
      return next(error);
    }
  }

  async previewCSV(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      if (!req.user?.organizationId) {
        return res.status(401).json({
          error: {
            code: 'UNAUTHORIZED',
            message: 'Organization ID not found',
          },
        });
      }

      const { csvContent } = req.body;

      if (!csvContent) {
        return res.status(400).json({
          error: {
            code: 'BAD_REQUEST',
            message: 'CSV content is required',
          },
        });
      }

      const preview = await studentService.previewCSV(csvContent);

      return res.json({
        data: preview,
      });
    } catch (error) {
      return next(error);
    }
  }

  async importCSV(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      if (!req.user?.organizationId) {
        return res.status(401).json({
          error: {
            code: 'UNAUTHORIZED',
            message: 'Organization ID not found',
          },
        });
      }

      const { csvContent, columnMapping } = req.body;

      if (!csvContent || !columnMapping) {
        return res.status(400).json({
          error: {
            code: 'BAD_REQUEST',
            message: 'CSV content and column mapping are required',
          },
        });
      }

      // Validate required mappings
      if (!columnMapping.email || !columnMapping.firstName || !columnMapping.lastName) {
        return res.status(400).json({
          error: {
            code: 'BAD_REQUEST',
            message: 'Email, firstName, and lastName mappings are required',
          },
        });
      }

      const results = await studentService.importStudentsFromCSV(
        csvContent,
        columnMapping,
        req.user.organizationId
      );

      return res.json({
        message: 'Import completed',
        data: results,
      });
    } catch (error) {
      return next(error);
    }
  }
}

export default new StudentController();
