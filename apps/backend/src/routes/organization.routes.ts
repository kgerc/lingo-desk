import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import { UserRole } from '@prisma/client';
import { organizationController } from '../controllers/organization.controller';

const router = Router();
router.use(authenticate);

// Get current organization
router.get('/', organizationController.getOrganization.bind(organizationController));

// Get all organizations user has access to
router.get('/my-organizations', organizationController.getUserOrganizations.bind(organizationController));

// Update organization (ADMIN or MANAGER only)
router.put(
  '/',
  authorize(UserRole.ADMIN, UserRole.MANAGER),
  organizationController.updateOrganization.bind(organizationController)
);

// Create new organization
router.post(
  '/',
  organizationController.createOrganization.bind(organizationController)
);

// Switch active organization
router.post('/switch', organizationController.switchOrganization.bind(organizationController));

// Add user to organization (ADMIN or MANAGER only)
router.post(
  '/users',
  authorize(UserRole.ADMIN, UserRole.MANAGER),
  organizationController.addUserToOrganization.bind(organizationController)
);

// Remove user from organization (ADMIN or MANAGER only)
router.delete(
  '/users/:userId',
  authorize(UserRole.ADMIN, UserRole.MANAGER),
  organizationController.removeUserFromOrganization.bind(organizationController)
);

// Update organization settings (ADMIN or MANAGER only)
router.put(
  '/settings',
  authorize(UserRole.ADMIN, UserRole.MANAGER),
  organizationController.updateOrganizationSettings.bind(organizationController)
);

// Get visibility settings (ADMIN or MANAGER can view)
router.get(
  '/visibility',
  authorize(UserRole.ADMIN, UserRole.MANAGER),
  organizationController.getVisibilitySettings.bind(organizationController)
);

// Update visibility settings (ADMIN only)
router.put(
  '/visibility',
  authorize(UserRole.ADMIN),
  organizationController.updateVisibilitySettings.bind(organizationController)
);

export default router;
