import { Router } from 'express';
import { UserRole } from '@prisma/client';
import { authenticate, authorize } from '../middleware/auth';
import { documentController, uploadMiddleware } from '../controllers/document.controller';

const router = Router();

router.use(authenticate);

// Get all documents for a student
router.get(
  '/student/:studentId',
  authorize(UserRole.ADMIN, UserRole.MANAGER, UserRole.TEACHER, UserRole.METHODOLOGIST),
  documentController.getStudentDocuments.bind(documentController)
);

// Upload a document file for a student
router.post(
  '/student/:studentId/upload',
  authorize(UserRole.ADMIN, UserRole.MANAGER),
  uploadMiddleware.single('file'),
  documentController.uploadDocument.bind(documentController)
);

// Update document (status, notes, signedAt)
router.patch(
  '/:id',
  authorize(UserRole.ADMIN, UserRole.MANAGER),
  documentController.updateDocument.bind(documentController)
);

// Delete document
router.delete(
  '/:id',
  authorize(UserRole.ADMIN, UserRole.MANAGER),
  documentController.deleteDocument.bind(documentController)
);

// Send document by email
router.post(
  '/:id/send',
  authorize(UserRole.ADMIN, UserRole.MANAGER),
  documentController.sendDocument.bind(documentController)
);

export default router;
