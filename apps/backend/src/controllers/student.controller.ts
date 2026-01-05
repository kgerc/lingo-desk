import { Response, NextFunction } from 'express';
import { z } from 'zod';
import studentService from '../services/student.service';
import { AuthRequest } from '../middleware/auth';
import { LanguageLevel } from '@prisma/client';

const createStudentSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  firstName: z.string().min(2),
  lastName: z.string().min(2),
  phone: z.string().optional(),
  dateOfBirth: z.string().optional(),
  address: z.string().optional(),
  languageLevel: z.nativeEnum(LanguageLevel),
  goals: z.string().optional(),
  isMinor: z.boolean().optional(),
});

const updateStudentSchema = z.object({
  firstName: z.string().min(2).optional(),
  lastName: z.string().min(2).optional(),
  phone: z.string().optional(),
  email: z.string().email().optional(),
  dateOfBirth: z.string().optional(),
  address: z.string().optional(),
  languageLevel: z.nativeEnum(LanguageLevel).optional(),
  goals: z.string().optional(),
  isMinor: z.boolean().optional(),
  isActive: z.boolean().optional(),
});

export class StudentController {
  async createStudent(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      if (!req.user?.organizationId) {
        return res.status(401).json({
          error: {
            code: 'UNAUTHORIZED',
            message: 'Organization ID not found',
          },
        });
      }

      const data = createStudentSchema.parse(req.body);
      const student = await studentService.createStudent({
        ...data,
        organizationId: req.user.organizationId,
      });

      res.status(201).json({
        message: 'Student created successfully',
        data: student,
      });
    } catch (error) {
      next(error);
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

      const { search, languageLevel, isActive } = req.query;

      const students = await studentService.getStudents(
        req.user.organizationId,
        {
          search: search as string,
          languageLevel: languageLevel as LanguageLevel,
          isActive: isActive === 'true' ? true : isActive === 'false' ? false : undefined,
        }
      );

      res.json({
        data: students,
      });
    } catch (error) {
      next(error);
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
      const student = await studentService.getStudentById(id, req.user.organizationId);

      res.json({
        data: student,
      });
    } catch (error) {
      next(error);
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

      const student = await studentService.updateStudent(
        id,
        req.user.organizationId,
        data
      );

      res.json({
        message: 'Student updated successfully',
        data: student,
      });
    } catch (error) {
      next(error);
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
      const result = await studentService.deleteStudent(id, req.user.organizationId);

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

      const stats = await studentService.getStudentStats(req.user.organizationId);

      res.json({
        data: stats,
      });
    } catch (error) {
      next(error);
    }
  }
}

export default new StudentController();
