import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import { UserRole } from '@prisma/client';
import substitutionController from '../controllers/substitution.controller';

const router = Router();
router.use(authenticate);

// Get all substitutions
router.get('/', substitutionController.getSubstitutions.bind(substitutionController));

// Get substitution by lesson ID
router.get('/lesson/:lessonId', substitutionController.getSubstitutionByLessonId.bind(substitutionController));

// Get substitution by ID
router.get('/:id', substitutionController.getSubstitutionById.bind(substitutionController));

// Create new substitution (teachers, managers, admins)
router.post(
  '/',
  authorize(UserRole.ADMIN, UserRole.MANAGER, UserRole.TEACHER),
  substitutionController.createSubstitution.bind(substitutionController)
);

// Update substitution (teachers, managers, admins)
router.put(
  '/:id',
  authorize(UserRole.ADMIN, UserRole.MANAGER, UserRole.TEACHER),
  substitutionController.updateSubstitution.bind(substitutionController)
);

// Delete substitution (managers, admins)
router.delete(
  '/:id',
  authorize(UserRole.ADMIN, UserRole.MANAGER),
  substitutionController.deleteSubstitution.bind(substitutionController)
);

export default router;
