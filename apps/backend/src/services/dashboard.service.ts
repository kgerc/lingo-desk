import prisma from '../utils/prisma';

export type DateRangeType = 'last30days' | 'month' | 'year';

export interface ChartDataParams {
  organizationId: string;
  rangeType: DateRangeType;
  year?: number;
  month?: number; // 1-12
}

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
      debtorsData,
      pendingPaymentsData,
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

      // Debtors count and total amount
      this.getDebtorsStats(organizationId),

      // Pending payments count and total amount
      this.getPendingPaymentsStats(organizationId),
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
      debtors: debtorsData,
      pendingPayments: pendingPaymentsData,
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
   * Get debtors statistics - students with overdue payments
   * A debtor is a student who has a PENDING payment with dueAt in the past
   */
  private async getDebtorsStats(organizationId: string) {
    const now = new Date();

    // Get all overdue payments grouped by student
    const overduePayments = await prisma.payment.findMany({
      where: {
        organizationId,
        status: 'PENDING',
        dueAt: {
          lt: now,
        },
      },
      select: {
        studentId: true,
        amount: true,
      },
    });

    // Count unique debtors and total overdue amount
    const debtorIds = new Set<string>();
    let totalAmount = 0;

    overduePayments.forEach((payment) => {
      debtorIds.add(payment.studentId);
      totalAmount += parseFloat(payment.amount.toString());
    });

    return {
      count: debtorIds.size,
      totalAmount: totalAmount,
    };
  }

  /**
   * Get pending payments statistics - all payments awaiting payment
   */
  private async getPendingPaymentsStats(organizationId: string) {
    const pendingPayments = await prisma.payment.aggregate({
      where: {
        organizationId,
        status: 'PENDING',
      },
      _count: {
        id: true,
      },
      _sum: {
        amount: true,
      },
    });

    return {
      count: pendingPayments._count.id || 0,
      totalAmount: parseFloat(pendingPayments._sum.amount?.toString() || '0'),
    };
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

  /**
   * Get chart data with flexible date range and grouping
   */
  async getChartData(params: ChartDataParams) {
    const { organizationId, rangeType, year, month } = params;
    const { startDate, endDate, groupBy } = this.getDateRangeAndGrouping(rangeType, year, month);

    const [revenueData, lessonsData] = await Promise.all([
      this.getRevenueChartData(organizationId, startDate, endDate, groupBy),
      this.getLessonsChartData(organizationId, startDate, endDate, groupBy),
    ]);

    // Calculate totals
    const totalRevenue = revenueData.reduce((sum, item) => sum + item.amount, 0);
    const totalLessons = lessonsData.reduce((sum, item) => sum + item.count, 0);

    return {
      rangeType,
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      groupBy,
      revenue: {
        data: revenueData,
        total: totalRevenue,
      },
      lessons: {
        data: lessonsData,
        total: totalLessons,
      },
    };
  }

  /**
   * Calculate date range and grouping based on range type
   */
  private getDateRangeAndGrouping(
    rangeType: DateRangeType,
    year?: number,
    month?: number
  ): { startDate: Date; endDate: Date; groupBy: 'day' | 'month' } {
    const now = new Date();

    switch (rangeType) {
      case 'month': {
        // Specific month - group by day
        const y = year || now.getFullYear();
        const m = (month || now.getMonth() + 1) - 1; // month is 1-12, convert to 0-11
        const startDate = new Date(y, m, 1, 0, 0, 0, 0);
        const endDate = new Date(y, m + 1, 0, 23, 59, 59, 999); // Last day of month
        return { startDate, endDate, groupBy: 'day' };
      }

      case 'year': {
        // Full year - group by month
        const y = year || now.getFullYear();
        const startDate = new Date(y, 0, 1, 0, 0, 0, 0);
        const endDate = new Date(y, 11, 31, 23, 59, 59, 999);
        return { startDate, endDate, groupBy: 'month' };
      }

      case 'last30days':
      default: {
        // Last 30 days - group by day
        const endDate = new Date();
        endDate.setHours(23, 59, 59, 999);
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - 29);
        startDate.setHours(0, 0, 0, 0);
        return { startDate, endDate, groupBy: 'day' };
      }
    }
  }

  /**
   * Get revenue chart data with flexible grouping
   */
  private async getRevenueChartData(
    organizationId: string,
    startDate: Date,
    endDate: Date,
    groupBy: 'day' | 'month'
  ) {
    const payments = await prisma.payment.findMany({
      where: {
        organizationId,
        createdAt: {
          gte: startDate,
          lte: endDate,
        },
        status: 'COMPLETED',
      },
      select: {
        amount: true,
        createdAt: true,
      },
      orderBy: {
        createdAt: 'asc',
      },
    });

    // Group payments
    const groupedData = new Map<string, number>();

    payments.forEach((payment) => {
      const key = groupBy === 'day'
        ? payment.createdAt.toISOString().split('T')[0]
        : `${payment.createdAt.getFullYear()}-${String(payment.createdAt.getMonth() + 1).padStart(2, '0')}`;
      const currentAmount = groupedData.get(key) || 0;
      groupedData.set(key, currentAmount + parseFloat(payment.amount.toString()));
    });

    // Create array with all periods in range
    const chartData: Array<{ date: string; label: string; amount: number }> = [];

    if (groupBy === 'day') {
      const current = new Date(startDate);
      while (current <= endDate) {
        const dateStr = current.toISOString().split('T')[0];
        chartData.push({
          date: dateStr,
          label: current.toLocaleDateString('pl-PL', { month: 'short', day: 'numeric' }),
          amount: groupedData.get(dateStr) || 0,
        });
        current.setDate(current.getDate() + 1);
      }
    } else {
      // Group by month
      const startYear = startDate.getFullYear();
      const startMonth = startDate.getMonth();
      const endYear = endDate.getFullYear();
      const endMonth = endDate.getMonth();

      for (let y = startYear; y <= endYear; y++) {
        const monthStart = y === startYear ? startMonth : 0;
        const monthEnd = y === endYear ? endMonth : 11;
        for (let m = monthStart; m <= monthEnd; m++) {
          const key = `${y}-${String(m + 1).padStart(2, '0')}`;
          const date = new Date(y, m, 1);
          chartData.push({
            date: key,
            label: date.toLocaleDateString('pl-PL', { month: 'short', year: '2-digit' }),
            amount: groupedData.get(key) || 0,
          });
        }
      }
    }

    return chartData;
  }

  /**
   * Get lessons chart data with flexible grouping
   */
  private async getLessonsChartData(
    organizationId: string,
    startDate: Date,
    endDate: Date,
    groupBy: 'day' | 'month'
  ) {
    const lessons = await prisma.lesson.findMany({
      where: {
        organizationId,
        scheduledAt: {
          gte: startDate,
          lte: endDate,
        },
      },
      select: {
        scheduledAt: true,
      },
      orderBy: {
        scheduledAt: 'asc',
      },
    });

    // Group lessons
    const groupedData = new Map<string, number>();

    lessons.forEach((lesson) => {
      const key = groupBy === 'day'
        ? lesson.scheduledAt.toISOString().split('T')[0]
        : `${lesson.scheduledAt.getFullYear()}-${String(lesson.scheduledAt.getMonth() + 1).padStart(2, '0')}`;
      const currentCount = groupedData.get(key) || 0;
      groupedData.set(key, currentCount + 1);
    });

    // Create array with all periods in range
    const chartData: Array<{ date: string; label: string; count: number }> = [];

    if (groupBy === 'day') {
      const current = new Date(startDate);
      while (current <= endDate) {
        const dateStr = current.toISOString().split('T')[0];
        chartData.push({
          date: dateStr,
          label: current.toLocaleDateString('pl-PL', { month: 'short', day: 'numeric' }),
          count: groupedData.get(dateStr) || 0,
        });
        current.setDate(current.getDate() + 1);
      }
    } else {
      // Group by month
      const startYear = startDate.getFullYear();
      const startMonth = startDate.getMonth();
      const endYear = endDate.getFullYear();
      const endMonth = endDate.getMonth();

      for (let y = startYear; y <= endYear; y++) {
        const monthStart = y === startYear ? startMonth : 0;
        const monthEnd = y === endYear ? endMonth : 11;
        for (let m = monthStart; m <= monthEnd; m++) {
          const key = `${y}-${String(m + 1).padStart(2, '0')}`;
          const date = new Date(y, m, 1);
          chartData.push({
            date: key,
            label: date.toLocaleDateString('pl-PL', { month: 'short', year: '2-digit' }),
            count: groupedData.get(key) || 0,
          });
        }
      }
    }

    return chartData;
  }
}

export default new DashboardService();
