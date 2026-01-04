import { Router } from 'express';
import { authenticate } from '../middleware/auth';

const router = Router();
router.use(authenticate);

router.get('/', (req, res) => {
  res.json({ message: 'List courses - TODO' });
});

router.get('/:id', (req, res) => {
  res.json({ message: `Get course ${req.params.id} - TODO` });
});

router.post('/', (req, res) => {
  res.json({ message: 'Create course - TODO' });
});

router.put('/:id', (req, res) => {
  res.json({ message: `Update course ${req.params.id} - TODO` });
});

router.delete('/:id', (req, res) => {
  res.json({ message: `Delete course ${req.params.id} - TODO` });
});

export default router;
