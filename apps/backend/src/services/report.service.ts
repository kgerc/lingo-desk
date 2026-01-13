import prisma from '../utils/prisma';

interface ReportFilters {
  startDate?: Date;
  endDate?: Date;
  teacherId?: string;
  courseTypeId?: string;
  organizationId: string;
}

interface TeacherPayoutData {
  teacherId: string;
  teacherName: string;
  email: string;
  contractType: string;
  hourlyRate: number;
  lessonsCount: number;
  totalHours: number;
  totalPayout: number;
  payoutStatus?: string;
}

interface NewStudentData {
  studentId: string;
  studentNumber: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  enrollmentDate: Date;
  languageLevel: string | null;
  goals: string | null;
  enrollmentsCount: number;
  totalSpent: number;
}

interface MarginData {
  courseTypeId: string;
  courseTypeName: string;
  language: string;
  level: string;
  format: string;
  paymentsCount: number;
  totalRevenue: number;
  lessonsCount: number;
  totalTeacherCost: number;
  grossProfit: number;
  marginPercent: number;
}

interface DebtorData {
  studentId: string;
  studentName: string;
  email: string;
  phone: string | null;
  totalDebt: number;
  oldestPaymentDate: Date;
  daysOverdue: number;
  pendingPaymentsCount: number;
}

interface RetentionData {
  totalStudents: number;
  activeStudents: number;
  churnedStudents: number;
  atRiskStudents: number;
  retentionRate: number;
  churnRate: number;
  activeStudentsList: Array<{
    studentId: string;
    studentName: string;
    lastLessonDate: Date;
    totalLessons: number;
  }>;
  churnedStudentsList: Array<{
    studentId: string;
    studentName: string;
    lastLessonDate: Date | null;
    daysSinceLastLesson: number | null;
    totalLessons: number;
  }>;
  atRiskStudentsList: Array<{
    studentId: string;
    studentName: string;
    lastLessonDate: Date;
    daysSinceLastLesson: number;
    totalLessons: number;
  }>;
}

class ReportService {
  /**
   * Generate teacher payouts report
   */
  async generateTeacherPayoutsReport(filters: ReportFilters): Promise<TeacherPayoutData[]> {
    const { organizationId, startDate, endDate, teacherId } = filters;

    const whereClause: any = {
      organizationId,
    };

    if (teacherId) {
      whereClause.id = teacherId;
    }

    const teachers = await prisma.teacher.findMany({
      where: whereClause,
      include: {
        user: {
          select: {
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        lessons: {
          where: {
            status: 'COMPLETED',
            ...(startDate && endDate
              ? {
                  scheduledAt: {
                    gte: startDate,
                    lte: endDate,
                  },
                }
              : {}),
          },
          select: {
            id: true,
            durationMinutes: true,
            teacherRate: true,
          },
        },
      },
    });

    const result: TeacherPayoutData[] = teachers.map((teacher) => {
      const lessonsCount = teacher.lessons.length;
      const totalMinutes = teacher.lessons.reduce((sum, lesson) => sum + lesson.durationMinutes, 0);
      const totalHours = totalMinutes / 60;
      const totalPayout = teacher.lessons.reduce((sum, lesson) => sum + (lesson.teacherRate || 0), 0);

      return {
        teacherId: teacher.id,
        teacherName: `${teacher.user.firstName} ${teacher.user.lastName}`,
        email: teacher.user.email,
        contractType: teacher.contractType,
        hourlyRate: Number(teacher.hourlyRate),
        lessonsCount,
        totalHours: Math.round(totalHours * 100) / 100,
        totalPayout: Math.round(totalPayout * 100) / 100,
        payoutStatus: 'PENDING', // Default status, can be enhanced with TeacherPayout table
      };
    });

    return result;
  }

  /**
   * Generate new students report for a specific month
   */
  async generateNewStudentsReport(
    organizationId: string,
    month: number,
    year: number
  ): Promise<NewStudentData[]> {
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59);

    const students = await prisma.student.findMany({
      where: {
        organizationId,
        enrollmentDate: {
          gte: startDate,
          lte: endDate,
        },
      },
      include: {
        user: {
          select: {
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
          },
        },
        enrollments: {
          select: {
            id: true,
          },
        },
        payments: {
          where: {
            status: 'COMPLETED',
          },
          select: {
            amount: true,
          },
        },
      },
      orderBy: {
        enrollmentDate: 'desc',
      },
    });

    const result: NewStudentData[] = students.map((student) => {
      const totalSpent = student.payments.reduce((sum, payment) => sum + Number(payment.amount), 0);

      return {
        studentId: student.id,
        studentNumber: student.studentNumber,
        firstName: student.user.firstName,
        lastName: student.user.lastName,
        email: student.user.email,
        phone: student.user.phone,
        enrollmentDate: student.enrollmentDate,
        languageLevel: student.languageLevel,
        goals: student.goals,
        enrollmentsCount: student.enrollments.length,
        totalSpent: Math.round(totalSpent * 100) / 100,
      };
    });

    return result;
  }

  /**
   * Generate margins report
   */
  async generateMarginsReport(filters: ReportFilters): Promise<MarginData[]> {
    const { organizationId, startDate, endDate, courseTypeId } = filters;

    const whereClause: any = {
      organizationId,
    };

    if (courseTypeId) {
      whereClause.id = courseTypeId;
    }

    const courseTypes = await prisma.courseType.findMany({
      where: whereClause,
      include: {
        courses: {
          include: {
            lessons: {
              where: {
                status: 'COMPLETED',
                ...(startDate && endDate
                  ? {
                      scheduledAt: {
                        gte: startDate,
                        lte: endDate,
                      },
                    }
                  : {}),
              },
              select: {
                id: true,
                teacherRate: true,
              },
            },
            enrollments: {
              include: {
                payments: {
                  where: {
                    status: 'COMPLETED',
                    ...(startDate && endDate
                      ? {
                          createdAt: {
                            gte: startDate,
                            lte: endDate,
                          },
                        }
                      : {}),
                  },
                  select: {
                    amount: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    const result: MarginData[] = courseTypes.map((courseType) => {
      const lessonsCount = courseType.courses.reduce((sum, course) => sum + course.lessons.length, 0);
      const totalTeacherCost = courseType.courses.reduce(
        (sum, course) =>
          sum +
          course.lessons.reduce((lessonSum, lesson) => lessonSum + Number(lesson.teacherRate || 0), 0),
        0
      );

      const paymentsCount = courseType.courses.reduce(
        (sum, course) =>
          sum + course.enrollments.reduce((enrollSum, enroll) => enrollSum + enroll.payments.length, 0),
        0
      );

      const totalRevenue = courseType.courses.reduce(
        (sum, course) =>
          sum +
          course.enrollments.reduce(
            (enrollSum, enroll) =>
              enrollSum + enroll.payments.reduce((paySum, pay) => paySum + Number(pay.amount), 0),
            0
          ),
        0
      );

      const grossProfit = totalRevenue - totalTeacherCost;
      const marginPercent = totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0;

      return {
        courseTypeId: courseType.id,
        courseTypeName: courseType.name,
        language: courseType.language,
        level: courseType.level,
        format: courseType.format,
        paymentsCount,
        totalRevenue: Math.round(totalRevenue * 100) / 100,
        lessonsCount,
        totalTeacherCost: Math.round(totalTeacherCost * 100) / 100,
        grossProfit: Math.round(grossProfit * 100) / 100,
        marginPercent: Math.round(marginPercent * 100) / 100,
      };
    });

    return result.filter((r) => r.lessonsCount > 0 || r.paymentsCount > 0);
  }

  /**
   * Generate debtors report (enhanced version of existing getDebtors)
   */
  async generateDebtorsReport(
    organizationId: string,
    minAmount?: number,
    daysPastDue?: number
  ): Promise<DebtorData[]> {
    const now = new Date();

    const pendingPayments = await prisma.payment.findMany({
      where: {
        organizationId,
        status: 'PENDING',
        OR: [{ dueAt: { lte: now } }, { dueAt: null }],
      },
      include: {
        student: {
          include: {
            user: {
              select: {
                firstName: true,
                lastName: true,
                email: true,
                phone: true,
              },
            },
          },
        },
      },
      orderBy: {
        dueAt: 'asc',
      },
    });

    // Group by student
    const debtorMap = new Map<string, DebtorData>();

    for (const payment of pendingPayments) {
      const studentId = payment.studentId;
      const existing = debtorMap.get(studentId);

      const daysOverdue = payment.dueAt
        ? Math.floor((now.getTime() - payment.dueAt.getTime()) / (1000 * 60 * 60 * 24))
        : 0;

      if (existing) {
        existing.totalDebt += Number(payment.amount);
        existing.pendingPaymentsCount += 1;
        if (payment.dueAt && payment.dueAt < existing.oldestPaymentDate) {
          existing.oldestPaymentDate = payment.dueAt;
          existing.daysOverdue = daysOverdue;
        }
      } else {
        debtorMap.set(studentId, {
          studentId: payment.student.id,
          studentName: `${payment.student.user.firstName} ${payment.student.user.lastName}`,
          email: payment.student.user.email,
          phone: payment.student.user.phone,
          totalDebt: Number(payment.amount),
          oldestPaymentDate: payment.dueAt || payment.createdAt,
          daysOverdue,
          pendingPaymentsCount: 1,
        });
      }
    }

    let result = Array.from(debtorMap.values());

    // Apply filters
    if (minAmount) {
      result = result.filter((d) => d.totalDebt >= minAmount);
    }

    if (daysPastDue) {
      result = result.filter((d) => d.daysOverdue >= daysPastDue);
    }

    // Sort by total debt descending
    result.sort((a, b) => b.totalDebt - a.totalDebt);

    return result;
  }

  /**
   * Generate retention and churn report
   */
  async generateRetentionReport(
    organizationId: string,
    periodDays: number = 30
  ): Promise<RetentionData> {
    const now = new Date();
    const activeCutoff = new Date(now.getTime() - periodDays * 24 * 60 * 60 * 1000);
    const churnCutoff = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000); // 60 days
    const atRiskStart = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);
    const atRiskEnd = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    // Get all students with their lessons
    const students = await prisma.student.findMany({
      where: {
        organizationId,
      },
      include: {
        user: {
          select: {
            firstName: true,
            lastName: true,
          },
        },
        lessons: {
          where: {
            status: { in: ['COMPLETED', 'CONFIRMED'] },
          },
          select: {
            id: true,
            scheduledAt: true,
          },
          orderBy: {
            scheduledAt: 'desc',
          },
        },
      },
    });

    const activeStudentsList: RetentionData['activeStudentsList'] = [];
    const churnedStudentsList: RetentionData['churnedStudentsList'] = [];
    const atRiskStudentsList: RetentionData['atRiskStudentsList'] = [];

    for (const student of students) {
      const totalLessons = student.lessons.length;
      const lastLesson = student.lessons[0];
      const lastLessonDate = lastLesson?.scheduledAt || null;

      if (!lastLessonDate) {
        // No lessons ever - considered churned
        churnedStudentsList.push({
          studentId: student.id,
          studentName: `${student.user.firstName} ${student.user.lastName}`,
          lastLessonDate: null,
          daysSinceLastLesson: null,
          totalLessons: 0,
        });
        continue;
      }

      const daysSinceLastLesson = Math.floor(
        (now.getTime() - lastLessonDate.getTime()) / (1000 * 60 * 60 * 24)
      );

      if (lastLessonDate >= activeCutoff) {
        // Active student
        activeStudentsList.push({
          studentId: student.id,
          studentName: `${student.user.firstName} ${student.user.lastName}`,
          lastLessonDate,
          totalLessons,
        });
      } else if (lastLessonDate < churnCutoff) {
        // Churned student
        churnedStudentsList.push({
          studentId: student.id,
          studentName: `${student.user.firstName} ${student.user.lastName}`,
          lastLessonDate,
          daysSinceLastLesson,
          totalLessons,
        });
      } else {
        // At risk student (30-60 days)
        atRiskStudentsList.push({
          studentId: student.id,
          studentName: `${student.user.firstName} ${student.user.lastName}`,
          lastLessonDate,
          daysSinceLastLesson,
          totalLessons,
        });
      }
    }

    const totalStudents = students.length;
    const activeStudents = activeStudentsList.length;
    const churnedStudents = churnedStudentsList.length;
    const atRiskStudents = atRiskStudentsList.length;

    const retentionRate = totalStudents > 0 ? (activeStudents / totalStudents) * 100 : 0;
    const churnRate = totalStudents > 0 ? (churnedStudents / totalStudents) * 100 : 0;

    return {
      totalStudents,
      activeStudents,
      churnedStudents,
      atRiskStudents,
      retentionRate: Math.round(retentionRate * 100) / 100,
      churnRate: Math.round(churnRate * 100) / 100,
      activeStudentsList,
      churnedStudentsList,
      atRiskStudentsList,
    };
  }
}

export default new ReportService();
