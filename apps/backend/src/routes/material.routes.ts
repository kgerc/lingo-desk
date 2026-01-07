import { Router } from 'express';
import { materialController } from '../controllers/material.controller';
import { authenticate } from '../middleware/auth';

const router = Router();

// All routes require authentication
router.use(authenticate);

// Get materials for a specific course
router.get('/course/:courseId', materialController.getMaterialsByCourse.bind(materialController));

// Get material by ID
router.get('/:id', materialController.getMaterialById.bind(materialController));

// Create new material
router.post('/', materialController.createMaterial.bind(materialController));

// Update material
router.put('/:id', materialController.updateMaterial.bind(materialController));

// Delete material
router.delete('/:id', materialController.deleteMaterial.bind(materialController));

// Reorder materials for a course
router.post('/course/:courseId/reorder', materialController.reorderMaterials.bind(materialController));

export default router;
