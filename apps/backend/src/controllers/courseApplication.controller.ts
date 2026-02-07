import { Response, NextFunction, Request } from 'express';
import { z } from 'zod';
import { ApplicationStatus } from '@prisma/client';
import { AuthRequest } from '../middleware/auth';
import courseApplicationService from '../services/courseApplication.service';
import {
  requiredString,
  requiredEmail,
  optionalString,
  optionalPhone,
  requiredEnum,
} from '../utils/validation-messages';

// Validation schemas
const createPublicApplicationSchema = z.object({
  name: requiredString('Imię i nazwisko', { min: 2 }),
  email: requiredEmail('Email'),
  phone: optionalPhone('Telefon'),
  courseId: optionalString('Kurs'),
  preferences: optionalString('Preferencje'),
  languageLevel: optionalString('Poziom językowy'),
  availability: optionalString('Dostępność'),
  notes: optionalString('Uwagi'),
});

const updateStatusSchema = z.object({
  status: requiredEnum('Status', ['NEW', 'ACCEPTED', 'REJECTED'] as const),
  internalNotes: optionalString('Notatki wewnętrzne'),
});

const convertToStudentSchema = z.object({
  firstName: requiredString('Imię', { min: 2 }),
  lastName: requiredString('Nazwisko', { min: 2 }),
  email: requiredEmail('Email'),
  password: requiredString('Hasło', { min: 8 }),
  phone: optionalPhone('Telefon'),
  languageLevel: optionalString('Poziom językowy'),
  language: optionalString('Język'),
});

class CourseApplicationController {
  // === PUBLIC ENDPOINTS ===

  async getPublicCourses(req: Request, res: Response, next: NextFunction) {
    try {
      const { orgSlug } = req.params;
      const data = await courseApplicationService.getPublicCourses(orgSlug);
      return res.json({ data });
    } catch (error) {
      return next(error);
    }
  }

  async createPublicApplication(req: Request, res: Response, next: NextFunction) {
    try {
      const { orgSlug } = req.params;
      const data = createPublicApplicationSchema.parse(req.body);
      const application = await courseApplicationService.createPublicApplication(orgSlug, data);
      return res.status(201).json({
        message: 'Zgłoszenie zostało wysłane pomyślnie',
        data: application,
      });
    } catch (error) {
      return next(error);
    }
  }

  // === PROTECTED ENDPOINTS ===

  async getApplications(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { status, search } = req.query;
      const applications = await courseApplicationService.getApplications(
        req.user!.organizationId,
        {
          status: status as ApplicationStatus | undefined,
          search: search as string | undefined,
        },
      );
      return res.json({ data: applications });
    } catch (error) {
      return next(error);
    }
  }

  async getApplicationById(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const application = await courseApplicationService.getApplicationById(
        id,
        req.user!.organizationId,
      );
      return res.json({ data: application });
    } catch (error) {
      return next(error);
    }
  }

  async updateStatus(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const data = updateStatusSchema.parse(req.body);
      const application = await courseApplicationService.updateStatus(
        id,
        req.user!.organizationId,
        data.status as ApplicationStatus,
        data.internalNotes,
      );
      return res.json({
        message: 'Status zgłoszenia został zaktualizowany',
        data: application,
      });
    } catch (error) {
      return next(error);
    }
  }

  async convertToStudent(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const data = convertToStudentSchema.parse(req.body);
      const result = await courseApplicationService.convertToStudent(
        id,
        req.user!.organizationId,
        data,
      );
      return res.status(201).json({
        message: 'Uczeń został utworzony na podstawie zgłoszenia',
        data: result,
      });
    } catch (error) {
      return next(error);
    }
  }
}

export default new CourseApplicationController();
