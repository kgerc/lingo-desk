import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/auth';
import { materialService, CreateMaterialData, UpdateMaterialData } from '../services/material.service';

class MaterialController {
  async getMaterialsByCourse(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { courseId } = req.params;
      const materials = await materialService.getMaterialsByCourse(courseId as string);

      res.json({
        success: true,
        data: materials,
      });
    } catch (error) {
      next(error);
    }
  }

  async getMaterialById(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const material = await materialService.getMaterialById(id as string);

      res.json({
        success: true,
        data: material,
      });
    } catch (error) {
      next(error);
    }
  }

  async createMaterial(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const data: CreateMaterialData = req.body;
      const material = await materialService.createMaterial(data, req.user!.organizationId);

      res.status(201).json({
        success: true,
        data: material,
      });
    } catch (error) {
      next(error);
    }
  }

  async updateMaterial(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const data: UpdateMaterialData = req.body;
      const material = await materialService.updateMaterial(id as string, data, req.user!.organizationId);

      res.json({
        success: true,
        data: material,
      });
    } catch (error) {
      next(error);
    }
  }

  async deleteMaterial(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      await materialService.deleteMaterial(id as string, req.user!.organizationId);

      res.json({
        success: true,
        message: 'Materiał usunięty pomyślnie',
      });
    } catch (error) {
      next(error);
    }
  }

  async reorderMaterials(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { courseId } = req.params;
      const { materialIds } = req.body;

      await materialService.reorderMaterials(courseId as string, materialIds, req.user!.organizationId);

      res.json({
        success: true,
        message: 'Materiały zostały uporządkowane pomyślnie',
      });
    } catch (error) {
      next(error);
    }
  }
}

export const materialController = new MaterialController();
