import { Router } from 'express';
import { authenticate } from '../middleware/auth';

const router = Router();
router.use(authenticate);

router.get('/', (req, res) => {
  res.json({ message: 'List lessons - TODO' });
});

router.get('/:id', (req, res) => {
  res.json({ message: `Get lesson ${req.params.id} - TODO` });
});

router.post('/', (req, res) => {
  res.json({ message: 'Create lesson - TODO' });
});

router.put('/:id', (req, res) => {
  res.json({ message: `Update lesson ${req.params.id} - TODO` });
});

router.delete('/:id', (req, res) => {
  res.json({ message: `Delete lesson ${req.params.id} - TODO` });
});

router.post('/:id/confirm', (req, res) => {
  res.json({ message: `Confirm lesson ${req.params.id} - TODO` });
});

export default router;
