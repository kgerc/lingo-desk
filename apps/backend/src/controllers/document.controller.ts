import { Response, NextFunction } from 'express';
import { z } from 'zod';
import multer from 'multer';
import { StudentDocumentType, DocumentStatus } from '@prisma/client';
import { AuthRequest } from '../middleware/auth';
import { documentService } from '../services/document.service';

const uploadDocumentSchema = z.object({
  name: z.string().min(1, 'Nazwa jest wymagana'),
  type: z.nativeEnum(StudentDocumentType).optional(),
  notes: z.string().optional(),
});

const updateDocumentSchema = z.object({
  status: z.nativeEnum(DocumentStatus).optional(),
  notes: z.string().optional(),
  signedAt: z.string().datetime().optional().nullable(),
});

const sendDocumentSchema = z.object({
  email: z.string().email('Nieprawidłowy adres e-mail'),
});

class DocumentController {
  async getStudentDocuments(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { studentId } = req.params;
      const documents = await documentService.getStudentDocuments(
        studentId,
        req.user!.organizationId
      );
      res.json({ success: true, data: documents });
    } catch (error) {
      next(error);
    }
  }

  async uploadDocument(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.file) {
        res.status(400).json({ success: false, error: { message: 'Brak pliku' } });
        return;
      }

      const parsed = uploadDocumentSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({
          success: false,
          error: { message: 'Nieprawidłowe dane', details: parsed.error.errors },
        });
        return;
      }

      const { studentId } = req.params;
      const document = await documentService.uploadDocument(
        studentId,
        req.user!.organizationId,
        req.user!.id,
        {
          ...parsed.data,
          file: req.file.buffer,
          fileName: req.file.originalname,
          fileType: req.file.mimetype,
          fileSize: req.file.size,
        }
      );

      res.status(201).json({ success: true, data: document });
    } catch (error) {
      next(error);
    }
  }

  async updateDocument(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const parsed = updateDocumentSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({
          success: false,
          error: { message: 'Nieprawidłowe dane', details: parsed.error.errors },
        });
        return;
      }

      const { signedAt: signedAtRaw, ...restData } = parsed.data;
      const signedAt: Date | null | undefined =
        signedAtRaw === undefined ? undefined : signedAtRaw === null ? null : new Date(signedAtRaw);

      const document = await documentService.updateDocument(id, req.user!.organizationId, {
        ...restData,
        signedAt,
      });

      res.json({ success: true, data: document });
    } catch (error) {
      next(error);
    }
  }

  async deleteDocument(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      await documentService.deleteDocument(id, req.user!.organizationId);
      res.json({ success: true, message: 'Dokument usunięty' });
    } catch (error) {
      next(error);
    }
  }

  async sendDocument(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const parsed = sendDocumentSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({
          success: false,
          error: { message: 'Nieprawidłowe dane', details: parsed.error.errors },
        });
        return;
      }

      const document = await documentService.sendDocumentByEmail(
        id,
        req.user!.organizationId,
        parsed.data.email
      );

      res.json({ success: true, data: document });
    } catch (error) {
      next(error);
    }
  }
}

// Multer for document uploads
export const uploadMiddleware = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
});

export const documentController = new DocumentController();
