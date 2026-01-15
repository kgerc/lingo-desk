import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import dashboardController from '../controllers/dashboard.controller';

const router = Router();
router.use(authenticate);

// GET /api/dashboard/stats - Get dashboard statistics
router.get('/stats', dashboardController.getStats.bind(dashboardController));

// GET /api/dashboard/charts - Get chart data with date range
router.get('/charts', dashboardController.getChartData.bind(dashboardController));

// GET /api/dashboard/reminders - Get teacher reminders
router.get('/reminders', dashboardController.getReminders.bind(dashboardController));

export default router;
