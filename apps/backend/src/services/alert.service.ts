import prisma from '../utils/prisma';
import { AlertType, AlertPriority, UserRole } from '@prisma/client';

const priorityOrder: Record<AlertPriority, number> = {
  CRITICAL: 0,
  HIGH: 1,
  NORMAL: 2,
};

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
      priority?: AlertPriority;
      userRole?: UserRole;
    }
  ) {
    const page = options?.page || 1;
    const limit = options?.limit || 20;
    const skip = (page - 1) * limit;

    // STUDENT and TEACHER see only their own alerts (userId match only, no org-wide)
    const isRestrictedRole = options?.userRole === UserRole.STUDENT || options?.userRole === UserRole.TEACHER;

    const where: any = {
      organizationId,
      ...(isRestrictedRole
        ? { userId } // Only personal alerts
        : {
            OR: [
              { userId: null }, // Alerts for all users in org
              { userId: userId }, // Alerts for specific user
            ],
          }),
    };

    if (options?.isRead !== undefined) {
      where.isRead = options.isRead;
    }

    if (options?.priority !== undefined) {
      where.priority = options.priority;
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

    // Sort: CRITICAL → HIGH → NORMAL, then by date desc
    alerts.sort((a, b) => {
      const diff = priorityOrder[a.priority] - priorityOrder[b.priority];
      return diff !== 0 ? diff : new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

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
  async getUnreadCount(organizationId: string, userId?: string, userRole?: UserRole): Promise<number> {
    const isRestrictedRole = userRole === UserRole.STUDENT || userRole === UserRole.TEACHER;

    return await prisma.alert.count({
      where: {
        organizationId,
        isRead: false,
        ...(isRestrictedRole
          ? { userId }
          : {
              OR: [
                { userId: null },
                { userId: userId },
              ],
            }),
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
  async markAllAsRead(organizationId: string, userId?: string, userRole?: UserRole) {
    const isRestrictedRole = userRole === UserRole.STUDENT || userRole === UserRole.TEACHER;

    const where: any = {
      organizationId,
      isRead: false,
      ...(isRestrictedRole
        ? { userId }
        : {
            OR: [
              { userId: null },
              { userId: userId },
            ],
          }),
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
    priority?: AlertPriority;
    title: string;
    message: string;
    metadata?: any;
  }) {
    return await prisma.alert.create({
      data: {
        ...data,
        priority: data.priority ?? AlertPriority.NORMAL,
      },
    });
  }

  /**
   * Create a lesson-related alert for a specific user (teacher or student)
   */
  async createLessonAlert(params: {
    userId: string;
    organizationId: string;
    priority: AlertPriority;
    type: AlertType;
    title: string;
    message: string;
    metadata?: any;
  }) {
    return await prisma.alert.create({
      data: params,
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
      include: {
        teacher: {
          include: {
            user: { select: { firstName: true, lastName: true } },
          },
        },
        student: {
          include: {
            user: { select: { firstName: true, lastName: true } },
          },
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
          priority: AlertPriority.HIGH,
          title: `Niepotwierdzone lekcje (${upcomingUnconfirmedLessons.length})`,
          message: `Masz ${upcomingUnconfirmedLessons.length} lekcji w ciągu najbliższych 24h, które nie zostały potwierdzone przez lektora.`,
          metadata: {
            alertType: 'UNCONFIRMED_LESSONS',
            count: upcomingUnconfirmedLessons.length,
            lessonIds: upcomingUnconfirmedLessons.map(l => l.id),
            lessons: upcomingUnconfirmedLessons.map(l => ({
              id: l.id,
              title: l.title,
              scheduledAt: l.scheduledAt.toISOString(),
              teacherName: `${l.teacher.user.firstName} ${l.teacher.user.lastName}`,
              studentName: `${l.student.user.firstName} ${l.student.user.lastName}`,
            })),
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
      include: {
        teacher: {
          include: {
            user: { select: { firstName: true, lastName: true } },
          },
        },
        student: {
          include: {
            user: { select: { firstName: true, lastName: true } },
          },
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
          priority: AlertPriority.CRITICAL,
          title: `Niezamknięte lekcje (${overdueLessons.length})`,
          message: `Masz ${overdueLessons.length} przeszłych lekcji, które nie zostały oznaczone jako zakończone lub anulowane.`,
          metadata: {
            alertType: 'OVERDUE_LESSONS',
            count: overdueLessons.length,
            lessonIds: overdueLessons.map(l => l.id),
            lessons: overdueLessons.map(l => ({
              id: l.id,
              title: l.title,
              scheduledAt: l.scheduledAt.toISOString(),
              teacherName: `${l.teacher.user.firstName} ${l.teacher.user.lastName}`,
              studentName: `${l.student.user.firstName} ${l.student.user.lastName}`,
            })),
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
      include: {
        user: { select: { firstName: true, lastName: true } },
      },
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
          priority: AlertPriority.NORMAL,
          title: `Uczniowie bez zaplanowanego grafiku (${studentsWithoutEnrollments.length})`,
          message: `${studentsWithoutEnrollments.length} aktywnych uczniów nie ma żadnych aktywnych zapisów na kursy.`,
          metadata: {
            alertType: 'STUDENTS_WITHOUT_ENROLLMENTS',
            count: studentsWithoutEnrollments.length,
            studentIds: studentsWithoutEnrollments.map(s => s.id),
            students: studentsWithoutEnrollments.map(s => ({
              id: s.id,
              name: `${s.user.firstName} ${s.user.lastName}`,
            })),
          },
        });
        generatedAlerts.push(alert);
      }
    }

    return generatedAlerts;
  }
}

export const alertService = new AlertService();
export default alertService;
