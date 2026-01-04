import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import { UserRole } from '@prisma/client';

const router = Router();
router.use(authenticate);

router.get('/', authorize(UserRole.ADMIN, UserRole.MANAGER), (req, res) => {
  res.json({ message: 'List teachers - TODO' });
});

router.get('/:id', (req, res) => {
  res.json({ message: `Get teacher ${req.params.id} - TODO` });
});

router.post('/', authorize(UserRole.ADMIN, UserRole.MANAGER), (req, res) => {
  res.json({ message: 'Create teacher - TODO' });
});

router.put('/:id', (req, res) => {
  res.json({ message: `Update teacher ${req.params.id} - TODO` });
});

router.delete('/:id', authorize(UserRole.ADMIN), (req, res) => {
  res.json({ message: `Delete teacher ${req.params.id} - TODO` });
});

export default router;
