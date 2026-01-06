import prisma from '../utils/prisma';

export class DashboardService {
  /**
   * Get dashboard statistics for an organization
   */
  async getDashboardStats(organizationId: string) {
    // Get counts in parallel for better performance
    const [
      totalStudents,
      activeStudents,
      totalTeachers,
      activeTeachers,
      totalCourses,
      activeCourses,
      lessonsToday,
      recentPayments,
      lessonsLast30Days,
    ] = await Promise.all([
      // Students count
      prisma.student.count({
        where: { organizationId },
      }),

      // Active students count
      prisma.student.count({
        where: {
          organizationId,
          user: { isActive: true },
        },
      }),

      // Teachers count
      prisma.teacher.count({
        where: { organizationId },
      }),

      // Active teachers count
      prisma.teacher.count({
        where: {
          organizationId,
          user: { isActive: true },
        },
      }),

      // Total courses count
      prisma.course.count({
        where: { organizationId },
      }),

      // Active courses count
      prisma.course.count({
        where: {
          organizationId,
          isActive: true,
        },
      }),

      // Lessons today
      this.getLessonsToday(organizationId),

      // Recent payments for revenue chart (last 30 days)
      this.getRecentPayments(organizationId, 30),

      // Lessons per day for last 30 days
      this.getLessonsPerDay(organizationId, 30),
    ]);

    // Calculate total revenue from recent payments
    const totalRevenue = recentPayments.reduce((sum, payment) => {
      return sum + parseFloat(payment.amount.toString());
    }, 0);

    return {
      students: {
        total: totalStudents,
        active: activeStudents,
      },
      teachers: {
        total: totalTeachers,
        active: activeTeachers,
      },
      courses: {
        total: totalCourses,
        active: activeCourses,
      },
      lessonsToday: lessonsToday,
      revenue: {
        total: totalRevenue,
        last30Days: recentPayments,
      },
      lessonsLast30Days,
    };
  }

  /**
   * Get number of lessons scheduled for today
   */
  private async getLessonsToday(organizationId: string): Promise<number> {
    const today = new Date();
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59);

    const count = await prisma.lesson.count({
      where: {
        organizationId,
        scheduledAt: {
          gte: startOfDay,
          lte: endOfDay,
        },
      },
    });

    return count;
  }

  /**
   * Get recent payments grouped by day
   */
  private async getRecentPayments(organizationId: string, days: number) {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    startDate.setHours(0, 0, 0, 0);

    const payments = await prisma.payment.findMany({
      where: {
        organizationId,
        createdAt: {
          gte: startDate,
        },
        status: 'COMPLETED',
      },
      select: {
        id: true,
        amount: true,
        createdAt: true,
      },
      orderBy: {
        createdAt: 'asc',
      },
    });

    // Group payments by day
    const paymentsByDay = new Map<string, number>();

    payments.forEach((payment) => {
      const date = payment.createdAt.toISOString().split('T')[0];
      const currentAmount = paymentsByDay.get(date) || 0;
      paymentsByDay.set(date, currentAmount + parseFloat(payment.amount.toString()));
    });

    // Create array with ALL days in range (including days with 0 payments)
    const chartData = [];
    for (let i = 0; i < days; i++) {
      const date = new Date(startDate);
      date.setDate(startDate.getDate() + i);
      const dateStr = date.toISOString().split('T')[0];
      chartData.push({
        date: dateStr,
        amount: paymentsByDay.get(dateStr) || 0,
      });
    }

    return chartData;
  }

  /**
   * Get lessons count per day for last N days
   */
  private async getLessonsPerDay(organizationId: string, days: number) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    startDate.setHours(0, 0, 0, 0);

    const lessons = await prisma.lesson.findMany({
      where: {
        organizationId,
        scheduledAt: {
          gte: startDate,
        },
      },
      select: {
        id: true,
        scheduledAt: true,
        status: true,
      },
      orderBy: {
        scheduledAt: 'asc',
      },
    });

    // Group lessons by day
    const lessonsByDay = new Map<string, number>();

    lessons.forEach((lesson) => {
      const date = lesson.scheduledAt.toISOString().split('T')[0];
      const currentCount = lessonsByDay.get(date) || 0;
      lessonsByDay.set(date, currentCount + 1);
    });

    // Create array with ALL days in range (including days with 0 lessons)
    const chartData = [];
    for (let i = 0; i < days; i++) {
      const date = new Date(startDate);
      date.setDate(startDate.getDate() + i);
      const dateStr = date.toISOString().split('T')[0];
      chartData.push({
        date: dateStr,
        count: lessonsByDay.get(dateStr) || 0,
      });
    }

    return chartData;
  }

  /**
   * Get teacher reminders (incomplete attendance lists, upcoming lessons, etc.)
   */
  async getTeacherReminders(organizationId: string, teacherId?: string) {
    const where: any = { organizationId };

    if (teacherId) {
      where.teacherId = teacherId;
    }

    // Find completed lessons without attendance marked (status COMPLETED but no attendance)
    const lessonsWithoutAttendance = await prisma.lesson.findMany({
      where: {
        ...where,
        status: 'COMPLETED',
        // Check if attendance is missing by looking for lessons that should have attendance
        scheduledAt: {
          lt: new Date(), // Past lessons
        },
      },
      include: {
        student: {
          include: {
            user: {
              select: {
                firstName: true,
                lastName: true,
              },
            },
          },
        },
        teacher: {
          include: {
            user: {
              select: {
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
        attendances: true,
      },
      orderBy: {
        scheduledAt: 'desc',
      },
      take: 10,
    });

    // Filter lessons that don't have attendance records
    const incompleteAttendance = lessonsWithoutAttendance.filter(
      lesson => !lesson.attendances || lesson.attendances.length === 0
    );

    return {
      incompleteAttendance: incompleteAttendance.map(lesson => ({
        id: lesson.id,
        studentName: `${lesson.student?.user.firstName} ${lesson.student?.user.lastName}`,
        teacherName: `${lesson.teacher.user.firstName} ${lesson.teacher.user.lastName}`,
        courseName: lesson.course?.name || 'N/A',
        scheduledAt: lesson.scheduledAt,
        message: 'Brak uzupełnionej listy obecności',
        type: 'ATTENDANCE_INCOMPLETE',
      })),
    };
  }
}

export default new DashboardService();
