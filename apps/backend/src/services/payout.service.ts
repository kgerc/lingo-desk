import { LessonStatus, TeacherPayoutStatus } from '@prisma/client';
import prisma from '../utils/prisma';

// Cancellation time limit in hours - if cancelled later than this before lesson, payout still applies
const LATE_CANCELLATION_LIMIT_HOURS = 24;

export type QualificationReason = 'COMPLETED' | 'CONFIRMED' | 'LATE_CANCELLATION';

export interface QualifiedLesson {
  id: string;
  title: string;
  scheduledAt: Date;
  durationMinutes: number;
  status: LessonStatus;
  cancelledAt: Date | null;
  studentName: string;
  hourlyRate: number;
  amount: number;
  currency: string;
  qualificationReason: QualificationReason;
  payoutPercent: number; // 100 = full payout, e.g. 80 = 80% of rate (for late cancellations)
}

export interface PayoutPreview {
  teacherId: string;
  teacherName: string;
  periodStart: Date;
  periodEnd: Date;
  qualifiedLessons: QualifiedLesson[];
  totalHours: number;
  totalAmount: number;
  currency: string;
}

export interface CreatePayoutData {
  organizationId: string;
  teacherId: string;
  periodStart: Date;
  periodEnd: Date;
  notes?: string;
}

export interface PayoutFilters {
  teacherId?: string;
  status?: TeacherPayoutStatus;
  periodStart?: Date;
  periodEnd?: Date;
}

class PayoutService {
  /**
   * Check if a lesson qualifies for payout
   * Qualification rules:
   * 1. Lesson is COMPLETED
   * 2. Lesson is CONFIRMED
   * 3. Lesson was CANCELLED but cancelled within the configured hours threshold before scheduled time
   *    - If teacher has cancellationPayoutEnabled: use teacher's cancellationPayoutHours threshold + cancellationPayoutPercent
   *    - Otherwise (backward compat): use LATE_CANCELLATION_LIMIT_HOURS constant at 100%
   */
  private isLessonQualified(
    lesson: {
      status: LessonStatus;
      scheduledAt: Date;
      cancelledAt: Date | null;
    },
    teacherCancellationSettings: {
      cancellationPayoutEnabled: boolean;
      cancellationPayoutHours: number | null;
      cancellationPayoutPercent: number | null;
    }
  ): { qualified: boolean; reason: QualificationReason | null; payoutPercent: number } {
    if (lesson.status === LessonStatus.COMPLETED) {
      return { qualified: true, reason: 'COMPLETED', payoutPercent: 100 };
    }

    if (lesson.status === LessonStatus.CONFIRMED) {
      return { qualified: true, reason: 'CONFIRMED', payoutPercent: 100 };
    }

    if (lesson.status === LessonStatus.CANCELLED && lesson.cancelledAt) {
      const scheduledTime = new Date(lesson.scheduledAt).getTime();
      const cancelledTime = new Date(lesson.cancelledAt).getTime();
      const hoursBeforeLesson = (scheduledTime - cancelledTime) / (1000 * 60 * 60);

      if (teacherCancellationSettings.cancellationPayoutEnabled) {
        // Use teacher-configured threshold and percent
        const threshold = teacherCancellationSettings.cancellationPayoutHours ?? LATE_CANCELLATION_LIMIT_HOURS;
        const percent = teacherCancellationSettings.cancellationPayoutPercent ?? 100;
        if (hoursBeforeLesson < threshold) {
          return { qualified: true, reason: 'LATE_CANCELLATION', payoutPercent: percent };
        }
      } else {
        // Backward compat: use hardcoded 24h limit at 100%
        if (hoursBeforeLesson < LATE_CANCELLATION_LIMIT_HOURS) {
          return { qualified: true, reason: 'LATE_CANCELLATION', payoutPercent: 100 };
        }
      }
    }

    return { qualified: false, reason: null, payoutPercent: 100 };
  }

  /**
   * Calculate payout amount for a lesson
   */
  private calculateLessonAmount(durationMinutes: number, hourlyRate: number, multiplier = 1.0): number {
    return (durationMinutes / 60) * hourlyRate * multiplier;
  }

  /**
   * Get all qualified lessons for a teacher in a period
   */
  async getQualifiedLessons(
    teacherId: string,
    organizationId: string,
    periodStart: Date,
    periodEnd: Date
  ): Promise<QualifiedLesson[]> {
    // Get teacher's hourly rate
    const teacher = await prisma.teacher.findFirst({
      where: {
        id: teacherId,
        organizationId,
      },
      include: {
        user: {
          select: {
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    if (!teacher) {
      throw new Error('Teacher not found');
    }

    const hourlyRate = Number(teacher.hourlyRate);
    const teacherCancellationSettings = {
      cancellationPayoutEnabled: teacher.cancellationPayoutEnabled,
      cancellationPayoutHours: teacher.cancellationPayoutHours,
      cancellationPayoutPercent: teacher.cancellationPayoutPercent,
    };

    // Get all lessons in the period for this teacher
    const lessons = await prisma.lesson.findMany({
      where: {
        teacherId,
        organizationId,
        scheduledAt: {
          gte: periodStart,
          lte: periodEnd,
        },
        status: {
          in: [LessonStatus.COMPLETED, LessonStatus.CONFIRMED, LessonStatus.CANCELLED],
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
      },
      orderBy: {
        scheduledAt: 'asc',
      },
    });

    // Filter and map qualified lessons
    const qualifiedLessons: QualifiedLesson[] = [];

    for (const lesson of lessons) {
      const { qualified, reason, payoutPercent } = this.isLessonQualified(lesson, teacherCancellationSettings);

      if (qualified && reason) {
        // Check if lesson is already in a payout
        const existingPayoutLesson = await prisma.teacherPayoutLesson.findFirst({
          where: {
            lessonId: lesson.id,
          },
        });

        if (!existingPayoutLesson) {
          const multiplier = payoutPercent / 100;
          const amount = this.calculateLessonAmount(lesson.durationMinutes, hourlyRate, multiplier);

          qualifiedLessons.push({
            id: lesson.id,
            title: lesson.title,
            scheduledAt: lesson.scheduledAt,
            durationMinutes: lesson.durationMinutes,
            status: lesson.status,
            cancelledAt: lesson.cancelledAt,
            studentName: `${lesson.student.user.firstName} ${lesson.student.user.lastName}`,
            hourlyRate,
            amount,
            currency: lesson.currency,
            qualificationReason: reason,
            payoutPercent,
          });
        }
      }
    }

    return qualifiedLessons;
  }

  /**
   * Preview payout for a teacher in a given period
   */
  async previewPayout(
    teacherId: string,
    organizationId: string,
    periodStart: Date,
    periodEnd: Date
  ): Promise<PayoutPreview> {
    // Get teacher info
    const teacher = await prisma.teacher.findFirst({
      where: {
        id: teacherId,
        organizationId,
      },
      include: {
        user: {
          select: {
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    if (!teacher) {
      throw new Error('Teacher not found');
    }

    // Get organization currency
    const organization = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: { currency: true },
    });

    const currency = organization?.currency || 'PLN';

    // Get qualified lessons
    const qualifiedLessons = await this.getQualifiedLessons(
      teacherId,
      organizationId,
      periodStart,
      periodEnd
    );

    // Calculate totals
    const totalMinutes = qualifiedLessons.reduce((sum, l) => sum + l.durationMinutes, 0);
    const totalHours = totalMinutes / 60;
    const totalAmount = qualifiedLessons.reduce((sum, l) => sum + l.amount, 0);

    return {
      teacherId,
      teacherName: `${teacher.user.firstName} ${teacher.user.lastName}`,
      periodStart,
      periodEnd,
      qualifiedLessons,
      totalHours,
      totalAmount,
      currency,
    };
  }

  /**
   * Create and save a payout
   */
  async createPayout(data: CreatePayoutData) {
    const { organizationId, teacherId, periodStart, periodEnd, notes } = data;

    // Get preview first
    const preview = await this.previewPayout(teacherId, organizationId, periodStart, periodEnd);

    if (preview.qualifiedLessons.length === 0) {
      throw new Error('No qualified lessons for payout in this period');
    }

    // Create payout in transaction
    const payout = await prisma.$transaction(async (tx) => {
      // Create payout record
      const newPayout = await tx.teacherPayout.create({
        data: {
          organizationId,
          teacherId,
          periodStart,
          periodEnd,
          totalHours: preview.totalHours,
          totalAmount: preview.totalAmount,
          currency: preview.currency,
          status: TeacherPayoutStatus.PENDING,
          notes,
        },
      });

      // Create payout lessons
      for (const lesson of preview.qualifiedLessons) {
        await tx.teacherPayoutLesson.create({
          data: {
            payoutId: newPayout.id,
            lessonId: lesson.id,
            lessonDate: lesson.scheduledAt,
            durationMinutes: lesson.durationMinutes,
            hourlyRate: lesson.hourlyRate,
            amount: lesson.amount,
            currency: lesson.currency,
            qualificationReason: lesson.qualificationReason,
            payoutPercent: lesson.payoutPercent === 100 ? null : lesson.payoutPercent,
            studentName: lesson.studentName,
            lessonTitle: lesson.title,
          },
        });
      }

      return newPayout;
    });

    return {
      payout,
      preview,
    };
  }

  /**
   * Get payout by ID
   */
  async getPayoutById(id: string, organizationId: string) {
    const payout = await prisma.teacherPayout.findFirst({
      where: {
        id,
        organizationId,
      },
      include: {
        teacher: {
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
        lessons: {
          orderBy: {
            lessonDate: 'asc',
          },
        },
      },
    });

    if (!payout) {
      throw new Error('Payout not found');
    }

    return payout;
  }

  /**
   * Get all payouts for organization with filters
   */
  async getPayouts(organizationId: string, filters: PayoutFilters = {}) {
    const where: any = {
      organizationId,
    };

    if (filters.teacherId) {
      where.teacherId = filters.teacherId;
    }

    if (filters.status) {
      where.status = filters.status;
    }

    if (filters.periodStart || filters.periodEnd) {
      where.periodStart = {};
      where.periodEnd = {};

      if (filters.periodStart) {
        where.periodStart.gte = filters.periodStart;
      }

      if (filters.periodEnd) {
        where.periodEnd.lte = filters.periodEnd;
      }
    }

    const payouts = await prisma.teacherPayout.findMany({
      where,
      include: {
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
        _count: {
          select: {
            lessons: true,
          },
        },
      },
      orderBy: [{ status: 'asc' }, { periodEnd: 'desc' }],
    });

    return payouts;
  }

  /**
   * Get payouts for a specific teacher
   */
  async getTeacherPayouts(teacherId: string, organizationId: string) {
    const payouts = await prisma.teacherPayout.findMany({
      where: {
        teacherId,
        organizationId,
      },
      include: {
        lessons: {
          orderBy: {
            lessonDate: 'asc',
          },
        },
        _count: {
          select: {
            lessons: true,
          },
        },
      },
      orderBy: [{ status: 'asc' }, { periodEnd: 'desc' }],
    });

    return payouts;
  }

  /**
   * Update payout status
   */
  async updatePayoutStatus(
    id: string,
    organizationId: string,
    status: TeacherPayoutStatus,
    notes?: string
  ) {
    const payout = await this.getPayoutById(id, organizationId);

    const updateData: any = {
      status,
    };

    if (status === TeacherPayoutStatus.PAID) {
      updateData.paidAt = new Date();
    }

    if (notes !== undefined) {
      updateData.notes = notes;
    }

    const updatedPayout = await prisma.teacherPayout.update({
      where: { id: payout.id },
      data: updateData,
      include: {
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
        lessons: true,
      },
    });

    return updatedPayout;
  }

  /**
   * Delete a payout (only PENDING payouts can be deleted)
   */
  async deletePayout(id: string, organizationId: string) {
    const payout = await this.getPayoutById(id, organizationId);

    if (payout.status !== TeacherPayoutStatus.PENDING) {
      throw new Error('Only pending payouts can be deleted');
    }

    await prisma.$transaction(async (tx) => {
      // Delete payout lessons first
      await tx.teacherPayoutLesson.deleteMany({
        where: { payoutId: id },
      });

      // Delete payout
      await tx.teacherPayout.delete({
        where: { id },
      });
    });
  }

  /**
   * Get teacher summary for payouts overview
   */
  async getTeachersSummary(organizationId: string) {
    const teachers = await prisma.teacher.findMany({
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
        payouts: {
          where: {
            status: TeacherPayoutStatus.PENDING,
          },
          select: {
            id: true,
            totalAmount: true,
            currency: true,
          },
        },
      },
      orderBy: {
        user: {
          lastName: 'asc',
        },
      },
    });

    return teachers.map((teacher) => ({
      id: teacher.id,
      firstName: teacher.user.firstName,
      lastName: teacher.user.lastName,
      email: teacher.user.email,
      hourlyRate: Number(teacher.hourlyRate),
      pendingPayoutsCount: teacher.payouts.length,
      pendingPayoutsTotal: teacher.payouts.reduce((sum, p) => sum + Number(p.totalAmount), 0),
    }));
  }

  /**
   * Get lessons for a specific day for a teacher (for calendar view)
   */
  async getLessonsForDay(teacherId: string, organizationId: string, date: Date) {
    const startOfDay = new Date(date);
    startOfDay.setUTCHours(0, 0, 0, 0);

    const endOfDay = new Date(date);
    endOfDay.setUTCHours(23, 59, 59, 999);

    const teacher = await prisma.teacher.findFirst({
      where: {
        id: teacherId,
        organizationId,
      },
    });

    if (!teacher) {
      throw new Error('Teacher not found');
    }

    const hourlyRate = Number(teacher.hourlyRate);
    const teacherCancellationSettings = {
      cancellationPayoutEnabled: teacher.cancellationPayoutEnabled,
      cancellationPayoutHours: teacher.cancellationPayoutHours,
      cancellationPayoutPercent: teacher.cancellationPayoutPercent,
    };

    const lessons = await prisma.lesson.findMany({
      where: {
        teacherId,
        organizationId,
        scheduledAt: {
          gte: startOfDay,
          lte: endOfDay,
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
        payoutLessons: {
          include: {
            payout: {
              select: {
                id: true,
                status: true,
                paidAt: true,
              },
            },
          },
        },
      },
      orderBy: {
        scheduledAt: 'asc',
      },
    });

    return lessons.map((lesson) => {
      const { qualified, reason, payoutPercent } = this.isLessonQualified(lesson, teacherCancellationSettings);
      const payoutLesson = lesson.payoutLessons[0];
      const multiplier = payoutPercent / 100;
      const amount = this.calculateLessonAmount(lesson.durationMinutes, hourlyRate, multiplier);

      return {
        id: lesson.id,
        title: lesson.title,
        scheduledAt: lesson.scheduledAt,
        durationMinutes: lesson.durationMinutes,
        status: lesson.status,
        cancelledAt: lesson.cancelledAt,
        studentName: `${lesson.student.user.firstName} ${lesson.student.user.lastName}`,
        hourlyRate,
        amount,
        currency: lesson.currency,
        qualifiesForPayout: qualified,
        qualificationReason: reason,
        payoutPercent: qualified && reason === 'LATE_CANCELLATION' ? payoutPercent : null,
        payout: payoutLesson
          ? {
              id: payoutLesson.payout.id,
              status: payoutLesson.payout.status,
              paidAt: payoutLesson.payout.paidAt,
            }
          : null,
      };
    });
  }

  async getLessonsForRange(
  teacherId: string,
  organizationId: string,
  fromDate: Date,
  toDate: Date
  ) {
    const teacher = await prisma.teacher.findFirst({
      where: { id: teacherId, organizationId },
    });

    if (!teacher) throw new Error('Teacher not found');

    const hourlyRate = Number(teacher.hourlyRate);
    const teacherCancellationSettings = {
      cancellationPayoutEnabled: teacher.cancellationPayoutEnabled,
      cancellationPayoutHours: teacher.cancellationPayoutHours,
      cancellationPayoutPercent: teacher.cancellationPayoutPercent,
    };

    const lessons = await prisma.lesson.findMany({
      where: {
        teacherId,
        organizationId,
        scheduledAt: { gte: fromDate, lte: toDate },
      },
      include: {
        student: { include: { user: { select: { firstName: true, lastName: true } } } },
        payoutLessons: { include: { payout: { select: { id: true, status: true, paidAt: true } } } },
      },
      orderBy: { scheduledAt: 'asc' },
    });

    return lessons.map((lesson) => {
      const { qualified, reason, payoutPercent } = this.isLessonQualified(lesson, teacherCancellationSettings);
      const payoutLesson = lesson.payoutLessons[0];
      const multiplier = payoutPercent / 100;
      const amount = this.calculateLessonAmount(lesson.durationMinutes, hourlyRate, multiplier);

      return {
        id: lesson.id,
        title: lesson.title,
        scheduledAt: lesson.scheduledAt,
        durationMinutes: lesson.durationMinutes,
        status: lesson.status,
        cancelledAt: lesson.cancelledAt,
        studentName: `${lesson.student.user.firstName} ${lesson.student.user.lastName}`,
        hourlyRate,
        amount,
        currency: lesson.currency,
        qualifiesForPayout: qualified,
        qualificationReason: reason,
        payoutPercent: qualified && reason === 'LATE_CANCELLATION' ? payoutPercent : null,
        payout: payoutLesson
          ? {
              id: payoutLesson.payout.id,
              status: payoutLesson.payout.status,
              paidAt: payoutLesson.payout.paidAt,
            }
          : null,
      };
    });
  }
}

export default new PayoutService();
