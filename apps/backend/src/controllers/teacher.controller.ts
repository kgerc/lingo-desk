import { Response, NextFunction } from 'express';
import { z } from 'zod';
import teacherService from '../services/teacher.service';
import { AuthRequest } from '../middleware/auth';
import { ContractType } from '@prisma/client';

const createTeacherSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  firstName: z.string().min(2),
  lastName: z.string().min(2),
  phone: z.string().optional(),
  hourlyRate: z.number().positive(),
  contractType: z.nativeEnum(ContractType),
  specializations: z.array(z.string()).optional(),
  languages: z.array(z.string()).optional(),
  bio: z.string().optional(),
});

const updateTeacherSchema = z.object({
  firstName: z.string().min(2).optional(),
  lastName: z.string().min(2).optional(),
  phone: z.string().optional(),
  email: z.string().email().optional(),
  hourlyRate: z.number().positive().optional(),
  contractType: z.nativeEnum(ContractType).optional(),
  specializations: z.array(z.string()).optional(),
  languages: z.array(z.string()).optional(),
  bio: z.string().optional(),
  isAvailableForBooking: z.boolean().optional(),
  isActive: z.boolean().optional(),
});

const availabilitySchema = z.object({
  availability: z.array(
    z.object({
      dayOfWeek: z.number().min(0).max(6),
      startTime: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/),
      endTime: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/),
    })
  ),
});

export class TeacherController {
  async createTeacher(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      if (!req.user?.organizationId) {
        return res.status(401).json({
          error: {
            code: 'UNAUTHORIZED',
            message: 'Organization ID not found',
          },
        });
      }

      const data = createTeacherSchema.parse(req.body);
      const teacher = await teacherService.createTeacher({
        ...data,
        organizationId: req.user.organizationId,
      });

      res.status(201).json({
        message: 'Teacher created successfully',
        data: teacher,
      });
    } catch (error) {
      next(error);
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

      const teachers = await teacherService.getTeachers(
        req.user.organizationId,
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

      res.json({
        data: teachers,
      });
    } catch (error) {
      next(error);
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
      const teacher = await teacherService.getTeacherById(id, req.user.organizationId);

      res.json({
        data: teacher,
      });
    } catch (error) {
      next(error);
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
        id,
        req.user.organizationId,
        data
      );

      res.json({
        message: 'Teacher updated successfully',
        data: teacher,
      });
    } catch (error) {
      next(error);
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
      const result = await teacherService.deleteTeacher(id, req.user.organizationId);

      res.json(result);
    } catch (error) {
      next(error);
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

      res.json({
        data: stats,
      });
    } catch (error) {
      next(error);
    }
  }

  async setAvailability(req: AuthRequest, res: Response, next: NextFunction) {
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
      const { availability } = availabilitySchema.parse(req.body);

      const result = await teacherService.setAvailability(
        id,
        req.user.organizationId,
        availability
      );

      res.json(result);
    } catch (error) {
      next(error);
    }
  }

  // ============================================
  // TEACHER SCHEDULE MANAGEMENT
  // ============================================

  async getMe(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user?.id || !req.user?.organizationId) {
        res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'User not authenticated' } });
        return;
      }

      // Get teacher by userId with full details
      const teacher = await teacherService.getTeacherByUserId(req.user.id);
      if (!teacher) {
        res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Teacher not found' } });
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

      // Get teacher by userId
      const teacher = await teacherService.getTeacherByUserId(req.user.id);
      if (!teacher) {
        res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Teacher not found' } });
        return;
      }

      const { startDate, endDate } = req.query;
      const start = startDate ? new Date(startDate as string) : new Date();
      const end = endDate ? new Date(endDate as string) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days from now

      const schedule = await teacherService.getTeacherSchedule(teacher.id, start, end);
      res.json({ data: schedule });
    } catch (error) {
      next(error);
    }
  }

  async getAvailabilityExceptions(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const { startDate, endDate } = req.query;

      const start = startDate ? new Date(startDate as string) : undefined;
      const end = endDate ? new Date(endDate as string) : undefined;

      const exceptions = await teacherService.getAvailabilityExceptions(id, start, end);
      res.json({ data: exceptions });
    } catch (error) {
      next(error);
    }
  }

  async addAvailabilityException(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const { startDate, endDate, reason } = req.body;

      const exception = await teacherService.addAvailabilityException(
        id,
        new Date(startDate),
        new Date(endDate),
        reason
      );

      res.json({ data: exception });
    } catch (error) {
      next(error);
    }
  }

  async deleteAvailabilityException(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id, exceptionId } = req.params;
      const result = await teacherService.deleteAvailabilityException(exceptionId);
      res.json(result);
    } catch (error) {
      next(error);
    }
  }

  async getPreferences(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const preferences = await teacherService.getTeacherPreferences(id);
      res.json({ data: preferences });
    } catch (error) {
      next(error);
    }
  }

  async updatePreferences(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const data = req.body;

      const preferences = await teacherService.updateTeacherPreferences(id, data);
      res.json({ data: preferences });
    } catch (error) {
      next(error);
    }
  }
}

export default new TeacherController();
