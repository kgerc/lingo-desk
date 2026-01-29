import { Request, Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import googleCalendarService from '../services/google-calendar.service';
import prisma from '../utils/prisma';

class GoogleCalendarController {
  /**
   * Initiate OAuth flow
   * GET /api/google-calendar/auth
   */
  async initiateAuth(req: AuthRequest, res: Response) {
    try {
      const userId = req.user?.id;

      if (!userId) {
        return res.status(401).json({ message: 'Unauthorized' });
      }

      const authUrl = googleCalendarService.getAuthUrl(userId);

      // Return auth URL for frontend to redirect
      return res.json({ authUrl });
    } catch (error) {
      console.error('Error initiating Google Calendar auth:', error);
      return res.status(500).json({ message: 'Nie udało się zainicjować autoryzacji' });
    }
  }

  /**
   * Handle OAuth callback from Google
   * GET /api/google-calendar/callback?code=XXX&state=userId
   */
  async handleCallback(req: Request, res: Response) {
    try {
      const { code, state: userId } = req.query;

      if (!code || typeof code !== 'string') {
        return res.status(400).json({ message: 'Missing authorization code' });
      }

      if (!userId || typeof userId !== 'string') {
        return res.status(400).json({ message: 'Missing user ID' });
      }

      // Get user's organization ID
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { organizationId: true },
      });

      if (!user) {
        return res.status(404).json({ message: 'Nie znaleziono użytkownika' });
      }

      // Handle the callback and save tokens
      await googleCalendarService.handleCallback(code, userId, user.organizationId);

      // Perform initial sync of existing lessons and import external events in background
      googleCalendarService.syncAllLessonsToGoogleCalendar(userId).catch(error => {
        console.error('Error during initial lesson sync:', error);
      });

      googleCalendarService.importExternalEvents(userId).catch(error => {
        console.error('Error during initial external events import:', error);
      });

      // Redirect to frontend settings page with success
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
      return res.redirect(`${frontendUrl}/settings?google_calendar=connected`);
    } catch (error) {
      console.error('Error handling Google Calendar callback:', error);
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
      return res.redirect(`${frontendUrl}/settings?google_calendar=error`);
    }
  }

  /**
   * Get sync status for current user
   * GET /api/google-calendar/status
   */
  async getSyncStatus(req: AuthRequest, res: Response) {
    try {
      const userId = req.user?.id;

      if (!userId) {
        return res.status(401).json({ message: 'Unauthorized' });
      }

      const status = await googleCalendarService.getSyncStatus(userId);

      if (!status) {
        return res.json({ connected: false });
      }

      return res.json({
        connected: true,
        isActive: status.isActive,
        lastSyncAt: status.lastSyncAt?.toISOString() || null,
        calendarId: status.calendarId,
        connectedAt: status.createdAt.toISOString(),
      });
    } catch (error) {
      console.error('Error getting sync status:', error);
      return res.status(500).json({ message: 'Nie udało się pobrać statusu synchronizacji' });
    }
  }

  /**
   * Disconnect Google Calendar
   * POST /api/google-calendar/disconnect
   */
  async disconnect(req: AuthRequest, res: Response) {
    try {
      const userId = req.user?.id;

      if (!userId) {
        return res.status(401).json({ message: 'Unauthorized' });
      }

      await googleCalendarService.disconnect(userId);

      return res.json({ message: 'Kalendarz Google został odłączony pomyślnie' });
    } catch (error) {
      console.error('Error disconnecting Google Calendar:', error);
      return res.status(500).json({ message: 'Nie udało się odłączyć Kalendarza Google' });
    }
  }

  /**
   * Handle webhook notification from Google Calendar
   * POST /api/google-calendar/webhook
   */
  async handleWebhook(req: Request, res: Response) {
    try {
      const channelId = req.headers['x-goog-channel-id'] as string;
      const resourceId = req.headers['x-goog-resource-id'] as string;
      const resourceState = req.headers['x-goog-resource-state'] as string;

      // Acknowledge webhook immediately
      res.status(200).send();

      // Only process 'exists' and 'sync' states (ignore 'not_exists')
      if (resourceState === 'exists' || resourceState === 'sync') {
        if (channelId && resourceId) {
          // Process webhook asynchronously
          googleCalendarService.handleWebhook(channelId, resourceId).catch(error => {
            console.error('Error processing webhook:', error);
          });
        }
      }

      return;
    } catch (error) {
      console.error('Error handling webhook:', error);
      // Still return 200 to acknowledge receipt
      return res.status(200).send();
    }
  }

  /**
   * Setup watch for calendar changes
   * POST /api/google-calendar/watch
   */
  async setupWatch(req: AuthRequest, res: Response) {
    try {
      const userId = req.user?.id;

      if (!userId) {
        return res.status(401).json({ message: 'Unauthorized' });
      }

      const result = await googleCalendarService.setupWatch(userId);

      return res.json({ message: 'Nasłuchiwanie ustawione pomyślnie', data: result });
    } catch (error) {
      console.error('Error setting up watch:', error);
      return res.status(500).json({ message: 'Nie udało się ustawić nasłuchiwania' });
    }
  }

  /**
   * Stop watch for calendar changes
   * POST /api/google-calendar/stop-watch
   */
  async stopWatch(req: AuthRequest, res: Response) {
    try {
      const userId = req.user?.id;

      if (!userId) {
        return res.status(401).json({ message: 'Unauthorized' });
      }

      await googleCalendarService.stopWatch(userId);

      return res.json({ message: 'Nasłuchiwanie zatrzymane pomyślnie' });
    } catch (error) {
      console.error('Error stopping watch:', error);
      return res.status(500).json({ message: 'Nie udało się zatrzymać nasłuchiwania' });
    }
  }

  /**
   * Manually trigger sync: push all lessons to Google Calendar and import external events
   * POST /api/google-calendar/sync
   */
  async syncFromGoogleCalendar(req: AuthRequest, res: Response) {
    try {
      const userId = req.user?.id;

      if (!userId) {
        return res.status(401).json({ message: 'Unauthorized' });
      }

      // Push all existing lessons to Google Calendar
      const pushResult = await googleCalendarService.syncAllLessonsToGoogleCalendar(userId);

      // Import external events from Google Calendar
      const importResult = await googleCalendarService.importExternalEvents(userId);

      return res.json({
        message: 'Synchronizacja zakończona pomyślnie',
        lessonsSynced: pushResult,
        externalEventsImported: importResult,
      });
    } catch (error) {
      console.error('Error syncing with Google Calendar:', error);
      return res.status(500).json({ message: 'Nie udało się zsynchronizować z Kalendarzem Google' });
    }
  }

  /**
   * Get external calendar events
   * GET /api/google-calendar/external-events?startDate=...&endDate=...
   */
  async getExternalEvents(req: AuthRequest, res: Response) {
    try {
      const userId = req.user?.id;

      if (!userId) {
        return res.status(401).json({ message: 'Unauthorized' });
      }

      const { startDate, endDate } = req.query;
      const start = startDate ? new Date(String(startDate)) : undefined;
      const end = endDate ? new Date(String(endDate)) : undefined;

      const events = await googleCalendarService.getExternalEvents(userId, start, end);

      return res.json({
        message: 'Zdarzenia zewnętrzne pobrane pomyślnie',
        data: events,
      });
    } catch (error) {
      console.error('Error getting external events:', error);
      return res.status(500).json({ message: 'Nie udało się pobrać zdarzeń zewnętrznych' });
    }
  }
}

export default new GoogleCalendarController();
