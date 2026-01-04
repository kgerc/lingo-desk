import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import { UserRole } from '@prisma/client';

const router = Router();
router.use(authenticate);

router.get('/', authorize(UserRole.ADMIN), (req, res) => {
  res.json({ message: 'Get organization - TODO' });
});

router.put('/', authorize(UserRole.ADMIN), (req, res) => {
  res.json({ message: 'Update organization - TODO' });
});

router.get('/settings', authorize(UserRole.ADMIN), (req, res) => {
  res.json({ message: 'Get settings - TODO' });
});

router.put('/settings', authorize(UserRole.ADMIN), (req, res) => {
  res.json({ message: 'Update settings - TODO' });
});

export default router;
