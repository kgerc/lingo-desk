import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import { UserRole } from '@prisma/client';

const router = Router();

// All routes require authentication
router.use(authenticate);

// GET /api/users - List all users (admin/manager only)
router.get('/', authorize(UserRole.ADMIN, UserRole.MANAGER), (req, res) => {
  res.json({ message: 'List users - TODO' });
});

// GET /api/users/:id - Get user by ID
router.get('/:id', (req, res) => {
  res.json({ message: `Get user ${req.params.id} - TODO` });
});

// POST /api/users - Create user
router.post('/', authorize(UserRole.ADMIN, UserRole.MANAGER), (req, res) => {
  res.json({ message: 'Create user - TODO' });
});

// PUT /api/users/:id - Update user
router.put('/:id', (req, res) => {
  res.json({ message: `Update user ${req.params.id} - TODO` });
});

// DELETE /api/users/:id - Delete user
router.delete('/:id', authorize(UserRole.ADMIN), (req, res) => {
  res.json({ message: `Delete user ${req.params.id} - TODO` });
});

export default router;
