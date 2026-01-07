import { Router } from 'express';
import { fileController, upload } from '../controllers/file.controller';
import { authenticate } from '../middleware/auth';

const router = Router();

// All routes require authentication
router.use(authenticate);

// Get all files for organization
router.get('/', fileController.getFiles.bind(fileController));

// Get file by ID
router.get('/:id', fileController.getFileById.bind(fileController));

// Upload file
router.post('/upload', upload.single('file'), fileController.uploadFile.bind(fileController));

// Create new file (upload metadata only - for external files)
router.post('/', fileController.createFile.bind(fileController));

// Delete file
router.delete('/:id', fileController.deleteFile.bind(fileController));

export default router;
