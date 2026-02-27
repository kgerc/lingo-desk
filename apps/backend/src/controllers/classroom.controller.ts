import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/auth';
import { classroomService } from '../services/classroom.service';

class ClassroomController {
  // ─── Classrooms ───────────────────────────────────────────────────────────

  async getClassrooms(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user?.organizationId) {
        res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'User not authenticated' } });
        return;
      }

      const locationId = req.query.locationId as string | undefined;
      const isActive = req.query.isActive === 'true' ? true : req.query.isActive === 'false' ? false : undefined;

      const classrooms = await classroomService.getClassrooms(req.user.organizationId, { locationId, isActive });
      res.json({ data: classrooms });
    } catch (error) {
      next(error);
    }
  }

  async getClassroomById(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user?.organizationId) {
        res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'User not authenticated' } });
        return;
      }

      const classroom = await classroomService.getClassroomById(req.params.id, req.user.organizationId);
      res.json({ data: classroom });
    } catch (error) {
      next(error);
    }
  }

  async createClassroom(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user?.organizationId) {
        res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'User not authenticated' } });
        return;
      }

      const { locationId, name, capacity } = req.body;

      if (!locationId || !name) {
        res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'locationId and name are required' } });
        return;
      }

      const classroom = await classroomService.createClassroom({
        locationId,
        name,
        capacity: capacity ? Number(capacity) : undefined,
        organizationId: req.user.organizationId,
      });

      res.status(201).json({ data: classroom });
    } catch (error) {
      next(error);
    }
  }

  async updateClassroom(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user?.organizationId) {
        res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'User not authenticated' } });
        return;
      }

      const { name, capacity, isActive, locationId } = req.body;

      const classroom = await classroomService.updateClassroom(req.params.id, req.user.organizationId, {
        name,
        capacity: capacity !== undefined ? Number(capacity) : undefined,
        isActive,
        locationId,
      });

      res.json({ data: classroom });
    } catch (error) {
      next(error);
    }
  }

  async deleteClassroom(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user?.organizationId) {
        res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'User not authenticated' } });
        return;
      }

      await classroomService.deleteClassroom(req.params.id, req.user.organizationId);
      res.json({ data: { success: true } });
    } catch (error) {
      next(error);
    }
  }

  async checkConflict(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user?.organizationId) {
        res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'User not authenticated' } });
        return;
      }

      const { classroomId, scheduledAt, durationMinutes, excludeLessonId } = req.query;

      if (!classroomId || !scheduledAt || !durationMinutes) {
        res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'classroomId, scheduledAt, durationMinutes are required' } });
        return;
      }

      const result = await classroomService.checkConflict(
        classroomId as string,
        new Date(scheduledAt as string),
        Number(durationMinutes),
        excludeLessonId as string | undefined
      );

      res.json({ data: result });
    } catch (error) {
      next(error);
    }
  }

  // ─── Locations ────────────────────────────────────────────────────────────

  async getLocations(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user?.organizationId) {
        res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'User not authenticated' } });
        return;
      }

      const isActive = req.query.isActive === 'true' ? true : req.query.isActive === 'false' ? false : undefined;
      const locations = await classroomService.getLocations(req.user.organizationId, { isActive });
      res.json({ data: locations });
    } catch (error) {
      next(error);
    }
  }

  async createLocation(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user?.organizationId) {
        res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'User not authenticated' } });
        return;
      }

      const { name, address } = req.body;

      if (!name) {
        res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'name is required' } });
        return;
      }

      const location = await classroomService.createLocation({
        organizationId: req.user.organizationId,
        name,
        address,
      });

      res.status(201).json({ data: location });
    } catch (error) {
      next(error);
    }
  }

  async updateLocation(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user?.organizationId) {
        res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'User not authenticated' } });
        return;
      }

      const { name, address, isActive } = req.body;
      const location = await classroomService.updateLocation(req.params.id, req.user.organizationId, { name, address, isActive });
      res.json({ data: location });
    } catch (error) {
      next(error);
    }
  }

  async deleteLocation(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user?.organizationId) {
        res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'User not authenticated' } });
        return;
      }

      await classroomService.deleteLocation(req.params.id, req.user.organizationId);
      res.json({ data: { success: true } });
    } catch (error) {
      next(error);
    }
  }
}

export const classroomController = new ClassroomController();
export default classroomController;
