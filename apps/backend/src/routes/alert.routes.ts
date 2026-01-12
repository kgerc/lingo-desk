import { Router } from 'express';
import { alertController } from '../controllers/alert.controller';
import { authenticate } from '../middleware/auth';

const router = Router();

// All routes require authentication
router.use(authenticate);

// GET /api/alerts - Get organization alerts with pagination
router.get('/', alertController.getAlerts.bind(alertController));

// GET /api/alerts/unread-count - Get count of unread alerts
router.get('/unread-count', alertController.getUnreadCount.bind(alertController));

// PATCH /api/alerts/:id/read - Mark specific alert as read
router.patch('/:id/read', alertController.markAsRead.bind(alertController));

// PATCH /api/alerts/mark-all-read - Mark all alerts as read
router.patch('/mark-all-read', alertController.markAllAsRead.bind(alertController));

// POST /api/alerts/generate - Generate system alerts (can be called manually or via cron)
router.post('/generate', alertController.generateSystemAlerts.bind(alertController));

export default router;
