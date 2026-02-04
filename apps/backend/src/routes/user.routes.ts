import { Router } from 'express';
import { authenticate, requirePermission } from '../middleware/auth';
import { PERMISSIONS } from '../config/permissions';
import userController from '../controllers/user.controller';

const router = Router();

// All routes require authentication
router.use(authenticate);

// GET /api/users/stats - Get user statistics
router.get('/stats', requirePermission(PERMISSIONS.USERS_VIEW), userController.getUserStats);

// GET /api/users - List all users
router.get('/', requirePermission(PERMISSIONS.USERS_VIEW), userController.getUsers);

// GET /api/users/:id - Get user by ID
router.get('/:id', requirePermission(PERMISSIONS.USERS_VIEW), userController.getUserById);

// POST /api/users/invite - Invite new user
router.post('/invite', requirePermission(PERMISSIONS.USERS_CREATE), userController.inviteUser);

// PUT /api/users/:id - Update user
router.put('/:id', requirePermission(PERMISSIONS.USERS_UPDATE), userController.updateUser);

// POST /api/users/:id/deactivate - Deactivate user
router.post('/:id/deactivate', requirePermission(PERMISSIONS.USERS_DELETE), userController.deactivateUser);

// POST /api/users/:id/reactivate - Reactivate user
router.post('/:id/reactivate', requirePermission(PERMISSIONS.USERS_UPDATE), userController.reactivateUser);

// POST /api/users/:id/reset-password - Reset user password
router.post('/:id/reset-password', requirePermission(PERMISSIONS.USERS_UPDATE), userController.resetUserPassword);

export default router;
