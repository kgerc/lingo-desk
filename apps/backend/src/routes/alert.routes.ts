import { Router } from 'express';
import { alertController } from '../controllers/alert.controller';
import { authenticate } from '../middleware/auth';

const router = Router();

// All routes require authentication
router.use(authenticate);

// GET /api/alerts - Get organization alerts
router.get('/', alertController.getAlerts.bind(alertController));

export default router;
