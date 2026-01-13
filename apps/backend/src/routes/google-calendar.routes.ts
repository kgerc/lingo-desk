import { Router } from 'express';
import googleCalendarController from '../controllers/google-calendar.controller';
import { authenticate } from '../middleware/auth';

const router = Router();

// All routes require authentication except callback and webhook
router.get('/auth', authenticate, googleCalendarController.initiateAuth);
router.get('/callback', googleCalendarController.handleCallback);
router.get('/status', authenticate, googleCalendarController.getSyncStatus);
router.post('/disconnect', authenticate, googleCalendarController.disconnect);
router.post('/webhook', googleCalendarController.handleWebhook);
router.post('/watch', authenticate, googleCalendarController.setupWatch);
router.post('/stop-watch', authenticate, googleCalendarController.stopWatch);
router.post('/sync', authenticate, googleCalendarController.syncFromGoogleCalendar);
router.get('/external-events', authenticate, googleCalendarController.getExternalEvents);

export default router;
