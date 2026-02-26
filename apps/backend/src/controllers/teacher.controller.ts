import { Response, NextFunction } from 'express';
import { z } from 'zod';
import teacherService from '../services/teacher.service';
import { AuthRequest } from '../middleware/auth';
import { ContractType } from '@prisma/client';
import {
  requiredEmail,
  optionalEmail,
  requiredString,
  optionalString,
  optionalPhone,
  //requiredEnum,
  //optionalEnum,
  optionalBoolean,
  messages,
} from '../utils/validation-messages';


const createTeacherSchema = z.object({
  email: requiredEmail('Email'),
  password: requiredString('Hasło', { min: 8 }),
  firstName: requiredString('Imię', { min: 2 }),
  lastName: requiredString('Nazwisko', { min: 2 }),
  phone: optionalPhone('Telefon'),
  hourlyRate: z.number({
    required_error: 'Pole "Stawka godzinowa" jest wymagane',
    invalid_type_error: 'Pole "Stawka godzinowa" musi być liczbą',
  }).positive({ message: 'Pole "Stawka godzinowa" musi być liczbą dodatnią' }),
  contractType: z.nativeEnum(ContractType).optional(),
  specializations: z.array(z.string()).optional(),
  languages: z.array(z.string()).optional(),
  bio: optionalString('Biografia'),
});

const updateTeacherSchema = z.object({
  firstName: optionalString('Imię', { min: 2 }),
  lastName: optionalString('Nazwisko', { min: 2 }),
  phone: optionalPhone('Telefon'),
  email: optionalEmail('Email'),
  hourlyRate: z.number({
    invalid_type_error: 'Pole "Stawka godzinowa" musi być liczbą',
  }).positive({ message: 'Pole "Stawka godzinowa" musi być liczbą dodatnią' }).optional(),
  contractType: z.nativeEnum(ContractType).optional(),
  specializations: z.array(z.string()).optional(),
  languages: z.array(z.string()).optional(),
  bio: optionalString('Biografia'),
  isAvailableForBooking: optionalBoolean('Dostępny do rezerwacji'),
  isActive: optionalBoolean('Aktywny'),
  cancellationPayoutEnabled: z.boolean().optional(),
  cancellationPayoutHours: z.number().int().positive({ message: 'Próg godzin musi być liczbą dodatnią' }).nullable().optional(),
  cancellationPayoutPercent: z.number().int().min(0, { message: 'Procent musi być od 0 do 100' }).max(100, { message: 'Procent musi być od 0 do 100' }).nullable().optional(),
});

export class TeacherController {
  async createTeacher(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      if (!req.user?.organizationId) {
        return res.status(401).json({
          error: {
            code: 'UNAUTHORIZED',
            message: messages.system.unauthorized,
          },
        });
      }

      const data = createTeacherSchema.parse(req.body);
      const teacher = await teacherService.createTeacher({
        ...data,
        organizationId: req.user.organizationId,
        contractType: data.contractType as ContractType | undefined,
      });

      return res.status(201).json({
        message: 'Lektor został utworzony pomyślnie',
        data: teacher,
      });
    } catch (error) {
      return next(error);
    }
  }

  async getTeachers(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      if (!req.user?.organizationId) {
        return res.status(401).json({
          error: {
            code: 'UNAUTHORIZED',
            message: 'Organization ID not found',
          },
        });
      }

      const { search, isActive, isAvailableForBooking } = req.query;

      const teachers = await teacherService.getTeachersWithVisibility(
        req.user.organizationId,
        req.user.role,
        {
          search: search as string,
          isActive: isActive === 'true' ? true : isActive === 'false' ? false : undefined,
          isAvailableForBooking:
            isAvailableForBooking === 'true'
              ? true
              : isAvailableForBooking === 'false'
              ? false
              : undefined,
        }
      );

      return res.json({
        data: teachers,
      });
    } catch (error) {
      return next(error);
    }
  }

  async getTeacherById(req: AuthRequest, res: Response, next: NextFunction) {
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
      const teacher = await teacherService.getTeacherByIdWithVisibility(
        id as string,
        req.user.organizationId,
        req.user.role
      );

      return res.json({
        data: teacher,
      });
    } catch (error) {
      return next(error);
    }
  }

  async updateTeacher(req: AuthRequest, res: Response, next: NextFunction) {
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
      const data = updateTeacherSchema.parse(req.body);

      const teacher = await teacherService.updateTeacher(
        id as string,
        req.user.organizationId,
        data
      );

      return res.json({
        message: 'Lektor zaktualizowany pomyślnie',
        data: teacher,
      });
    } catch (error) {
      return next(error);
    }
  }

  async deleteTeacher(req: AuthRequest, res: Response, next: NextFunction) {
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
      const result = await teacherService.deleteTeacher(id as string, req.user.organizationId);

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
          await teacherService.deleteTeacherWithCascade(id as string, req.user.organizationId);
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

      const stats = await teacherService.getTeacherStats(req.user.organizationId);

      return res.json({
        data: stats,
      });
    } catch (error) {
      return next(error);
    }
  }

  async getMe(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user?.id || !req.user?.organizationId) {
        res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'User not authenticated' } });
        return;
      }

      // Get teacher by userId with full details
      const teacher = await teacherService.getTeacherByUserId(req.user.id);
      if (!teacher) {
        res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Nie znaleziono lektora' } });
        return;
      }

      // Verify teacher belongs to user's organization
      if (teacher.organizationId !== req.user.organizationId) {
        res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Access denied' } });
        return;
      }

      res.json({ data: teacher });
    } catch (error) {
      next(error);
    }
  }

  async getMySchedule(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user?.id) {
        res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'User not authenticated' } });
        return;
      }

      const teacher = await teacherService.getTeacherByUserId(req.user.id);
      if (!teacher) {
        res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Nie znaleziono lektora' } });
        return;
      }

      const { startDate, endDate } = req.query;
      const start = startDate ? new Date(startDate as string) : new Date();
      const end = endDate ? new Date(endDate as string) : new Date();

      const lessons = await teacherService.getTeacherSchedule(teacher.id, start, end);
      res.json({ data: lessons });
    } catch (error) {
      next(error);
    }
  }
}

export default new TeacherController();
