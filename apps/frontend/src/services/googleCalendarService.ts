import api from '../lib/api';

interface GoogleCalendarSyncStatus {
  connected: boolean;
  isActive?: boolean;
  lastSyncAt?: string | null;
  calendarId?: string;
  connectedAt?: string;
}

interface GoogleCalendarAuthResponse {
  authUrl: string;
}

interface GoogleCalendarSyncResult {
  message: string;
  lessonsSynced: {
    total: number;
    synced: number;
    failed: number;
  };
  externalEventsImported?: {
    total: number;
    imported: number;
    failed: number;
  };
}

interface ExternalCalendarEvent {
  id: string;
  title: string;
  description?: string;
  startTime: string;
  endTime: string;
  location?: string;
  isAllDay: boolean;
}

class GoogleCalendarService {
  /**
   * Get Google Calendar sync status
   */
  async getSyncStatus(): Promise<GoogleCalendarSyncStatus> {
    const response = await api.get('/google-calendar/status');
    return response.data;
  }

  /**
   * Initiate OAuth connection flow
   */
  async connect(): Promise<GoogleCalendarAuthResponse> {
    const response = await api.get('/google-calendar/auth');
    return response.data;
  }

  /**
   * Disconnect Google Calendar
   */
  async disconnect(): Promise<void> {
    await api.post('/google-calendar/disconnect');
  }

  /**
   * Setup watch for calendar changes (enable push notifications)
   */
  async setupWatch(): Promise<void> {
    await api.post('/google-calendar/watch');
  }

  /**
   * Stop watch for calendar changes (disable push notifications)
   */
  async stopWatch(): Promise<void> {
    await api.post('/google-calendar/stop-watch');
  }

  /**
   * Manually trigger sync from Google Calendar
   */
  async syncFromGoogleCalendar(): Promise<GoogleCalendarSyncResult> {
    const response = await api.post('/google-calendar/sync');
    return response.data;
  }

  /**
   * Get external calendar events
   */
  async getExternalEvents(startDate?: Date, endDate?: Date): Promise<ExternalCalendarEvent[]> {
    const params = new URLSearchParams();
    if (startDate) params.append('startDate', startDate.toISOString());
    if (endDate) params.append('endDate', endDate.toISOString());

    const response = await api.get(`/google-calendar/external-events?${params.toString()}`);
    return response.data.data;
  }
}

export const googleCalendarService = new GoogleCalendarService();
export type { ExternalCalendarEvent };
