import { Response, NextFunction } from 'express';
import { z } from 'zod';
import courseService from '../services/course.service';
import { AuthRequest } from '../middleware/auth';

const createCourseSchema = z.object({
  courseTypeId: z.string().uuid(),
  teacherId: z.string().uuid(),
  name: z.string().min(2),
  startDate: z.string().transform((str) => new Date(str)),
  endDate: z
    .string()
    .optional()
    .transform((str) => (str ? new Date(str) : undefined)),
  maxStudents: z.number().int().positive().optional(),
  locationId: z.string().uuid().optional(),
  classroomId: z.string().uuid().optional(),
  isActive: z.boolean().default(true),
});

const updateCourseSchema = z.object({
  teacherId: z.string().uuid().optional(),
  name: z.string().min(2).optional(),
  startDate: z
    .string()
    .optional()
    .transform((str) => (str ? new Date(str) : undefined)),
  endDate: z
    .string()
    .optional()
    .transform((str) => (str ? new Date(str) : undefined)),
  maxStudents: z.number().int().positive().optional(),
  locationId: z.string().uuid().optional(),
  classroomId: z.string().uuid().optional(),
  isActive: z.boolean().optional(),
});

const enrollStudentSchema = z.object({
  studentId: z.string().uuid(),
  paymentMode: z.enum(['PACKAGE', 'PER_LESSON']).optional(),
  hoursPurchased: z.number().min(0).optional(),
});

class CourseController {
  async getCourses(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { search, teacherId, courseTypeId, isActive } = req.query;

      const filters: any = {};
      if (search) filters.search = String(search);
      if (teacherId) filters.teacherId = String(teacherId);
      if (courseTypeId) filters.courseTypeId = String(courseTypeId);
      if (isActive !== undefined) filters.isActive = isActive === 'true';

      const courses = await courseService.getCourses(req.user!.organizationId, filters);
      res.json({ message: 'Courses retrieved successfully', data: courses });
    } catch (error) {
      next(error);
    }
  }

  async getCourseById(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const course = await courseService.getCourseById(id as string, req.user!.organizationId);
      res.json({ message: 'Course retrieved successfully', data: course });
    } catch (error) {
      next(error);
    }
  }

  async createCourse(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const data = createCourseSchema.parse(req.body);
      const course = await courseService.createCourse({
        ...data,
        organizationId: req.user!.organizationId,
      });
      res.status(201).json({ message: 'Course created successfully', data: course });
    } catch (error) {
      next(error);
    }
  }

  async updateCourse(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const data = updateCourseSchema.parse(req.body);
      const course = await courseService.updateCourse(id as string, req.user!.organizationId, data);
      res.json({ message: 'Course updated successfully', data: course });
    } catch (error) {
      next(error);
    }
  }

  async deleteCourse(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const result = await courseService.deleteCourse(id as string, req.user!.organizationId);
      res.json(result);
    } catch (error) {
      next(error);
    }
  }

  async getStats(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const stats = await courseService.getCourseStats(req.user!.organizationId);
      res.json({ message: 'Course stats retrieved successfully', data: stats });
    } catch (error) {
      next(error);
    }
  }

  async enrollStudent(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { id: courseId } = req.params;
      const { studentId, paymentMode, hoursPurchased } = enrollStudentSchema.parse(req.body);
      const enrollment = await courseService.enrollStudent(
        courseId as string,
        studentId as string,
        req.user!.organizationId,
        paymentMode,
        hoursPurchased
      );
      res.status(201).json({ message: 'Student enrolled successfully', data: enrollment });
    } catch (error) {
      next(error);
    }
  }

  async unenrollStudent(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { enrollmentId } = req.params;
      const result = await courseService.unenrollStudent(enrollmentId as string, req.user!.organizationId);
      res.json(result);
    } catch (error) {
      next(error);
    }
  }
}

export default new CourseController();
