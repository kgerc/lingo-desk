import { PrismaClient, NotificationType, NotificationStatus } from '@prisma/client';
import emailService from './email.service';

const prisma = new PrismaClient();

export interface CreateNotificationData {
  organizationId: string;
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  relatedEntityType?: string;
  relatedEntityId?: string;
  sendEmail?: boolean;
  scheduledFor?: Date;
}

class NotificationService {
  /**
   * Create a new notification
   */
  async createNotification(data: CreateNotificationData) {
    const notification = await prisma.notification.create({
      data: {
        organizationId: data.organizationId,
        userId: data.userId,
        type: data.type,
        title: data.title,
        message: data.message,
        relatedEntityType: data.relatedEntityType,
        relatedEntityId: data.relatedEntityId,
        status: NotificationStatus.PENDING,
        scheduledFor: data.scheduledFor || new Date(),
      },
    });

    // Send email if requested
    if (data.sendEmail) {
      await this.sendNotificationEmail(notification.id);
    }

    return notification;
  }

  /**
   * Send notification email
   */
  async sendNotificationEmail(notificationId: string) {
    const notification = await prisma.notification.findUnique({
      where: { id: notificationId },
      include: {
        user: {
          select: {
            email: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    if (!notification || !notification.user.email) {
      throw new Error('Notification or user email not found');
    }

    // Send email
    const result = await emailService.sendEmail({
      to: notification.user.email,
      subject: notification.title,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #2d4a65;">${notification.title}</h2>
          <p>Dzień dobry ${notification.user.firstName},</p>
          <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
            ${notification.message}
          </div>
          <p style="color: #6b7280; font-size: 12px; margin-top: 30px;">LingoDesk - System zarządzania szkołą językową</p>
        </div>
      `,
    });

    // Update notification status
    await prisma.notification.update({
      where: { id: notificationId },
      data: {
        status: result.success ? NotificationStatus.SENT : NotificationStatus.FAILED,
        sentAt: result.success ? new Date() : null,
      },
    });

    return result;
  }

  /**
   * Get user notifications
   */
  async getUserNotifications(userId: string, filters?: {
    type?: NotificationType;
    status?: NotificationStatus;
    limit?: number;
  }) {
    const { type, status, limit = 50 } = filters || {};

    const notifications = await prisma.notification.findMany({
      where: {
        userId,
        ...(type && { type }),
        ...(status && { status }),
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: limit,
    });

    return notifications;
  }

  /**
   * Mark notification as read
   */
  async markAsRead(notificationId: string, userId: string) {
    const notification = await prisma.notification.findFirst({
      where: {
        id: notificationId,
        userId,
      },
    });

    if (!notification) {
      throw new Error('Notification not found');
    }

    return await prisma.notification.update({
      where: { id: notificationId },
      data: {
        readAt: new Date(),
      },
    });
  }

  /**
   * Mark all notifications as read
   */
  async markAllAsRead(userId: string) {
    await prisma.notification.updateMany({
      where: {
        userId,
        readAt: null,
      },
      data: {
        readAt: new Date(),
      },
    });
  }

  /**
   * Get unread notification count
   */
  async getUnreadCount(userId: string): Promise<number> {
    return await prisma.notification.count({
      where: {
        userId,
        readAt: null,
      },
    });
  }

  /**
   * Delete old notifications (older than 90 days)
   */
  async cleanupOldNotifications(organizationId: string) {
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

    const result = await prisma.notification.deleteMany({
      where: {
        organizationId,
        createdAt: {
          lt: ninetyDaysAgo,
        },
      },
    });

    return result;
  }

  /**
   * Send lesson reminder notifications (24h before)
   */
  async sendLessonReminders() {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);

    const dayAfterTomorrow = new Date(tomorrow);
    dayAfterTomorrow.setDate(dayAfterTomorrow.getDate() + 1);

    // Get lessons scheduled for tomorrow that haven't been reminded
    const lessons = await prisma.lesson.findMany({
      where: {
        scheduledAt: {
          gte: tomorrow,
          lt: dayAfterTomorrow,
        },
        status: {
          in: ['SCHEDULED', 'CONFIRMED'],
        },
      },
      include: {
        teacher: {
          include: {
            user: {
              select: {
                email: true,
                firstName: true,
                lastName: true,
              },
            },
          },
        },
        student: {
          include: {
            user: {
              select: {
                email: true,
                firstName: true,
                lastName: true,
              },
            },
          },
        },
      },
    });

    console.log(`📬 Sending reminders for ${lessons.length} lessons tomorrow...`);

    const results = [];

    for (const lesson of lessons) {
      try {
        // Send email reminders
        const emailResult = await emailService.sendLessonReminder({
          teacherEmail: lesson.teacher.user.email,
          teacherName: `${lesson.teacher.user.firstName} ${lesson.teacher.user.lastName}`,
          studentEmail: lesson.student.user.email,
          studentName: `${lesson.student.user.firstName} ${lesson.student.user.lastName}`,
          lessonTitle: lesson.title,
          lessonDate: lesson.scheduledAt,
          lessonDuration: lesson.durationMinutes,
          deliveryMode: lesson.deliveryMode,
          meetingUrl: lesson.meetingUrl || undefined,
        });

        // Create in-app notifications
        await this.createNotification({
          organizationId: lesson.organizationId,
          userId: lesson.teacher.user.id,
          type: NotificationType.EMAIL,
          title: 'Przypomnienie o zajęciach',
          message: `Zajęcia z ${lesson.student.user.firstName} ${lesson.student.user.lastName} jutro o ${lesson.scheduledAt.toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' })}`,
          relatedEntityType: 'Lesson',
          relatedEntityId: lesson.id,
        });

        await this.createNotification({
          organizationId: lesson.organizationId,
          userId: lesson.student.user.id,
          type: NotificationType.EMAIL,
          title: 'Przypomnienie o zajęciach',
          message: `Zajęcia z ${lesson.teacher.user.firstName} ${lesson.teacher.user.lastName} jutro o ${lesson.scheduledAt.toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' })}`,
          relatedEntityType: 'Lesson',
          relatedEntityId: lesson.id,
        });

        results.push({ lessonId: lesson.id, success: true, emailResult });
      } catch (error) {
        console.error(`Error sending reminder for lesson ${lesson.id}:`, error);
        results.push({ lessonId: lesson.id, success: false, error });
      }
    }

    return results;
  }

  /**
   * Send low budget alerts
   */
  async sendLowBudgetAlerts(organizationId: string, managerEmail?: string) {
    // Get enrollments with low budget
    const enrollments = await prisma.studentEnrollment.findMany({
      where: {
        course: { organizationId },
        status: 'ACTIVE',
      },
      include: {
        student: {
          include: {
            user: {
              select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
              },
            },
          },
        },
        course: {
          select: {
            name: true,
          },
        },
      },
    });

    const lowBudgetEnrollments = enrollments.filter((enrollment) => {
      const hoursPurchased = parseFloat(enrollment.hoursPurchased.toString());
      const hoursUsed = parseFloat(enrollment.hoursUsed.toString());
      const hoursRemaining = hoursPurchased - hoursUsed;
      return hoursRemaining <= 2 && hoursRemaining > 0;
    });

    console.log(`📬 Sending budget alerts for ${lowBudgetEnrollments.length} students...`);

    const results = [];

    for (const enrollment of lowBudgetEnrollments) {
      try {
        const hoursRemaining = parseFloat(enrollment.hoursPurchased.toString()) - parseFloat(enrollment.hoursUsed.toString());

        // Send email alert
        const emailResult = await emailService.sendLowBudgetAlert({
          studentEmail: enrollment.student.user.email,
          studentName: `${enrollment.student.user.firstName} ${enrollment.student.user.lastName}`,
          courseName: enrollment.course?.name || 'N/A',
          hoursRemaining,
          managerEmail,
        });

        // Create in-app notification
        await this.createNotification({
          organizationId,
          userId: enrollment.student.user.id,
          type: NotificationType.EMAIL,
          title: '⚠️ Niski stan konta',
          message: `Pozostało tylko ${hoursRemaining.toFixed(1)}h na kursie ${enrollment.course?.name}. Prosimy o kontakt w celu doładowania konta.`,
          relatedEntityType: 'StudentEnrollment',
          relatedEntityId: enrollment.id,
        });

        results.push({ enrollmentId: enrollment.id, success: true, emailResult });
      } catch (error) {
        console.error(`Error sending budget alert for enrollment ${enrollment.id}:`, error);
        results.push({ enrollmentId: enrollment.id, success: false, error });
      }
    }

    return results;
  }
}

export default new NotificationService();
