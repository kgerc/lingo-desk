import prisma from '../utils/prisma';

export type AlertType = 'ERROR' | 'WARNING' | 'INFO' | 'SUCCESS';

export interface Alert {
  id: string;
  type: AlertType;
  title: string;
  message: string;
  createdAt: Date;
}

class AlertService {
  async getOrganizationAlerts(organizationId: string): Promise<Alert[]> {
    const alerts: Alert[] = [];

    // 1. Check for unconfirmed lessons (< 24h before start)
    const upcomingUnconfirmedLessons = await prisma.lesson.findMany({
      where: {
        organizationId,
        status: 'SCHEDULED',
        scheduledAt: {
          gte: new Date(),
          lte: new Date(Date.now() + 24 * 60 * 60 * 1000), // Next 24 hours
        },
      },
      include: {
        student: { include: { user: true } },
        teacher: { include: { user: true } },
      },
    });

    if (upcomingUnconfirmedLessons.length > 0) {
      alerts.push({
        id: 'unconfirmed-lessons',
        type: 'WARNING',
        title: `Niepotwierdzone lekcje (${upcomingUnconfirmedLessons.length})`,
        message: `Masz ${upcomingUnconfirmedLessons.length} lekcji w ciągu najbliższych 24h, które nie zostały potwierdzone przez lektora.`,
        createdAt: new Date(),
      });
    }

    // 2. Check for pending payments
    const pendingPayments = await prisma.payment.findMany({
      where: {
        organizationId,
        status: 'PENDING',
      },
    });

    if (pendingPayments.length > 0) {
      const totalPending = pendingPayments.reduce(
        (sum, p) => sum + Number(p.amount),
        0
      );
      alerts.push({
        id: 'pending-payments',
        type: 'INFO',
        title: `Oczekujące płatności (${pendingPayments.length})`,
        message: `Suma oczekujących płatności: ${totalPending.toFixed(2)} PLN`,
        createdAt: new Date(),
      });
    }

    // 3. Check for overdue lessons (not marked as COMPLETED/CANCELLED)
    const overdueLessons = await prisma.lesson.findMany({
      where: {
        organizationId,
        scheduledAt: {
          lt: new Date(Date.now() - 24 * 60 * 60 * 1000), // More than 24h ago
        },
        status: {
          notIn: ['COMPLETED', 'CANCELLED'],
        },
      },
    });

    if (overdueLessons.length > 0) {
      alerts.push({
        id: 'overdue-lessons',
        type: 'ERROR',
        title: `Niezamknięte lekcje (${overdueLessons.length})`,
        message: `Masz ${overdueLessons.length} przeszłych lekcji, które nie zostały oznaczone jako zakończone lub anulowane.`,
        createdAt: new Date(),
      });
    }

    // 4. Check for students with no active enrollments
    const studentsWithoutEnrollments = await prisma.student.count({
      where: {
        organizationId,
        user: { isActive: true },
        enrollments: {
          none: {
            status: 'ACTIVE',
          },
        },
      },
    });

    if (studentsWithoutEnrollments > 0) {
      alerts.push({
        id: 'no-enrollments',
        type: 'WARNING',
        title: `Uczniowie bez zapisów (${studentsWithoutEnrollments})`,
        message: `${studentsWithoutEnrollments} aktywnych uczniów nie ma żadnych aktywnych zapisów na kursy.`,
        createdAt: new Date(),
      });
    }

    // 5. Check for lessons tomorrow that need confirmation
    const tomorrowStart = new Date();
    tomorrowStart.setDate(tomorrowStart.getDate() + 1);
    tomorrowStart.setHours(0, 0, 0, 0);

    const tomorrowEnd = new Date(tomorrowStart);
    tomorrowEnd.setHours(23, 59, 59, 999);

    const tomorrowLessons = await prisma.lesson.count({
      where: {
        organizationId,
        scheduledAt: {
          gte: tomorrowStart,
          lte: tomorrowEnd,
        },
        status: {
          in: ['SCHEDULED', 'CONFIRMED'],
        },
      },
    });

    if (tomorrowLessons > 0) {
      alerts.push({
        id: 'tomorrow-lessons',
        type: 'SUCCESS',
        title: `Lekcje zaplanowane na jutro (${tomorrowLessons})`,
        message: `Wszystko przygotowane - masz ${tomorrowLessons} zaplanowanych lekcji na jutro.`,
        createdAt: new Date(),
      });
    }

    return alerts;
  }
}

export const alertService = new AlertService();
