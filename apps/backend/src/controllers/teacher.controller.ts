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
}

export default new TeacherController();
