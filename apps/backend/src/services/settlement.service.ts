import { LessonStatus, PaymentStatus } from '@prisma/client';
import prisma from '../utils/prisma';

export interface SettlementPreview {
  studentId: string;
  studentName: string;
  periodStart: Date;
  periodEnd: Date;
  // Charges (lessons, payments due)
  totalPaymentsDue: number;
  paymentsBreakdown: Array<{
    id: string;
    amount: number;
    currency: string;
    description: string;
    date: Date;
    status: string;
  }>;
  // Deposits (completed payments from student)
  totalPaymentsReceived: number;
  depositsBreakdown: Array<{
    id: string;
    amount: number;
    currency: string;
    paymentMethod: string;
    date: Date;
  }>;
  // Balance calculations
  balanceBefore: number;
  periodBalance: number; // totalPaymentsReceived - totalPaymentsDue
  balanceAfter: number;
  currency: string;
}

export interface BalanceForecastLesson {
  id: string;
  title: string;
  scheduledAt: Date;
  pricePerLesson: number;
  currency: string;
  balanceAfter: number; // running balance after this lesson is charged
}

export interface BalanceForecast {
  currentBalance: number;
  currency: string;
  upcomingLessonsCount: number;
  lessonsUntilDepletion: number | null; // null = balance never runs out
  depletionDate: Date | null;           // null = balance never runs out
  forecastedBalance: number;            // balance after all upcoming lessons
  upcomingLessons: BalanceForecastLesson[];
}

export interface CreateSettlementData {
  organizationId: string;
  studentId: string;
  periodStart: Date;
  periodEnd: Date;
  notes?: string;
}

class SettlementService {
  /**
   * Get student's last settlement date
   * If no previous settlement, returns student's enrollment date
   */
  async getLastSettlementDate(studentId: string, organizationId: string): Promise<Date | null> {
    const budget = await prisma.studentBudget.findFirst({
      where: {
        studentId,
        organizationId,
      },
      select: {
        lastSettlementDate: true,
      },
    });

    if (budget?.lastSettlementDate) {
      return budget.lastSettlementDate;
    }

    // If no settlement, check for first payment date
    const firstPayment = await prisma.payment.findFirst({
      where: {
        studentId,
        organizationId,
      },
      orderBy: {
        createdAt: 'asc',
      },
      select: {
        createdAt: true,
      },
    });

    return firstPayment?.createdAt || null;
  }

  /**
   * Get student's current balance from budget
   */
  async getCurrentBalance(studentId: string, organizationId: string): Promise<number> {
    const budget = await prisma.studentBudget.findFirst({
      where: {
        studentId,
        organizationId,
      },
      select: {
        currentBalance: true,
      },
    });

    return budget ? Number(budget.currentBalance) : 0;
  }

  /**
   * Preview settlement for a student in a given period
   * Does not save anything, just calculates
   */
  async previewSettlement(
    studentId: string,
    organizationId: string,
    periodStart: Date,
    periodEnd: Date
  ): Promise<SettlementPreview> {
    // Get student info
    const student = await prisma.student.findFirst({
      where: {
        id: studentId,
        organizationId,
      },
      include: {
        user: {
          select: {
            firstName: true,
            lastName: true,
          },
        },
        budget: true,
      },
    });

    if (!student) {
      throw new Error('Student not found');
    }

    // Get organization currency
    const organization = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: { currency: true },
    });

    const currency = organization?.currency || 'PLN';

    // Get all PENDING payments (charges) in the period
    // These are payments due from student for lessons
    const pendingPayments = await prisma.payment.findMany({
      where: {
        studentId,
        organizationId,
        status: PaymentStatus.PENDING,
        createdAt: {
          gte: periodStart,
          lte: periodEnd,
        },
      },
      include: {
        lesson: {
          select: {
            title: true,
            scheduledAt: true,
          },
        },
        enrollment: {
          include: {
            course: {
              select: {
                name: true,
              },
            },
          },
        },
      },
      orderBy: {
        createdAt: 'asc',
      },
    });

    // Get all COMPLETED payments (deposits) in the period
    // These are actual payments received from student
    const completedPayments = await prisma.payment.findMany({
      where: {
        studentId,
        organizationId,
        status: PaymentStatus.COMPLETED,
        paidAt: {
          gte: periodStart,
          lte: periodEnd,
        },
      },
      orderBy: {
        paidAt: 'asc',
      },
    });

    // Calculate totals
    const totalPaymentsDue = pendingPayments.reduce(
      (sum, p) => sum + Number(p.amount),
      0
    );

    const totalPaymentsReceived = completedPayments.reduce(
      (sum, p) => sum + Number(p.amount),
      0
    );

    // Get balance before period
    const balanceBefore = student.budget ? Number(student.budget.currentBalance) : 0;

    // Period balance = what student paid - what student owes
    const periodBalance = totalPaymentsReceived - totalPaymentsDue;

    // Balance after = balance before + period balance
    const balanceAfter = balanceBefore + periodBalance;

    // Build breakdown
    const paymentsBreakdown = pendingPayments.map((p) => ({
      id: p.id,
      amount: Number(p.amount),
      currency: p.currency,
      description: p.lesson?.title || p.enrollment?.course?.name || 'Płatność',
      date: p.createdAt,
      status: p.status,
    }));

    const depositsBreakdown = completedPayments.map((p) => ({
      id: p.id,
      amount: Number(p.amount),
      currency: p.currency,
      paymentMethod: p.paymentMethod,
      date: p.paidAt || p.createdAt,
    }));

    return {
      studentId,
      studentName: `${student.user.firstName} ${student.user.lastName}`,
      periodStart,
      periodEnd,
      totalPaymentsDue,
      paymentsBreakdown,
      totalPaymentsReceived,
      depositsBreakdown,
      balanceBefore,
      periodBalance,
      balanceAfter,
      currency,
    };
  }

  /**
   * Create and save a settlement
   * This also updates the student's budget balance and marks payments as settled
   */
  async createSettlement(data: CreateSettlementData) {
    const { organizationId, studentId, periodStart, periodEnd, notes } = data;

    // Get preview first
    const preview = await this.previewSettlement(
      studentId,
      organizationId,
      periodStart,
      periodEnd
    );

    // Create settlement in transaction
    const settlement = await prisma.$transaction(async (tx) => {
      // Ensure budget exists
      let budget = await tx.studentBudget.findFirst({
        where: {
          studentId,
          organizationId,
        },
      });

      if (!budget) {
        budget = await tx.studentBudget.create({
          data: {
            studentId,
            organizationId,
          },
        });
      }

      // Create settlement record
      const newSettlement = await tx.studentSettlement.create({
        data: {
          organizationId,
          studentId,
          budgetId: budget.id,
          periodStart,
          periodEnd,
          totalPaymentsDue: preview.totalPaymentsDue,
          totalPaymentsReceived: preview.totalPaymentsReceived,
          balanceBefore: preview.balanceBefore,
          balanceAfter: preview.balanceAfter,
          currency: preview.currency,
          notes,
        },
      });

      // Update budget with new balance and settlement date
      await tx.studentBudget.update({
        where: { id: budget.id },
        data: {
          currentBalance: preview.balanceAfter,
          lastSettlementDate: periodEnd,
        },
      });

      return newSettlement;
    });

    return {
      settlement,
      preview,
    };
  }

  /**
   * Get all settlements for a student
   */
  async getStudentSettlements(studentId: string, organizationId: string) {
    const settlements = await prisma.studentSettlement.findMany({
      where: {
        studentId,
        organizationId,
      },
      orderBy: {
        periodEnd: 'desc',
      },
    });

    return settlements;
  }

  /**
   * Get settlement by ID
   */
  async getSettlementById(id: string, organizationId: string) {
    const settlement = await prisma.studentSettlement.findFirst({
      where: {
        id,
        organizationId,
      },
      include: {
        student: {
          include: {
            user: {
              select: {
                firstName: true,
                lastName: true,
                email: true,
              },
            },
          },
        },
      },
    });

    if (!settlement) {
      throw new Error('Settlement not found');
    }

    return settlement;
  }

  /**
   * Get all students with their current balance for settlement overview
   */
  async getStudentsWithBalance(organizationId: string) {
    const students = await prisma.student.findMany({
      where: {
        organizationId,
        user: { isActive: true },
      },
      include: {
        user: {
          select: {
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        budget: {
          select: {
            currentBalance: true,
            lastSettlementDate: true,
          },
        },
      },
      orderBy: {
        user: {
          lastName: 'asc',
        },
      },
    });

    // Get pending payments count for each student
    const studentsWithPendingCounts = await Promise.all(
      students.map(async (student) => {
        const pendingCount = await prisma.payment.count({
          where: {
            studentId: student.id,
            organizationId,
            status: PaymentStatus.PENDING,
          },
        });

        const pendingSum = await prisma.payment.aggregate({
          where: {
            studentId: student.id,
            organizationId,
            status: PaymentStatus.PENDING,
          },
          _sum: {
            amount: true,
          },
        });

        return {
          id: student.id,
          firstName: student.user.firstName,
          lastName: student.user.lastName,
          email: student.user.email,
          currentBalance: student.budget ? Number(student.budget.currentBalance) : 0,
          lastSettlementDate: student.budget?.lastSettlementDate || null,
          pendingPaymentsCount: pendingCount,
          pendingPaymentsSum: pendingSum._sum.amount ? Number(pendingSum._sum.amount) : 0,
        };
      })
    );

    return studentsWithPendingCounts;
  }

  /**
   * Forecast when the student's balance will run out based on upcoming lessons
   */
  async getBalanceForecast(studentId: string, organizationId: string): Promise<BalanceForecast> {
    const now = new Date();

    // Get current balance
    const budget = await prisma.studentBudget.findFirst({
      where: { studentId, organizationId },
      select: { currentBalance: true, currency: true },
    });

    const currentBalance = budget ? Number(budget.currentBalance) : 0;
    const currency = budget?.currency || 'PLN';

    // Get upcoming lessons (SCHEDULED or CONFIRMED, not CANCELLED/COMPLETED)
    // Include teacherRate and enrollment→course to resolve pricePerLesson when not set directly on lesson
    const upcomingLessons = await prisma.lesson.findMany({
      where: {
        studentId,
        organizationId,
        scheduledAt: { gte: now },
        status: { in: [LessonStatus.SCHEDULED, LessonStatus.CONFIRMED] },
      },
      select: {
        id: true,
        title: true,
        scheduledAt: true,
        pricePerLesson: true,
        teacherRate: true,
        currency: true,
        enrollment: {
          select: {
            course: {
              select: { pricePerLesson: true },
            },
          },
        },
      },
      orderBy: { scheduledAt: 'asc' },
    });

    // Simulate balance depletion across upcoming lessons
    let runningBalance = currentBalance;
    let lessonsUntilDepletion: number | null = null;
    let depletionDate: Date | null = null;

    const forecastLessons: BalanceForecastLesson[] = upcomingLessons.map((lesson, index) => {
      // Resolve price: lesson.pricePerLesson → lesson.teacherRate → course.pricePerLesson → 0
      // (mirrors the same fallback chain used in lesson.service.ts when creating payments)
      const price =
        lesson.pricePerLesson !== null && lesson.pricePerLesson !== undefined
          ? Number(lesson.pricePerLesson)
          : lesson.teacherRate !== null && lesson.teacherRate !== undefined
            ? Number(lesson.teacherRate)
            : lesson.enrollment?.course?.pricePerLesson !== null && lesson.enrollment?.course?.pricePerLesson !== undefined
              ? Number(lesson.enrollment.course.pricePerLesson)
              : 0;

      runningBalance -= price;

      if (depletionDate === null && runningBalance < 0) {
        lessonsUntilDepletion = index; // lessons before this one were fine
        depletionDate = lesson.scheduledAt;
      }

      return {
        id: lesson.id,
        title: lesson.title,
        scheduledAt: lesson.scheduledAt,
        pricePerLesson: price,
        currency: lesson.currency,
        balanceAfter: runningBalance,
      };
    });

    return {
      currentBalance,
      currency,
      upcomingLessonsCount: upcomingLessons.length,
      lessonsUntilDepletion,
      depletionDate,
      forecastedBalance: runningBalance,
      upcomingLessons: forecastLessons,
    };
  }

  /**
   * Delete a settlement (only the most recent one can be deleted)
   */
  async deleteSettlement(id: string, organizationId: string) {
    const settlement = await this.getSettlementById(id, organizationId);

    // Check if this is the most recent settlement for this student
    const mostRecent = await prisma.studentSettlement.findFirst({
      where: {
        studentId: settlement.studentId,
        organizationId,
      },
      orderBy: {
        periodEnd: 'desc',
      },
    });

    if (mostRecent?.id !== id) {
      throw new Error('Only the most recent settlement can be deleted');
    }

    // Delete and revert balance
    await prisma.$transaction(async (tx) => {
      // Revert the budget balance
      await tx.studentBudget.updateMany({
        where: {
          studentId: settlement.studentId,
          organizationId,
        },
        data: {
          currentBalance: settlement.balanceBefore,
          lastSettlementDate: null, // Will be recalculated
        },
      });

      // Find previous settlement to restore lastSettlementDate
      const previousSettlement = await tx.studentSettlement.findFirst({
        where: {
          studentId: settlement.studentId,
          organizationId,
          id: { not: id },
        },
        orderBy: {
          periodEnd: 'desc',
        },
      });

      if (previousSettlement) {
        await tx.studentBudget.updateMany({
          where: {
            studentId: settlement.studentId,
            organizationId,
          },
          data: {
            lastSettlementDate: previousSettlement.periodEnd,
          },
        });
      }

      // Delete the settlement
      await tx.studentSettlement.delete({
        where: { id },
      });
    });
  }
}

export default new SettlementService();
