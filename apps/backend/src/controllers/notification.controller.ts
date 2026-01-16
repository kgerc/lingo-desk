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
        message: 'Failed to fetch notifications',
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
        message: 'Failed to fetch unread count',
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

      const notification = await notificationService.markAsRead(id, userId);

      res.json({
        success: true,
        data: notification,
      });
    } catch (error) {
      console.error('Error marking notification as read:', error);
      res.status(404).json({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to mark notification as read',
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
        message: 'Failed to mark all notifications as read',
      });
    }
  }
}

export default new NotificationController();
