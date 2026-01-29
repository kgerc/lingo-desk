import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/auth';
import { fileService, CreateFileData, UploadFileData } from '../services/file.service';
import multer from 'multer';

class FileController {
  async getFiles(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { relatedToType, relatedToId } = req.query;

      const files = await fileService.getFilesByOrganization(req.user!.organizationId, {
        relatedToType: relatedToType as string | undefined,
        relatedToId: relatedToId as string | undefined,
      });

      res.json({
        success: true,
        data: files,
      });
    } catch (error) {
      next(error);
    }
  }

  async getFileById(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const file = await fileService.getFileById(id as string, req.user!.organizationId);

      res.json({
        success: true,
        data: file,
      });
    } catch (error) {
      next(error);
    }
  }

  async createFile(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const data: CreateFileData = req.body;
      const file = await fileService.createFile(
        data,
        req.user!.organizationId,
        req.user!.id
      );

      res.status(201).json({
        success: true,
        data: file,
      });
    } catch (error) {
      next(error);
    }
  }

  async uploadFile(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.file) {
        res.status(400).json({
          success: false,
          error: { message: 'No file uploaded' },
        });
        return;
      }

      const uploadData: UploadFileData = {
        file: req.file.buffer,
        fileName: req.file.originalname,
        fileType: req.file.mimetype,
        fileSize: req.file.size,
        relatedToType: req.body.relatedToType,
        relatedToId: req.body.relatedToId,
        isPublic: req.body.isPublic === 'true',
      };

      const file = await fileService.uploadFile(
        uploadData,
        req.user!.organizationId,
        req.user!.id
      );

      res.status(201).json({
        success: true,
        data: file,
      });
    } catch (error) {
      next(error);
    }
  }

  async deleteFile(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const result = await fileService.deleteFile(id as string, req.user!.organizationId);

      res.json({
        success: true,
        message: 'Plik usunięty pomyślnie',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }
}

// Configure multer for memory storage
export const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB
  },
});

export const fileController = new FileController();
