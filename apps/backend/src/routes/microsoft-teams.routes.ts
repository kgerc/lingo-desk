import { Router } from 'express';
import microsoftTeamsController from '../controllers/microsoft-teams.controller';
import { authenticate } from '../middleware/auth';

const router = Router();

// Initiate OAuth flow (requires auth to know which user is connecting)
router.get('/auth', authenticate, microsoftTeamsController.initiateAuth.bind(microsoftTeamsController));

// OAuth callback from Microsoft (no auth middleware — Microsoft redirects here)
router.get('/callback', microsoftTeamsController.handleCallback.bind(microsoftTeamsController));

// Get sync status
router.get('/status', authenticate, microsoftTeamsController.getSyncStatus.bind(microsoftTeamsController));

// Disconnect integration
router.post('/disconnect', authenticate, microsoftTeamsController.disconnect.bind(microsoftTeamsController));

export default router;
