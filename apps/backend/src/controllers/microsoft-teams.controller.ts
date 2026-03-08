import { Request, Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import microsoftTeamsService from '../services/microsoft-teams.service';
import prisma from '../utils/prisma';

class MicrosoftTeamsController {
  /**
   * Initiate OAuth flow
   * GET /api/microsoft-teams/auth
   */
  async initiateAuth(req: AuthRequest, res: Response) {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ message: 'Unauthorized' });

      const authUrl = microsoftTeamsService.getAuthUrl(userId);
      return res.json({ authUrl });
    } catch (error) {
      console.error('Error initiating Microsoft Teams auth:', error);
      return res.status(500).json({ message: 'Nie udało się zainicjować autoryzacji Microsoft Teams' });
    }
  }

  /**
   * Handle OAuth callback from Microsoft
   * GET /api/microsoft-teams/callback?code=XXX&state=userId
   */
  async handleCallback(req: Request, res: Response) {
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';

    try {
      const { code, state: userId, error } = req.query;

      if (error) {
        console.error('Microsoft OAuth error:', error);
        return res.redirect(`${frontendUrl}/settings?microsoft_teams=error`);
      }

      if (!code || typeof code !== 'string') {
        return res.redirect(`${frontendUrl}/settings?microsoft_teams=error`);
      }

      if (!userId || typeof userId !== 'string') {
        return res.redirect(`${frontendUrl}/settings?microsoft_teams=error`);
      }

      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { organizationId: true },
      });

      if (!user) {
        return res.redirect(`${frontendUrl}/settings?microsoft_teams=error`);
      }

      await microsoftTeamsService.handleCallback(code, userId, user.organizationId);

      return res.redirect(`${frontendUrl}/settings?microsoft_teams=connected`);
    } catch (error) {
      console.error('Error handling Microsoft Teams callback:', error);
      return res.redirect(`${frontendUrl}/settings?microsoft_teams=error`);
    }
  }

  /**
   * Get sync status for current user
   * GET /api/microsoft-teams/status
   */
  async getSyncStatus(req: AuthRequest, res: Response) {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ message: 'Unauthorized' });

      const status = await microsoftTeamsService.getSyncStatus(userId);
      return res.json(status);
    } catch (error) {
      console.error('Error getting Microsoft Teams status:', error);
      return res.status(500).json({ message: 'Nie udało się pobrać statusu Microsoft Teams' });
    }
  }

  /**
   * Disconnect Microsoft Teams integration
   * POST /api/microsoft-teams/disconnect
   */
  async disconnect(req: AuthRequest, res: Response) {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ message: 'Unauthorized' });

      await microsoftTeamsService.disconnect(userId);
      return res.json({ message: 'Microsoft Teams rozłączony pomyślnie' });
    } catch (error) {
      console.error('Error disconnecting Microsoft Teams:', error);
      return res.status(500).json({ message: 'Nie udało się rozłączyć Microsoft Teams' });
    }
  }
}

export default new MicrosoftTeamsController();
