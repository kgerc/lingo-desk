import { Router } from 'express';
import { authenticate } from '../middleware/auth';

const router = Router();
router.use(authenticate);

router.get('/', (req, res) => {
  res.json({ message: 'List payments - TODO' });
});

router.get('/:id', (req, res) => {
  res.json({ message: `Get payment ${req.params.id} - TODO` });
});

router.post('/', (req, res) => {
  res.json({ message: 'Create payment - TODO' });
});

export default router;
