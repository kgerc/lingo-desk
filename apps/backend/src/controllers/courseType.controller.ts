import { Response, NextFunction } from 'express';
import { z } from 'zod';
import courseTypeService from '../services/courseType.service';
import { AuthRequest } from '../middleware/auth';

const createCourseTypeSchema = z.object({
  name: z.string().min(2),
  category: z.string().min(2),
  description: z.string().optional(),
});

const updateCourseTypeSchema = z.object({
  name: z.string().min(2).optional(),
  category: z.string().min(2).optional(),
  description: z.string().optional(),
});

class CourseTypeController {
  async getCourseTypes(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const courseTypes = await courseTypeService.getCourseTypes(req.user.organizationId);
      res.json({ message: 'Course types retrieved successfully', data: courseTypes });
    } catch (error) {
      next(error);
    }
  }

  async getCourseTypeById(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const courseType = await courseTypeService.getCourseTypeById(id, req.user.organizationId);
      res.json({ message: 'Course type retrieved successfully', data: courseType });
    } catch (error) {
      next(error);
    }
  }

  async createCourseType(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const data = createCourseTypeSchema.parse(req.body);
      const courseType = await courseTypeService.createCourseType({
        ...data,
        organizationId: req.user.organizationId,
      });
      res.status(201).json({ message: 'Course type created successfully', data: courseType });
    } catch (error) {
      next(error);
    }
  }

  async updateCourseType(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const data = updateCourseTypeSchema.parse(req.body);
      const courseType = await courseTypeService.updateCourseType(
        id,
        req.user.organizationId,
        data
      );
      res.json({ message: 'Course type updated successfully', data: courseType });
    } catch (error) {
      next(error);
    }
  }

  async deleteCourseType(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const result = await courseTypeService.deleteCourseType(id, req.user.organizationId);
      res.json(result);
    } catch (error) {
      next(error);
    }
  }
}

export default new CourseTypeController();
