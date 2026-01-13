import { google, calendar_v3 } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import prisma from '../utils/prisma';

class GoogleCalendarService {
  private oauth2Client: OAuth2Client;

  constructor() {
    this.oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI
    );
  }

  /**
   * Get authorization URL for OAuth flow
   */
  getAuthUrl(userId: string): string {
    const scopes = [
      'https://www.googleapis.com/auth/calendar',
      'https://www.googleapis.com/auth/calendar.events',
    ];

    return this.oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: scopes,
      state: userId, // Pass userId in state to retrieve after callback
      prompt: 'consent', // Force consent screen to get refresh token
    });
  }

  /**
   * Exchange authorization code for tokens and save to database
   */
  async handleCallback(code: string, userId: string, organizationId: string) {
    try {
      // Exchange code for tokens
      const { tokens } = await this.oauth2Client.getToken(code);

      if (!tokens.access_token || !tokens.refresh_token) {
        throw new Error('Missing tokens from Google OAuth');
      }

      // Set credentials to get calendar info
      this.oauth2Client.setCredentials(tokens);
      const calendar = google.calendar({ version: 'v3', auth: this.oauth2Client });

      // Get primary calendar ID
      const calendarList = await calendar.calendarList.list();
      const primaryCalendar = calendarList.data.items?.find((cal) => cal.primary);

      if (!primaryCalendar?.id) {
        throw new Error('Could not find primary calendar');
      }

      // Save or update sync configuration
      const existingSync = await prisma.googleCalendarSync.findUnique({
        where: { userId },
      });

      const tokenExpiry = tokens.expiry_date ? new Date(tokens.expiry_date) : new Date(Date.now() + 3600 * 1000);

      if (existingSync) {
        return await prisma.googleCalendarSync.update({
          where: { userId },
          data: {
            accessToken: tokens.access_token,
            refreshToken: tokens.refresh_token,
            tokenExpiry,
            calendarId: primaryCalendar.id,
            isActive: true,
            lastSyncAt: new Date(),
          },
        });
      } else {
        return await prisma.googleCalendarSync.create({
          data: {
            userId,
            organizationId,
            accessToken: tokens.access_token,
            refreshToken: tokens.refresh_token,
            tokenExpiry,
            calendarId: primaryCalendar.id,
            isActive: true,
          },
        });
      }
    } catch (error) {
      console.error('Error handling Google Calendar callback:', error);
      throw error;
    }
  }

  /**
   * Get authenticated calendar client for a user
   */
  private async getCalendarClient(userId: string): Promise<calendar_v3.Calendar | null> {
    const sync = await prisma.googleCalendarSync.findUnique({
      where: { userId, isActive: true },
    });

    if (!sync) {
      return null;
    }

    // Check if token needs refresh
    if (sync.tokenExpiry < new Date()) {
      await this.refreshAccessToken(sync.id, sync.refreshToken);
      // Fetch updated sync
      const updatedSync = await prisma.googleCalendarSync.findUnique({
        where: { id: sync.id },
      });
      if (!updatedSync) return null;

      this.oauth2Client.setCredentials({
        access_token: updatedSync.accessToken,
        refresh_token: updatedSync.refreshToken,
      });
    } else {
      this.oauth2Client.setCredentials({
        access_token: sync.accessToken,
        refresh_token: sync.refreshToken,
      });
    }

    return google.calendar({ version: 'v3', auth: this.oauth2Client });
  }

  /**
   * Refresh access token using refresh token
   */
  private async refreshAccessToken(syncId: string, refreshToken: string) {
    try {
      this.oauth2Client.setCredentials({ refresh_token: refreshToken });
      const { credentials } = await this.oauth2Client.refreshAccessToken();

      if (!credentials.access_token) {
        throw new Error('Failed to refresh access token');
      }

      const tokenExpiry = credentials.expiry_date ? new Date(credentials.expiry_date) : new Date(Date.now() + 3600 * 1000);

      await prisma.googleCalendarSync.update({
        where: { id: syncId },
        data: {
          accessToken: credentials.access_token,
          tokenExpiry,
        },
      });
    } catch (error) {
      console.error('Error refreshing access token:', error);
      throw error;
    }
  }

  /**
   * Create Google Calendar event from lesson
   * @param lessonId - ID of the lesson to sync
   * @param syncUserId - ID of the user whose calendar to sync to (can be admin, manager, teacher, or student)
   */
  async createEventFromLesson(lessonId: string, syncUserId?: string) {
    try {
      const lesson = await prisma.lesson.findUnique({
        where: { id: lessonId },
        include: {
          teacher: { include: { user: true } },
          student: { include: { user: true } },
          course: true,
        },
      });

      if (!lesson) {
        throw new Error('Lesson not found');
      }

      // Use syncUserId if provided, otherwise fall back to teacher's user ID
      // This allows admins/managers to sync lessons to their own calendar
      const calendarOwnerId = syncUserId || lesson.teacher.user.id;

      const calendar = await this.getCalendarClient(calendarOwnerId);
      if (!calendar) {
        console.log('Google Calendar not connected for user:', calendarOwnerId);
        return null;
      }

      const sync = await prisma.googleCalendarSync.findUnique({
        where: { userId: calendarOwnerId },
      });

      if (!sync) return null;

      // Prepare event data
      const startTime = new Date(lesson.scheduledAt);
      const endTime = new Date(startTime.getTime() + lesson.durationMinutes * 60000);

      const eventData: calendar_v3.Schema$Event = {
        summary: lesson.title,
        description: `Nauczyciel: ${lesson.teacher.user.firstName} ${lesson.teacher.user.lastName}\nUczeń: ${lesson.student.user.firstName} ${lesson.student.user.lastName}\n${lesson.description || ''}`,
        start: {
          dateTime: startTime.toISOString(),
          timeZone: 'Europe/Warsaw',
        },
        end: {
          dateTime: endTime.toISOString(),
          timeZone: 'Europe/Warsaw',
        },
        attendees: [
          { email: lesson.teacher.user.email, displayName: `${lesson.teacher.user.firstName} ${lesson.teacher.user.lastName}` },
          { email: lesson.student.user.email, displayName: `${lesson.student.user.firstName} ${lesson.student.user.lastName}` },
        ],
        reminders: {
          useDefault: false,
          overrides: [
            { method: 'email', minutes: 24 * 60 },
            { method: 'popup', minutes: 30 },
          ],
        },
      };

      if (lesson.deliveryMode === 'ONLINE' && lesson.meetingUrl) {
        eventData.location = lesson.meetingUrl;
      }

      // Create event in Google Calendar
      const response = await calendar.events.insert({
        calendarId: sync.calendarId,
        requestBody: eventData,
        sendUpdates: 'all',
      });

      if (!response.data.id || !response.data.etag) {
        throw new Error('Failed to create Google Calendar event');
      }

      // Save mapping in database
      await prisma.lessonGoogleCalendarEvent.create({
        data: {
          lessonId: lesson.id,
          googleCalendarSyncId: sync.id,
          googleEventId: response.data.id,
          googleEventEtag: response.data.etag,
          lastSyncedAt: new Date(),
        },
      });

      return response.data;
    } catch (error) {
      console.error('Error creating Google Calendar event:', error);
      throw error;
    }
  }

  /**
   * Update Google Calendar event from lesson
   */
  async updateEventFromLesson(lessonId: string, syncUserId?: string) {
    try {
      const lesson = await prisma.lesson.findUnique({
        where: { id: lessonId },
        include: {
          teacher: { include: { user: true } },
          student: { include: { user: true } },
          course: true,
          googleCalendarEvent: {
            include: { googleCalendarSync: true },
          },
        },
      });

      if (!lesson) {
        console.log('Lesson not found:', lessonId);
        return null;
      }

      // If no Google Calendar event exists yet, create one instead of updating
      if (!lesson.googleCalendarEvent) {
        console.log('No Google Calendar event found for lesson, creating new event:', lessonId);
        return await this.createEventFromLesson(lessonId, syncUserId);
      }

      // Use syncUserId if provided (for admin/manager), otherwise use the calendar owner from the sync
      const calendarOwnerId = syncUserId || lesson.googleCalendarEvent.googleCalendarSync.userId;
      const calendar = await this.getCalendarClient(calendarOwnerId);
      if (!calendar) {
        console.log('Google Calendar not connected for user:', calendarOwnerId);
        return null;
      }

      const sync = lesson.googleCalendarEvent.googleCalendarSync;

      // Prepare updated event data
      const startTime = new Date(lesson.scheduledAt);
      const endTime = new Date(startTime.getTime() + lesson.durationMinutes * 60000);

      const eventData: calendar_v3.Schema$Event = {
        summary: lesson.title,
        description: `Nauczyciel: ${lesson.teacher.user.firstName} ${lesson.teacher.user.lastName}\nUczeń: ${lesson.student.user.firstName} ${lesson.student.user.lastName}\n${lesson.description || ''}`,
        start: {
          dateTime: startTime.toISOString(),
          timeZone: 'Europe/Warsaw',
        },
        end: {
          dateTime: endTime.toISOString(),
          timeZone: 'Europe/Warsaw',
        },
        attendees: [
          { email: lesson.teacher.user.email, displayName: `${lesson.teacher.user.firstName} ${lesson.teacher.user.lastName}` },
          { email: lesson.student.user.email, displayName: `${lesson.student.user.firstName} ${lesson.student.user.lastName}` },
        ],
      };

      if (lesson.deliveryMode === 'ONLINE' && lesson.meetingUrl) {
        eventData.location = lesson.meetingUrl;
      }

      // Update event in Google Calendar
      const response = await calendar.events.update({
        calendarId: sync.calendarId,
        eventId: lesson.googleCalendarEvent.googleEventId,
        requestBody: eventData,
        sendUpdates: 'all',
      });

      if (!response.data.etag) {
        throw new Error('Failed to update Google Calendar event');
      }

      // Update mapping in database
      await prisma.lessonGoogleCalendarEvent.update({
        where: { id: lesson.googleCalendarEvent.id },
        data: {
          googleEventEtag: response.data.etag,
          lastSyncedAt: new Date(),
        },
      });

      return response.data;
    } catch (error) {
      console.error('Error updating Google Calendar event:', error);
      throw error;
    }
  }

  /**
   * Delete Google Calendar event
   */
  async deleteEventFromLesson(lessonId: string) {
    try {
      const lesson = await prisma.lesson.findUnique({
        where: { id: lessonId },
        include: {
          teacher: { include: { user: true } },
          googleCalendarEvent: {
            include: { googleCalendarSync: true },
          },
        },
      });

      if (!lesson || !lesson.googleCalendarEvent) {
        console.log('No Google Calendar event found for lesson:', lessonId);
        return null;
      }

      // Use the calendar owner from the sync (who originally created the event)
      const calendarOwnerId = lesson.googleCalendarEvent.googleCalendarSync.userId;
      const calendar = await this.getCalendarClient(calendarOwnerId);
      if (!calendar) {
        console.log('Google Calendar not connected for user:', calendarOwnerId);
        return null;
      }

      const sync = lesson.googleCalendarEvent.googleCalendarSync;

      // Delete event from Google Calendar
      await calendar.events.delete({
        calendarId: sync.calendarId,
        eventId: lesson.googleCalendarEvent.googleEventId,
        sendUpdates: 'all',
      });

      // Delete mapping from database
      await prisma.lessonGoogleCalendarEvent.delete({
        where: { id: lesson.googleCalendarEvent.id },
      });

      return true;
    } catch (error) {
      console.error('Error deleting Google Calendar event:', error);
      throw error;
    }
  }

  /**
   * Disconnect Google Calendar for a user
   */
  async disconnect(userId: string) {
    try {
      await prisma.googleCalendarSync.update({
        where: { userId },
        data: { isActive: false },
      });

      return true;
    } catch (error) {
      console.error('Error disconnecting Google Calendar:', error);
      throw error;
    }
  }

  /**
   * Get sync status for a user
   */
  async getSyncStatus(userId: string) {
    const sync = await prisma.googleCalendarSync.findUnique({
      where: { userId },
      select: {
        isActive: true,
        lastSyncAt: true,
        calendarId: true,
        createdAt: true,
      },
    });

    // Return null if not active (disconnected)
    if (!sync || !sync.isActive) {
      return null;
    }

    return sync;
  }

  /**
   * Sync all existing lessons to Google Calendar (initial sync)
   * Lessons synced depend on user role:
   * - ADMIN: all lessons in currently selected organization (user.organizationId)
   * - MANAGER: all lessons in their managed schools (user_organizations)
   * - TEACHER: only their own lessons (where they are the teacher)
   * - STUDENT: their own lessons (where they are the student)
   */
  async syncAllLessonsToGoogleCalendar(userId: string) {
    try {
      // Get user with all necessary relations
      const user = await prisma.user.findUnique({
        where: { id: userId },
        include: {
          teacher: true,
          student: true,
          organizations: {
            include: {
              organization: {
                include: {
                  locations: true,
                },
              },
            },
          },
        },
      });

      if (!user) {
        throw new Error('User not found');
      }

      let lessonFilter: any = {
        status: { not: 'CANCELLED' },
        googleCalendarEvent: null, // Don't sync already synced lessons
      };

      // Build filter based on user role
      switch (user.role) {
        case 'ADMIN':
          // All lessons in the currently selected organization
          lessonFilter.organizationId = user.organizationId;
          console.log(`Syncing all lessons for ADMIN in organization ${user.organizationId}`);
          break;

        case 'MANAGER':
          // All lessons in the currently selected organization
          lessonFilter.organizationId = user.organizationId;
          console.log(`Syncing all lessons for MANAGER in organization ${user.organizationId}`);
          break;

        case 'TEACHER':
          // Only lessons where user is the teacher
          if (!user.teacher) {
            console.log(`User ${userId} is TEACHER but has no teacher profile`);
            return { total: 0, synced: 0, failed: 0 };
          }
          lessonFilter.teacherId = user.teacher.id;
          console.log(`Syncing lessons for TEACHER ${user.teacher.id}`);
          break;

        case 'STUDENT':
          // Only lessons where user is the student
          if (!user.student) {
            console.log(`User ${userId} is STUDENT but has no student profile`);
            return { total: 0, synced: 0, failed: 0 };
          }
          lessonFilter.studentId = user.student.id;
          console.log(`Syncing lessons for STUDENT ${user.student.id}`);
          break;

        default:
          console.log(`User ${userId} has role ${user.role}, no lessons to sync`);
          return { total: 0, synced: 0, failed: 0 };
      }

      // Get all lessons matching the filter
      const lessons = await prisma.lesson.findMany({
        where: lessonFilter,
        orderBy: {
          scheduledAt: 'asc',
        },
      });

      console.log(`Found ${lessons.length} lessons to sync for user ${userId} (${user.role})`);

      let synced = 0;
      let failed = 0;

      for (const lesson of lessons) {
        try {
          await this.createEventFromLesson(lesson.id, userId);
          synced++;
        } catch (error) {
          console.error(`Failed to sync lesson ${lesson.id}:`, error);
          failed++;
        }
      }

      return {
        total: lessons.length,
        synced,
        failed,
      };
    } catch (error) {
      console.error('Error syncing all lessons:', error);
      throw error;
    }
  }

  /**
   * Setup watch for calendar changes (webhook)
   */
  async setupWatch(userId: string) {
    try {
      const sync = await prisma.googleCalendarSync.findUnique({
        where: { userId },
      });

      if (!sync || !sync.isActive) {
        throw new Error('Google Calendar not connected');
      }

      const calendar = await this.getCalendarClient(userId);

      if (!calendar) {
        throw new Error('Failed to get calendar client');
      }

      // Generate unique channel ID
      const channelId = `lingo-desk-${userId}-${Date.now()}`;
      const webhookUrl = `${process.env.BACKEND_URL}/api/google-calendar/webhook`;

      // Setup watch (expires after 7 days max)
      const response = await calendar.events.watch({
        calendarId: sync.calendarId,
        requestBody: {
          id: channelId,
          type: 'web_hook',
          address: webhookUrl,
        },
      });

      // Save watch details
      await prisma.googleCalendarSync.update({
        where: { id: sync.id },
        data: {
          watchChannelId: channelId,
          watchResourceId: response.data.resourceId,
          watchExpiration: response.data.expiration
            ? new Date(parseInt(response.data.expiration))
            : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
        },
      });

      return response.data;
    } catch (error) {
      console.error('Error setting up watch:', error);
      throw error;
    }
  }

  /**
   * Stop watch for calendar changes
   */
  async stopWatch(userId: string) {
    try {
      const sync = await prisma.googleCalendarSync.findUnique({
        where: { userId },
      });

      if (!sync || !sync.watchChannelId || !sync.watchResourceId) {
        return;
      }

      const calendar = await this.getCalendarClient(userId);

      if (!calendar) {
        throw new Error('Failed to get calendar client');
      }

      await calendar.channels.stop({
        requestBody: {
          id: sync.watchChannelId,
          resourceId: sync.watchResourceId,
        },
      });

      // Clear watch details
      await prisma.googleCalendarSync.update({
        where: { id: sync.id },
        data: {
          watchChannelId: null,
          watchResourceId: null,
          watchExpiration: null,
        },
      });
    } catch (error) {
      console.error('Error stopping watch:', error);
      throw error;
    }
  }

  /**
   * Handle webhook notification from Google Calendar
   */
  async handleWebhook(channelId: string, resourceId: string) {
    try {
      // Find sync by channel ID
      const sync = await prisma.googleCalendarSync.findFirst({
        where: {
          watchChannelId: channelId,
          watchResourceId: resourceId,
          isActive: true,
        },
        include: {
          user: true,
        },
      });

      if (!sync) {
        console.log('Sync not found for webhook notification');
        return;
      }

      // Perform incremental sync
      await this.syncFromGoogleCalendar(sync.userId);
    } catch (error) {
      console.error('Error handling webhook:', error);
      throw error;
    }
  }

  /**
   * Sync changes from Google Calendar to app
   */
  async syncFromGoogleCalendar(userId: string) {
    try {
      const sync = await prisma.googleCalendarSync.findUnique({
        where: { userId },
      });

      if (!sync || !sync.isActive) {
        return;
      }

      const calendar = await this.getCalendarClient(userId);

      if (!calendar) {
        throw new Error('Failed to get calendar client');
      }

      // Use syncToken for incremental sync if available
      const params: any = {
        calendarId: sync.calendarId,
        maxResults: 100,
      };

      if (sync.syncToken) {
        params.syncToken = sync.syncToken;
      } else {
        // First sync - get events from last 30 days
        const timeMin = new Date();
        timeMin.setDate(timeMin.getDate() - 30);
        params.timeMin = timeMin.toISOString();
      }

      const response = await calendar.events.list(params);

      if (response.data.items) {
        for (const event of response.data.items) {
          await this.processGoogleCalendarEvent(userId, event);
        }
      }

      // Update sync token for next incremental sync
      if (response.data.nextSyncToken) {
        await prisma.googleCalendarSync.update({
          where: { id: sync.id },
          data: {
            syncToken: response.data.nextSyncToken,
            lastSyncAt: new Date(),
          },
        });
      }
    } catch (error) {
      console.error('Error syncing from Google Calendar:', error);
      throw error;
    }
  }

  /**
   * Process a single Google Calendar event
   */
  private async processGoogleCalendarEvent(userId: string, event: calendar_v3.Schema$Event) {
    try {
      if (!event.id) return;

      // Find if this event is already mapped to a lesson
      const mapping = await prisma.lessonGoogleCalendarEvent.findFirst({
        where: {
          googleEventId: event.id,
          googleCalendarSync: {
            userId,
          },
        },
        include: {
          lesson: true,
        },
      });

      if (!mapping) {
        // Event not created by our app - ignore for now
        // TODO: Could implement creating lessons from external GC events
        return;
      }

      // Check if event was deleted
      if (event.status === 'cancelled') {
        // Delete lesson or mark as cancelled
        await prisma.lesson.update({
          where: { id: mapping.lessonId },
          data: {
            status: 'CANCELLED',
            cancelledAt: new Date(),
            cancellationReason: 'Cancelled in Google Calendar',
          },
        });
        return;
      }

      // Update lesson with changes from Google Calendar
      const updateData: any = {};

      if (event.summary !== mapping.lesson.title) {
        updateData.title = event.summary || mapping.lesson.title;
      }

      if (event.description !== mapping.lesson.description) {
        updateData.description = event.description;
      }

      if (event.start?.dateTime) {
        const newStartTime = new Date(event.start.dateTime);
        if (newStartTime.getTime() !== mapping.lesson.scheduledAt.getTime()) {
          updateData.scheduledAt = newStartTime;
        }
      }

      if (event.start?.dateTime && event.end?.dateTime) {
        const start = new Date(event.start.dateTime);
        const end = new Date(event.end.dateTime);
        const durationMinutes = Math.round((end.getTime() - start.getTime()) / 60000);
        if (durationMinutes !== mapping.lesson.durationMinutes) {
          updateData.durationMinutes = durationMinutes;
        }
      }

      // Only update if there are changes
      if (Object.keys(updateData).length > 0) {
        await prisma.lesson.update({
          where: { id: mapping.lessonId },
          data: updateData,
        });

        // Update etag in mapping
        if (event.etag) {
          await prisma.lessonGoogleCalendarEvent.update({
            where: { id: mapping.id },
            data: {
              googleEventEtag: event.etag,
              lastSyncedAt: new Date(),
            },
          });
        }
      }
    } catch (error) {
      console.error('Error processing Google Calendar event:', error);
      // Don't throw - continue processing other events
    }
  }

  /**
   * Import external (non-lesson) events from Google Calendar
   */
  async importExternalEvents(userId: string): Promise<{ total: number; imported: number; failed: number }> {
    const sync = await prisma.googleCalendarSync.findUnique({
      where: { userId },
    });

    if (!sync || !sync.isActive) {
      throw new Error('Google Calendar not connected');
    }

    const calendar = await this.getCalendarClient(userId);

    if (!calendar) {
      throw new Error('Failed to get calendar client');
    }

    // Get events from the last 3 months to 6 months in the future
    const timeMin = new Date();
    timeMin.setMonth(timeMin.getMonth() - 3);
    const timeMax = new Date();
    timeMax.setMonth(timeMax.getMonth() + 6);

    try {
      const response = await calendar.events.list({
        calendarId: sync.calendarId,
        timeMin: timeMin.toISOString(),
        timeMax: timeMax.toISOString(),
        singleEvents: true,
        orderBy: 'startTime',
        maxResults: 250,
      });

      const events = response.data.items || [];

      // Get existing lesson event IDs to exclude them
      const lessonEvents = await prisma.lessonGoogleCalendarEvent.findMany({
        where: { googleCalendarSyncId: sync.id },
        select: { googleEventId: true },
      });
      const lessonEventIds = new Set(lessonEvents.map(le => le.googleEventId));

      let imported = 0;
      let failed = 0;

      for (const event of events) {
        try {
          // Skip if this is a lesson event
          if (!event.id || lessonEventIds.has(event.id)) {
            continue;
          }

          // Skip if no start time
          if (!event.start?.dateTime && !event.start?.date) {
            continue;
          }

          const isAllDay = !!event.start.date;
          const startTime = event.start.dateTime ? new Date(event.start.dateTime) : new Date(event.start.date!);
          const endTime = event.end?.dateTime ? new Date(event.end.dateTime) :
                         event.end?.date ? new Date(event.end.date) :
                         new Date(startTime.getTime() + 60 * 60 * 1000); // Default 1 hour

          // Upsert external event
          await prisma.externalCalendarEvent.upsert({
            where: {
              googleEventId_googleCalendarSyncId: {
                googleEventId: event.id,
                googleCalendarSyncId: sync.id,
              },
            },
            create: {
              googleCalendarSyncId: sync.id,
              googleEventId: event.id,
              title: event.summary || '(Brak tytułu)',
              description: event.description || null,
              startTime,
              endTime,
              location: event.location || null,
              isAllDay,
              googleEventEtag: event.etag || null,
              lastSyncedAt: new Date(),
            },
            update: {
              title: event.summary || '(Brak tytułu)',
              description: event.description || null,
              startTime,
              endTime,
              location: event.location || null,
              isAllDay,
              googleEventEtag: event.etag || null,
              lastSyncedAt: new Date(),
            },
          });

          imported++;
        } catch (error) {
          console.error('Error importing external event:', event.id, error);
          failed++;
        }
      }

      return { total: events.length - lessonEventIds.size, imported, failed };
    } catch (error) {
      console.error('Error fetching external events from Google Calendar:', error);
      throw error;
    }
  }

  /**
   * Get external calendar events for a user within a date range
   */
  async getExternalEvents(userId: string, startDate?: Date, endDate?: Date) {
    const sync = await prisma.googleCalendarSync.findUnique({
      where: { userId },
    });

    if (!sync || !sync.isActive) {
      return [];
    }

    const whereClause: any = {
      googleCalendarSyncId: sync.id,
    };

    if (startDate || endDate) {
      whereClause.startTime = {};
      if (startDate) whereClause.startTime.gte = startDate;
      if (endDate) whereClause.startTime.lte = endDate;
    }

    const events = await prisma.externalCalendarEvent.findMany({
      where: whereClause,
      orderBy: { startTime: 'asc' },
    });

    return events;
  }
}

export default new GoogleCalendarService();
