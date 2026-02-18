import { Response, NextFunction } from 'express';
import { z } from 'zod';
import { UserRole } from '@prisma/client';
import { AuthRequest } from '../middleware/auth';
import userService from '../services/user.service';
import {
  requiredEmail,
  requiredString,
  optionalString,
} from '../utils/validation-messages';

const inviteUserSchema = z.object({
  email: requiredEmail('Email'),
  firstName: requiredString('Imię', { min: 2 }),
  lastName: requiredString('Nazwisko', { min: 2 }),
  role: z.enum(['ADMIN', 'MANAGER', 'HR', 'METHODOLOGIST', 'TEACHER'] as const, {
    errorMap: () => ({ message: 'Nieprawidłowa rola użytkownika' }),
  }),
  phone: optionalString('Telefon'),
  password: z.string().min(8, { message: 'Hasło musi mieć min. 8 znaków' }).optional(),
});

const updateUserSchema = z.object({
  firstName: z.string().min(2).optional(),
  lastName: z.string().min(2).optional(),
  phone: z.string().optional().nullable(),
  role: z.enum(['ADMIN', 'MANAGER', 'HR', 'METHODOLOGIST', 'TEACHER', 'STUDENT', 'PARENT'] as const).optional(),
  isActive: z.boolean().optional(),
});

class UserController {
  /**
   * Get all users in organization
   */
  async getUsers(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        return res.status(401).json({
          error: { code: 'UNAUTHORIZED', message: 'Not authenticated' },
        });
      }

      const { role, isActive, search } = req.query;

      const filters = {
        role: role as UserRole | undefined,
        isActive: isActive !== undefined ? isActive === 'true' : undefined,
        search: search as string | undefined,
      };

      const users = await userService.getUsers(req.user.organizationId, filters);

      return res.json({
        data: users,
      });
    } catch (error) {
      return next(error);
    }
  }

  /**
   * Get user by ID
   */
  async getUserById(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        return res.status(401).json({
          error: { code: 'UNAUTHORIZED', message: 'Not authenticated' },
        });
      }

      const { id } = req.params;
      const user = await userService.getUserById(id, req.user.organizationId);

      return res.json({
        data: user,
      });
    } catch (error) {
      if (error instanceof Error && error.message === 'User not found') {
        return res.status(404).json({
          error: { code: 'NOT_FOUND', message: 'Użytkownik nie został znaleziony' },
        });
      }
      return next(error);
    }
  }

  /**
   * Invite a new user to the organization
   */
  async inviteUser(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        return res.status(401).json({
          error: { code: 'UNAUTHORIZED', message: 'Not authenticated' },
        });
      }

      const data = inviteUserSchema.parse(req.body);

      const user = await userService.inviteUser(
        req.user.organizationId,
        data,
        req.user.id
      );

      return res.status(201).json({
        message: 'Użytkownik został zaproszony',
        data: user,
      });
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes('już istnieje')) {
          return res.status(409).json({
            error: { code: 'CONFLICT', message: error.message },
          });
        }
        if (error.message.includes('Nieprawidłowa rola')) {
          return res.status(400).json({
            error: { code: 'VALIDATION_ERROR', message: error.message },
          });
        }
      }
      return next(error);
    }
  }

  /**
   * Update user details
   */
  async updateUser(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        return res.status(401).json({
          error: { code: 'UNAUTHORIZED', message: 'Not authenticated' },
        });
      }

      const { id } = req.params;
      const data = updateUserSchema.parse(req.body);

      const user = await userService.updateUser(
        id,
        req.user.organizationId,
        data,
        { id: req.user.id, role: req.user.role }
      );

      return res.json({
        message: 'Użytkownik został zaktualizowany',
        data: user,
      });
    } catch (error) {
      if (error instanceof Error) {
        if (error.message === 'User not found') {
          return res.status(404).json({
            error: { code: 'NOT_FOUND', message: 'Użytkownik nie został znaleziony' },
          });
        }
        if (error.message.includes('Nie możesz') || error.message.includes('Nie masz')) {
          return res.status(403).json({
            error: { code: 'FORBIDDEN', message: error.message },
          });
        }
      }
      return next(error);
    }
  }

  /**
   * Deactivate a user
   */
  async deactivateUser(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        return res.status(401).json({
          error: { code: 'UNAUTHORIZED', message: 'Not authenticated' },
        });
      }

      const { id } = req.params;

      const user = await userService.deactivateUser(
        id,
        req.user.organizationId,
        { id: req.user.id, role: req.user.role }
      );

      return res.json({
        message: 'Użytkownik został dezaktywowany',
        data: user,
      });
    } catch (error) {
      if (error instanceof Error) {
        if (error.message === 'User not found') {
          return res.status(404).json({
            error: { code: 'NOT_FOUND', message: 'Użytkownik nie został znaleziony' },
          });
        }
        if (error.message.includes('Nie możesz') || error.message.includes('Nie masz')) {
          return res.status(403).json({
            error: { code: 'FORBIDDEN', message: error.message },
          });
        }
      }
      return next(error);
    }
  }

  /**
   * Reactivate a user
   */
  async reactivateUser(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        return res.status(401).json({
          error: { code: 'UNAUTHORIZED', message: 'Not authenticated' },
        });
      }

      const { id } = req.params;

      const user = await userService.reactivateUser(id, req.user.organizationId);

      return res.json({
        message: 'Użytkownik został reaktywowany',
        data: user,
      });
    } catch (error) {
      if (error instanceof Error && error.message === 'User not found') {
        return res.status(404).json({
          error: { code: 'NOT_FOUND', message: 'Użytkownik nie został znaleziony' },
        });
      }
      return next(error);
    }
  }

  /**
   * Reset user password
   */
  async resetUserPassword(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        return res.status(401).json({
          error: { code: 'UNAUTHORIZED', message: 'Not authenticated' },
        });
      }

      const { id } = req.params;

      await userService.resetUserPassword(id, req.user.organizationId);

      return res.json({
        message: 'Nowe hasło zostało wysłane na email użytkownika',
      });
    } catch (error) {
      if (error instanceof Error && error.message === 'User not found') {
        return res.status(404).json({
          error: { code: 'NOT_FOUND', message: 'Użytkownik nie został znaleziony' },
        });
      }
      return next(error);
    }
  }

  /**
   * Get user statistics
   */
  async getUserStats(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        return res.status(401).json({
          error: { code: 'UNAUTHORIZED', message: 'Not authenticated' },
        });
      }

      const stats = await userService.getUserStats(req.user.organizationId);

      return res.json({
        data: stats,
      });
    } catch (error) {
      return next(error);
    }
  }
}

export default new UserController();
