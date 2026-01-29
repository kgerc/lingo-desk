import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import authService from '../services/auth.service';
import { AuthRequest } from '../middleware/auth';
import {
  requiredEmail,
  requiredString,
  optionalString,
  messages,
} from '../utils/validation-messages';

const registerSchema = z.object({
  email: requiredEmail('Email'),
  password: requiredString('Hasło', { min: 8 }),
  firstName: requiredString('Imię', { min: 2 }),
  lastName: requiredString('Nazwisko', { min: 2 }),
  organizationName: optionalString('Nazwa organizacji'),
});

const loginSchema = z.object({
  email: requiredEmail('Email'),
  password: requiredString('Hasło'),
});

export class AuthController {
  async register(req: Request, res: Response, next: NextFunction) {
    try {
      const data = registerSchema.parse(req.body);
      const result = await authService.register(data);

      res.status(201).json({
        message: 'Rejestracja zakończona pomyślnie',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  async login(req: Request, res: Response, next: NextFunction) {
    try {
      const data = loginSchema.parse(req.body);
      const result = await authService.login(data);

      res.json({
        message: 'Zalogowano pomyślnie',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  async getMe(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        return res.status(401).json({
          error: {
            code: 'UNAUTHORIZED',
            message: messages.system.unauthorized,
          },
        });
      }

      const user = await authService.getMe(req.user.id);

      return res.json({
        data: user,
      });
    } catch (error) {
      return next(error);
    }
  }
}

export default new AuthController();
