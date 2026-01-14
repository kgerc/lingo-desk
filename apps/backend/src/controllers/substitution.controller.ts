import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import substitutionService from '../services/substitution.service';

// Validation schemas
const createSubstitutionSchema = z.object({
  lessonId: z.string().uuid(),
  originalTeacherId: z.string().uuid(),
  substituteTeacherId: z.string().uuid(),
  reason: z.string().optional(),
  notes: z.string().optional(),
});

const updateSubstitutionSchema = z.object({
  substituteTeacherId: z.string().uuid().optional(),
  reason: z.string().optional(),
  notes: z.string().optional(),
});

interface AuthRequest extends Request {
  user?: {
    id: string;
    organizationId: string;
    role: string;
  };
}

class SubstitutionController {
  /**
   * Get all substitutions
   * GET /api/substitutions
   */
  async getSubstitutions(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const organizationId = req.user!.organizationId;
      const { originalTeacherId, substituteTeacherId, dateFrom, dateTo, limit, offset } = req.query;

      const substitutions = await substitutionService.getSubstitutions({
        organizationId,
        originalTeacherId: originalTeacherId as string | undefined,
        substituteTeacherId: substituteTeacherId as string | undefined,
        dateFrom: dateFrom ? new Date(dateFrom as string) : undefined,
        dateTo: dateTo ? new Date(dateTo as string) : undefined,
        limit: limit ? parseInt(limit as string) : undefined,
        offset: offset ? parseInt(offset as string) : undefined,
      });

      res.json({
        success: true,
        data: substitutions,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get substitution by ID
   * GET /api/substitutions/:id
   */
  async getSubstitutionById(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const organizationId = req.user!.organizationId;

      const substitution = await substitutionService.getSubstitutionById(id, organizationId);

      res.json({
        success: true,
        data: substitution,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get substitution by lesson ID
   * GET /api/substitutions/lesson/:lessonId
   */
  async getSubstitutionByLessonId(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { lessonId } = req.params;
      const organizationId = req.user!.organizationId;

      const substitution = await substitutionService.getSubstitutionByLessonId(lessonId, organizationId);

      if (!substitution) {
        return res.status(404).json({
          success: false,
          message: 'Substitution not found for this lesson',
        });
      }

      res.json({
        success: true,
        data: substitution,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Create a new substitution
   * POST /api/substitutions
   */
  async createSubstitution(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const organizationId = req.user!.organizationId;
      const data = createSubstitutionSchema.parse(req.body);

      const substitution = await substitutionService.createSubstitution({
        ...data,
        organizationId,
      });

      res.status(201).json({
        success: true,
        message: 'Substitution created successfully',
        data: substitution,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Update substitution
   * PUT /api/substitutions/:id
   */
  async updateSubstitution(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const organizationId = req.user!.organizationId;
      const data = updateSubstitutionSchema.parse(req.body);

      const substitution = await substitutionService.updateSubstitution(id, organizationId, data);

      res.json({
        success: true,
        message: 'Substitution updated successfully',
        data: substitution,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Delete substitution
   * DELETE /api/substitutions/:id
   */
  async deleteSubstitution(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const organizationId = req.user!.organizationId;

      await substitutionService.deleteSubstitution(id, organizationId);

      res.json({
        success: true,
        message: 'Substitution deleted successfully',
      });
    } catch (error) {
      next(error);
    }
  }
}

export default new SubstitutionController();
