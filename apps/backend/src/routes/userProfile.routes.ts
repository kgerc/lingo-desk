import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import userProfileController from '../controllers/userProfile.controller';

const router = Router();
router.use(authenticate);

// Get user profile
router.get('/', userProfileController.getProfile.bind(userProfileController));

// Update user profile
router.put('/', userProfileController.updateProfile.bind(userProfileController));

// Get notification preferences
router.get(
  '/notification-preferences',
  userProfileController.getNotificationPreferences.bind(userProfileController)
);

// Update notification preferences
router.put(
  '/notification-preferences',
  userProfileController.updateNotificationPreferences.bind(userProfileController)
);

export default router;
