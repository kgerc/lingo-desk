import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import notificationService from '../services/notification.service';
import { NotificationType, NotificationStatus } from '@prisma/client';

class NotificationController {
  /**
   * Get current user's notifications
   * GET /api/notifications
   */
  async getNotifications(req: AuthRequest, res: Response) {
    try {
      const userId = req.user!.id;
      const { type, status, limit } = req.query;

      const notifications = await notificationService.getUserNotifications(userId, {
        type: type as NotificationType | undefined,
        status: status as NotificationStatus | undefined,
        limit: limit ? parseInt(limit as string) : undefined,
      });

      // Map subject/body to title/message for frontend compatibility
      const mappedNotifications = notifications.map((notification: any) => ({
        ...notification,
        title: notification.subject || notification.title,
        message: notification.body || notification.message,
      }));

      res.json({
        success: true,
        data: mappedNotifications,
      });
    } catch (error) {
      console.error('Error fetching notifications:', error);
      res.status(500).json({
        success: false,
        message: 'Nie udało się pobrać powiadomień',
      });
    }
  }

  /**
   * Get unread notification count
   * GET /api/notifications/unread-count
   */
  async getUnreadCount(req: AuthRequest, res: Response) {
    try {
      const userId = req.user!.id;
      const count = await notificationService.getUnreadCount(userId);

      res.json({
        success: true,
        data: { count },
      });
    } catch (error) {
      console.error('Error fetching unread count:', error);
      res.status(500).json({
        success: false,
        message: 'Nie udało się pobrać liczby nieprzeczytanych',
      });
    }
  }

  /**
   * Mark notification as read
   * PUT /api/notifications/:id/read
   */
  async markAsRead(req: AuthRequest, res: Response) {
    try {
      const userId = req.user!.id;
      const { id } = req.params;

      const notification = await notificationService.markAsRead(id as string, userId);

      res.json({
        success: true,
        data: notification,
      });
    } catch (error) {
      console.error('Error marking notification as read:', error);
      res.status(404).json({
        success: false,
        message: error instanceof Error ? error.message : 'Nie udało się oznaczyć powiadomienia jako przeczytane',
      });
    }
  }

  /**
   * Mark all notifications as read
   * PUT /api/notifications/read-all
   */
  async markAllAsRead(req: AuthRequest, res: Response) {
    try {
      const userId = req.user!.id;
      await notificationService.markAllAsRead(userId);

      res.json({
        success: true,
        message: 'All notifications marked as read',
      });
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
      res.status(500).json({
        success: false,
        message: 'Nie udało się oznaczyć wszystkich powiadomień jako przeczytane',
      });
    }
  }
}

export default new NotificationController();
