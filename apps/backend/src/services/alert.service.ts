import prisma from '../utils/prisma';
import { AlertType } from '@prisma/client';

class AlertService {
  /**
   * Get all alerts for organization with pagination
   */
  async getAlerts(
    organizationId: string,
    userId?: string,
    options?: {
      page?: number;
      limit?: number;
      isRead?: boolean;
    }
  ) {
    const page = options?.page || 1;
    const limit = options?.limit || 20;
    const skip = (page - 1) * limit;

    const where: any = {
      organizationId,
      OR: [
        { userId: null }, // Alerts for all users
        { userId: userId }, // Alerts for specific user
      ],
    };

    if (options?.isRead !== undefined) {
      where.isRead = options.isRead;
    }

    const [alerts, total] = await Promise.all([
      prisma.alert.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.alert.count({ where }),
    ]);

    return {
      alerts,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get count of unread alerts
   */
  async getUnreadCount(organizationId: string, userId?: string): Promise<number> {
    return await prisma.alert.count({
      where: {
        organizationId,
        isRead: false,
        OR: [
          { userId: null }, // Alerts for all users
          { userId: userId }, // Alerts for specific user
        ],
      },
    });
  }

  /**
   * Mark alert as read
   */
  async markAsRead(alertId: string, organizationId: string) {
    const alert = await prisma.alert.findFirst({
      where: { id: alertId, organizationId },
    });

    if (!alert) {
      throw new Error('Alert not found');
    }

    return await prisma.alert.update({
      where: { id: alertId },
      data: {
        isRead: true,
        readAt: new Date(),
      },
    });
  }

  /**
   * Mark all alerts as read for a user/organization
   */
  async markAllAsRead(organizationId: string, userId?: string) {
    const where: any = {
      organizationId,
      isRead: false,
      OR: [
        { userId: null },
        { userId: userId },
      ],
    };

    return await prisma.alert.updateMany({
      where,
      data: {
        isRead: true,
        readAt: new Date(),
      },
    });
  }

  /**
   * Create a new alert
   */
  async createAlert(data: {
    organizationId: string;
    userId?: string;
    type: AlertType;
    title: string;
    message: string;
    metadata?: any;
  }) {
    return await prisma.alert.create({
      data,
    });
  }

  /**
   * Generate and save system alerts based on organization state
   * This should be run periodically (e.g., via cron job)
   */
  async generateSystemAlerts(organizationId: string) {
    const generatedAlerts = [];

    // 1. Check for unconfirmed lessons (< 24h before start)
    const upcomingUnconfirmedLessons = await prisma.lesson.findMany({
      where: {
        organizationId,
        status: 'SCHEDULED',
        scheduledAt: {
          gte: new Date(),
          lte: new Date(Date.now() + 24 * 60 * 60 * 1000),
        },
      },
    });

    if (upcomingUnconfirmedLessons.length > 0) {
      // Check if this alert already exists (avoid duplicates)
      const existingAlert = await prisma.alert.findFirst({
        where: {
          organizationId,
          metadata: { path: ['alertType'], equals: 'UNCONFIRMED_LESSONS' },
          createdAt: { gte: new Date(Date.now() - 12 * 60 * 60 * 1000) }, // Last 12h
        },
      });

      if (!existingAlert) {
        const alert = await this.createAlert({
          organizationId,
          type: 'WARNING',
          title: `Niepotwierdzone lekcje (${upcomingUnconfirmedLessons.length})`,
          message: `Masz ${upcomingUnconfirmedLessons.length} lekcji w ciągu najbliższych 24h, które nie zostały potwierdzone przez lektora.`,
          metadata: {
            alertType: 'UNCONFIRMED_LESSONS',
            count: upcomingUnconfirmedLessons.length,
            lessonIds: upcomingUnconfirmedLessons.map(l => l.id),
          },
        });
        generatedAlerts.push(alert);
      }
    }

    // 2. Check for overdue lessons
    const overdueLessons = await prisma.lesson.findMany({
      where: {
        organizationId,
        scheduledAt: {
          lt: new Date(Date.now() - 24 * 60 * 60 * 1000),
        },
        status: {
          notIn: ['COMPLETED', 'CANCELLED'],
        },
      },
    });

    if (overdueLessons.length > 0) {
      const existingAlert = await prisma.alert.findFirst({
        where: {
          organizationId,
          metadata: { path: ['alertType'], equals: 'OVERDUE_LESSONS' },
          createdAt: { gte: new Date(Date.now() - 12 * 60 * 60 * 1000) },
        },
      });

      if (!existingAlert) {
        const alert = await this.createAlert({
          organizationId,
          type: 'ERROR',
          title: `Niezamknięte lekcje (${overdueLessons.length})`,
          message: `Masz ${overdueLessons.length} przeszłych lekcji, które nie zostały oznaczone jako zakończone lub anulowane.`,
          metadata: {
            alertType: 'OVERDUE_LESSONS',
            count: overdueLessons.length,
            lessonIds: overdueLessons.map(l => l.id),
          },
        });
        generatedAlerts.push(alert);
      }
    }

    // 3. Check for students without enrollments
    const studentsWithoutEnrollments = await prisma.student.findMany({
      where: {
        organizationId,
        user: { isActive: true },
        enrollments: {
          none: {
            status: 'ACTIVE',
          },
        },
      },
      select: { id: true },
    });

    if (studentsWithoutEnrollments.length > 0) {
      const existingAlert = await prisma.alert.findFirst({
        where: {
          organizationId,
          metadata: { path: ['alertType'], equals: 'STUDENTS_WITHOUT_ENROLLMENTS' },
          createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
        },
      });

      if (!existingAlert) {
        const alert = await this.createAlert({
          organizationId,
          type: 'WARNING',
          title: `Uczniowie bez zapisów (${studentsWithoutEnrollments.length})`,
          message: `${studentsWithoutEnrollments.length} aktywnych uczniów nie ma żadnych aktywnych zapisów na kursy.`,
          metadata: {
            alertType: 'STUDENTS_WITHOUT_ENROLLMENTS',
            count: studentsWithoutEnrollments.length,
            studentIds: studentsWithoutEnrollments.map(s => s.id),
          },
        });
        generatedAlerts.push(alert);
      }
    }

    return generatedAlerts;
  }
}

export const alertService = new AlertService();
