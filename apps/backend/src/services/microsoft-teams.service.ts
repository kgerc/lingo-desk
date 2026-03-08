import axios from 'axios';
import prisma from '../utils/prisma';

const MS_AUTH_BASE = 'https://login.microsoftonline.com';
const MS_GRAPH_BASE = 'https://graph.microsoft.com/v1.0';
const TENANT_ID = process.env.MICROSOFT_TENANT_ID || 'common'; // 'common' for multi-tenant
const CLIENT_ID = process.env.MICROSOFT_CLIENT_ID || '';
const CLIENT_SECRET = process.env.MICROSOFT_CLIENT_SECRET || '';
const REDIRECT_URI = process.env.MICROSOFT_REDIRECT_URI || '';

// Required scopes for creating Teams online meetings
const SCOPES = [
  'openid',
  'profile',
  'email',
  'offline_access',
  'OnlineMeetings.ReadWrite',
  'Calendars.ReadWrite',
].join(' ');

class MicrosoftTeamsService {
  /**
   * Generate OAuth2 authorization URL for Microsoft identity platform
   */
  getAuthUrl(userId: string): string {
    const params = new URLSearchParams({
      client_id: CLIENT_ID,
      response_type: 'code',
      redirect_uri: REDIRECT_URI,
      scope: SCOPES,
      response_mode: 'query',
      state: userId, // Used to retrieve userId after callback
      prompt: 'select_account',
    });

    return `${MS_AUTH_BASE}/${TENANT_ID}/oauth2/v2.0/authorize?${params.toString()}`;
  }

  /**
   * Exchange authorization code for tokens and save to database
   */
  async handleCallback(code: string, userId: string, organizationId: string) {
    // Exchange code for tokens
    const tokenResponse = await axios.post(
      `${MS_AUTH_BASE}/${TENANT_ID}/oauth2/v2.0/token`,
      new URLSearchParams({
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        code,
        redirect_uri: REDIRECT_URI,
        grant_type: 'authorization_code',
        scope: SCOPES,
      }),
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
    );

    const tokenData = tokenResponse.data as Record<string, string>;
    const { access_token, refresh_token, expires_in } = tokenData;

    if (!access_token || !refresh_token) {
      throw new Error('Missing tokens from Microsoft OAuth response');
    }

    const tokenExpiry = new Date(Date.now() + Number(expires_in) * 1000);

    // Get Microsoft user profile
    const profileResponse = await axios.get(`${MS_GRAPH_BASE}/me`, {
      headers: { Authorization: `Bearer ${access_token}` },
    });

    const profileData = profileResponse.data as Record<string, string>;
    const microsoftUserId = profileData['id'];
    const email = profileData['mail'] || profileData['userPrincipalName'];

    if (!microsoftUserId || !email) {
      throw new Error('Could not retrieve Microsoft user profile');
    }

    // Upsert sync record
    const existing = await prisma.microsoftTeamsSync.findUnique({ where: { userId } });

    if (existing) {
      return await prisma.microsoftTeamsSync.update({
        where: { userId },
        data: {
          accessToken: access_token,
          refreshToken: refresh_token,
          tokenExpiry,
          microsoftUserId,
          email,
          isActive: true,
          lastSyncAt: new Date(),
        },
      });
    }

    return await prisma.microsoftTeamsSync.create({
      data: {
        userId,
        organizationId,
        accessToken: access_token,
        refreshToken: refresh_token,
        tokenExpiry,
        microsoftUserId,
        email,
        isActive: true,
      },
    });
  }

  /**
   * Get a valid access token for a user, refreshing if necessary
   */
  private async getAccessToken(userId: string): Promise<string | null> {
    const sync = await prisma.microsoftTeamsSync.findUnique({
      where: { userId, isActive: true },
    });

    if (!sync) return null;

    // Refresh token if expired (with 5 min buffer)
    if (sync.tokenExpiry < new Date(Date.now() + 5 * 60 * 1000)) {
      return await this.refreshAccessToken(sync.id, sync.refreshToken);
    }

    return sync.accessToken;
  }

  /**
   * Refresh the access token using the refresh token
   */
  private async refreshAccessToken(syncId: string, refreshToken: string): Promise<string> {
    const tokenResponse = await axios.post(
      `${MS_AUTH_BASE}/${TENANT_ID}/oauth2/v2.0/token`,
      new URLSearchParams({
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
        scope: SCOPES,
      }),
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
    );

    const refreshData = tokenResponse.data as Record<string, string>;
    const access_token = refreshData['access_token'];
    const new_refresh_token = refreshData['refresh_token'];
    const expires_in = refreshData['expires_in'];

    if (!access_token) {
      throw new Error('Failed to refresh Microsoft access token');
    }

    const tokenExpiry = new Date(Date.now() + Number(expires_in) * 1000);

    await prisma.microsoftTeamsSync.update({
      where: { id: syncId },
      data: {
        accessToken: access_token,
        // Only update refresh token if a new one was issued
        ...(new_refresh_token ? { refreshToken: new_refresh_token } : {}),
        tokenExpiry,
      },
    });

    return access_token;
  }

  /**
   * Create a Teams online meeting for a lesson
   */
  async createMeetingForLesson(lessonId: string, userId: string): Promise<void> {
    const lesson = await prisma.lesson.findUnique({
      where: { id: lessonId },
      include: {
        teacher: { include: { user: true } },
        student: { include: { user: true } },
      },
    });

    if (!lesson || lesson.deliveryMode !== 'ONLINE') return;

    const accessToken = await this.getAccessToken(userId);
    if (!accessToken) {
      console.log('Microsoft Teams not connected for user:', userId);
      return;
    }

    const startTime = new Date(lesson.scheduledAt);
    const endTime = new Date(startTime.getTime() + lesson.durationMinutes * 60_000);

    const meetingPayload = {
      subject: lesson.title,
      startDateTime: startTime.toISOString(),
      endDateTime: endTime.toISOString(),
      participants: {
        attendees: [
          {
            upn: lesson.teacher.user.email,
            role: 'presenter',
          },
          {
            upn: lesson.student.user.email,
            role: 'attendee',
          },
        ],
      },
    };

    const response = await axios.post(
      `${MS_GRAPH_BASE}/me/onlineMeetings`,
      meetingPayload,
      { headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' } }
    );

    const meetingData = response.data as Record<string, string>;
    const teamsMeetingId = meetingData['id'];
    const joinWebUrl = meetingData['joinWebUrl'];

    await prisma.lesson.update({
      where: { id: lessonId },
      data: {
        teamsMeetingId,
        teamsMeetingUrl: joinWebUrl,
      },
    });

    await prisma.microsoftTeamsSync.updateMany({
      where: { userId, isActive: true },
      data: { lastSyncAt: new Date() },
    });
  }

  /**
   * Update a Teams online meeting when lesson details change
   */
  async updateMeetingForLesson(lessonId: string, userId: string): Promise<void> {
    const lesson = await prisma.lesson.findUnique({
      where: { id: lessonId },
    });

    if (!lesson || lesson.deliveryMode !== 'ONLINE' || !lesson.teamsMeetingId) {
      // If no existing meeting but online mode, create one
      if (lesson?.deliveryMode === 'ONLINE' && !lesson.teamsMeetingId) {
        return await this.createMeetingForLesson(lessonId, userId);
      }
      return;
    }

    const accessToken = await this.getAccessToken(userId);
    if (!accessToken) return;

    const startTime = new Date(lesson.scheduledAt);
    const endTime = new Date(startTime.getTime() + lesson.durationMinutes * 60_000);

    await axios.patch(
      `${MS_GRAPH_BASE}/me/onlineMeetings/${lesson.teamsMeetingId}`,
      {
        subject: lesson.title,
        startDateTime: startTime.toISOString(),
        endDateTime: endTime.toISOString(),
      },
      { headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' } }
    );
  }

  /**
   * Cancel/delete a Teams online meeting when lesson is cancelled or deleted
   */
  async deleteMeetingForLesson(lessonId: string, userId: string): Promise<void> {
    const lesson = await prisma.lesson.findUnique({
      where: { id: lessonId },
    });

    if (!lesson?.teamsMeetingId) return;

    const accessToken = await this.getAccessToken(userId);
    if (!accessToken) return;

    try {
      await axios.delete(
        `${MS_GRAPH_BASE}/me/onlineMeetings/${lesson.teamsMeetingId}`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
    } catch (error: any) {
      // 404 means already deleted — not an error for us
      if (error?.response?.status !== 404) {
        console.error('Error deleting Teams meeting:', error?.response?.data || error);
      }
    }

    await prisma.lesson.update({
      where: { id: lessonId },
      data: { teamsMeetingId: null, teamsMeetingUrl: null },
    });
  }

  /**
   * Get Microsoft Teams sync status for a user
   */
  async getSyncStatus(userId: string) {
    const sync = await prisma.microsoftTeamsSync.findUnique({
      where: { userId },
    });

    if (!sync || !sync.isActive) {
      return { connected: false };
    }

    return {
      connected: true,
      isActive: sync.isActive,
      email: sync.email,
      lastSyncAt: sync.lastSyncAt,
      connectedAt: sync.createdAt,
    };
  }

  /**
   * Disconnect Microsoft Teams integration for a user
   */
  async disconnect(userId: string): Promise<void> {
    const sync = await prisma.microsoftTeamsSync.findUnique({ where: { userId } });
    if (!sync) return;

    await prisma.microsoftTeamsSync.update({
      where: { userId },
      data: { isActive: false },
    });
  }
}

export default new MicrosoftTeamsService();
