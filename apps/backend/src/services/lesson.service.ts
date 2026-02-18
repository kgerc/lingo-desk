import { PrismaClient, NotificationType, LessonDeliveryMode, LessonStatus, RecurringFrequency } from '@prisma/client';
import emailService from './email.service';
import googleCalendarService from './google-calendar.service';
import balanceService from './balance.service';
import { getHolidayName } from '../utils/polish-holidays';

const prisma = new PrismaClient();

export interface CreateLessonData {
  organizationId: string;
  courseId?: string;
  enrollmentId?: string | undefined;
  teacherId: string;
  studentId: string;
  title: string;
  description?: string;
  scheduledAt: Date;
  durationMinutes: number;
  teacherRate?: number;
  pricePerLesson?: number; // Price charged to student
  currency?: string; // Default: PLN
  locationId?: string;
  classroomId?: string;
  deliveryMode: 'IN_PERSON' | 'ONLINE';
  meetingUrl?: string;
  status?: 'SCHEDULED' | 'CONFIRMED' | 'COMPLETED' | 'CANCELLED' | 'PENDING_CONFIRMATION' | 'NO_SHOW';
  isRecurring?: boolean;
  recurringPatternId?: string;
}

export interface UpdateLessonData {
  title?: string;
  description?: string;
  scheduledAt?: Date;
  durationMinutes?: number;
  teacherRate?: number;
  pricePerLesson?: number;
  currency?: string;
  locationId?: string;
  classroomId?: string;
  deliveryMode?: 'IN_PERSON' | 'ONLINE';
  meetingUrl?: string;
  status?: 'SCHEDULED' | 'CONFIRMED' | 'COMPLETED' | 'CANCELLED' | 'PENDING_CONFIRMATION' | 'NO_SHOW';
  cancellationReason?: string;
}

export interface LessonFilters {
  search?: string;
  teacherId?: string;
  studentId?: string;
  courseId?: string;
  status?: string;
  startDate?: string;
  endDate?: string;
  // Pagination
  page?: number;
  limit?: number;
}

export interface PaginatedResult<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasMore: boolean;
  };
}

class LessonService {
  /**
   * Calculate teacher rate based on course type price, teacher hourly rate, or custom value
   * Priority: custom teacherRate > courseType pricePerLesson > teacher hourlyRate
   */
  private calculateTeacherRate(
    customRate: number | undefined,
    durationMinutes: number,
    courseTypePricePerLesson: number | undefined,
    teacherHourlyRate: number
  ): number {
    // 1. If custom rate provided, use it directly
    if (customRate !== undefined && customRate !== null) {
      return customRate;
    }

    // 2. If course has pricePerLesson, calculate proportional rate based on duration
    // Assuming pricePerLesson is for the defaultDurationMinutes (usually 60 min)
    if (courseTypePricePerLesson !== undefined && courseTypePricePerLesson !== null) {
      // For simplicity, we'll use pricePerLesson as base for 60 minutes
      // and scale proportionally
      const baseDuration = 60; // assume 60 minutes as base
      return (courseTypePricePerLesson / baseDuration) * durationMinutes;
    }

    // 3. Fallback to teacher hourly rate
    const hours = durationMinutes / 60;
    return teacherHourlyRate * hours;
  }

  async createLesson(data: CreateLessonData) {
    const { organizationId, enrollmentId, teacherId, studentId, courseId, ...lessonData } = data;

    // Verify enrollment exists and belongs to organization
    let contractEnrollmentId = enrollmentId;
    let enrollment = await prisma.studentEnrollment.findFirst({
      where: {
        id: enrollmentId,
        course: { organizationId },
      },
      include: {
        course: true,
        student: true,
      },
    });

    if (!enrollment) {
    enrollment = await prisma.studentEnrollment.create({
        data: {
          courseId,
          studentId,
          enrollmentDate: new Date(),
          status: 'ACTIVE',
          paymentMode: 'PER_LESSON',
          hoursPurchased: 0,
          hoursUsed: 0
        },
        include: {
          student: {
            include: {
              user: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                  email: true,
                },
              },
            },
          },
          course: true,
        },
      });
      contractEnrollmentId = enrollment.id;
    }

    // Verify teacher exists and belongs to organization
    const teacher = await prisma.teacher.findFirst({
      where: {
        id: teacherId,
        user: { organizationId },
      },
    });

    if (!teacher) {
      throw new Error('Teacher not found');
    }

    // Verify student exists and belongs to organization
    const student = await prisma.student.findFirst({
      where: {
        id: studentId,
        user: { organizationId },
      },
    });

    if (!student) {
      throw new Error('Student not found');
    }

    // Check if date falls on a Polish holiday (if skipHolidays is enabled)
    const orgSettings = await prisma.organizationSettings.findUnique({
      where: { organizationId },
    });
    const skipHolidays = (orgSettings?.settings as Record<string, any>)?.skipHolidays === true;

    if (skipHolidays) {
      const holidayName = getHolidayName(new Date(data.scheduledAt));
      if (holidayName) {
        throw new Error(`Nie można zaplanować lekcji na dzień ustawowo wolny: ${holidayName}. Zmień datę lub wyłącz pomijanie świąt w ustawieniach.`);
      }
    }

    // Calculate teacher rate if not explicitly provided
    const courseTypePricePerLesson = enrollment?.course?.pricePerLesson
      ? Number(enrollment.course.pricePerLesson)
      : undefined;
    const teacherHourlyRate = Number(teacher.hourlyRate);

    const calculatedTeacherRate = this.calculateTeacherRate(
      data.teacherRate,
      data.durationMinutes,
      courseTypePricePerLesson,
      teacherHourlyRate
    );

    // Create lesson
    const lesson = await prisma.lesson.create({
      data: {
        organizationId,
        courseId: courseId || enrollment.courseId,
        enrollmentId: contractEnrollmentId!,
        teacherId,
        studentId,
        status: data.status || 'SCHEDULED',
        teacherRate: calculatedTeacherRate,
        ...lessonData,
      },
      include: {
        teacher: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
                avatarUrl: true,
              },
            },
          },
        },
        student: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
                avatarUrl: true,
              },
            },
          },
        },
        course: true,
        enrollment: true,
        location: true,
        classroom: true,
        attendances: true,
      },
    });

    // Note: Google Calendar sync is handled in the controller where we have user context
    // This allows the event to be synced to the calendar of whoever is creating the lesson

    // Fire-and-forget: Send lesson creation notifications to student
    this.sendLessonCreatedNotifications(lesson).catch(err =>
      console.error('Failed to send lesson creation notifications:', err)
    );

    return lesson;
  }

  async getLessons(organizationId: string, filters?: LessonFilters): Promise<PaginatedResult<any>> {
    const {
      search, teacherId, studentId, courseId, status, startDate, endDate,
      page = 1, limit = 50
    } = filters || {};

    // Enforce reasonable limits
    const safeLimit = Math.min(Math.max(1, limit), 100);
    const safePage = Math.max(1, page);
    const skip = (safePage - 1) * safeLimit;

    const where: any = {
      organizationId,
    };

    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        {
          teacher: {
            user: {
              OR: [
                { firstName: { contains: search, mode: 'insensitive' } },
                { lastName: { contains: search, mode: 'insensitive' } },
              ],
            },
          },
        },
        {
          student: {
            user: {
              OR: [
                { firstName: { contains: search, mode: 'insensitive' } },
                { lastName: { contains: search, mode: 'insensitive' } },
              ],
            },
          },
        },
      ];
    }

    if (teacherId) {
      where.teacherId = teacherId;
    }

    if (studentId) {
      where.studentId = studentId;
    }

    if (courseId) {
      where.courseId = courseId;
    }

    if (status) {
      where.status = status;
    }

    if (startDate || endDate) {
      where.scheduledAt = {};
      if (startDate) {
        where.scheduledAt.gte = new Date(startDate);
      }
      if (endDate) {
        where.scheduledAt.lte = new Date(endDate);
      }
    }

    // Execute count and data queries in parallel for better performance
    const [total, lessons] = await Promise.all([
      prisma.lesson.count({ where }),
      prisma.lesson.findMany({
        where,
        skip,
        take: safeLimit,
        select: {
          id: true,
          title: true,
          description: true,
          scheduledAt: true,
          durationMinutes: true,
          status: true,
          deliveryMode: true,
          meetingUrl: true,
          teacherRate: true,
          pricePerLesson: true,
          currency: true,
          cancellationReason: true,
          //isPaidCancellation: true,
          createdAt: true,
          teacher: {
            select: {
              id: true,
              user: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                  avatarUrl: true,
                },
              },
            },
          },
          student: {
            select: {
              id: true,
              user: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                  avatarUrl: true,
                },
              },
            },
          },
          course: {
            select: {
              id: true,
              name: true,
            },
          },
          location: {
            select: {
              id: true,
              name: true,
            },
          },
          classroom: {
            select: {
              id: true,
              name: true,
            },
          },
          // Only count attendances, don't fetch all records
          _count: {
            select: {
              attendances: true,
            },
          },
        },
        orderBy: {
          scheduledAt: 'desc',
        },
      }),
    ]);

    const totalPages = Math.ceil(total / safeLimit);

    return {
      data: lessons,
      pagination: {
        page: safePage,
        limit: safeLimit,
        total,
        totalPages,
        hasMore: safePage < totalPages,
      },
    };
  }

  // Keep legacy method for backward compatibility (calendar views need all lessons)
  async getLessonsUnpaginated(organizationId: string, filters?: Omit<LessonFilters, 'page' | 'limit'>) {
    const { search, teacherId, studentId, courseId, status, startDate, endDate } = filters || {};

    const where: any = {
      organizationId,
    };

    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        {
          teacher: {
            user: {
              OR: [
                { firstName: { contains: search, mode: 'insensitive' } },
                { lastName: { contains: search, mode: 'insensitive' } },
              ],
            },
          },
        },
        {
          student: {
            user: {
              OR: [
                { firstName: { contains: search, mode: 'insensitive' } },
                { lastName: { contains: search, mode: 'insensitive' } },
              ],
            },
          },
        },
      ];
    }

    if (teacherId) where.teacherId = teacherId;
    if (studentId) where.studentId = studentId;
    if (courseId) where.courseId = courseId;
    if (status) where.status = status;

    if (startDate || endDate) {
      where.scheduledAt = {};
      if (startDate) where.scheduledAt.gte = new Date(startDate);
      if (endDate) where.scheduledAt.lte = new Date(endDate);
    }

    const lessons = await prisma.lesson.findMany({
      where,
      select: {
        id: true,
        title: true,
        scheduledAt: true,
        durationMinutes: true,
        status: true,
        deliveryMode: true,
        teacherRate: true,
        pricePerLesson: true,
        currency: true,
        cancellationReason: true,
        //isPaidCancellation: true,
        teacher: {
          select: {
            id: true,
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                avatarUrl: true,
              },
            },
          },
        },
        student: {
          select: {
            id: true,
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                avatarUrl: true,
              },
            },
          },
        },
        course: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: {
        scheduledAt: 'desc',
      },
    });

    return lessons;
  }

  async getLessonById(id: string, organizationId: string) {
    const lesson = await prisma.lesson.findFirst({
      where: {
        id,
        organizationId,
      },
      include: {
        teacher: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
                phone: true,
                avatarUrl: true,
              },
            },
          },
        },
        student: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
                phone: true,
                avatarUrl: true,
              },
            },
          },
        },
        course: true,
        enrollment: {
          include: {
            course: true,
          },
        },
        location: true,
        classroom: true,
        attendances: {
          include: {
            student: {
              include: {
                user: {
                  select: {
                    id: true,
                    firstName: true,
                    lastName: true,
                    email: true,
                    avatarUrl: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!lesson) {
      throw new Error('Lesson not found');
    }

    return lesson;
  }

  async updateLesson(id: string, organizationId: string, data: UpdateLessonData, userId?: string) {
    // Verify lesson exists
    const existingLesson = await prisma.lesson.findFirst({
      where: {
        id,
        organizationId,
      },
      include: {
        enrollment: true,
        teacher: {
          include: {
            user: true,
          },
        },
        student: {
          include: {
            user: true,
          },
        },
      },
    });

    if (!existingLesson) {
      throw new Error('Lesson not found');
    }

    // Check if scheduledAt is being changed (lesson rescheduled)
    const isRescheduling = data.scheduledAt &&
      new Date(data.scheduledAt).getTime() !== new Date(existingLesson.scheduledAt).getTime();

    // If cancelling, set cancelled timestamp and check for cancellation fee
    const updateData: any = { ...data };
    const isCancellingLesson = data.status === 'CANCELLED' && existingLesson.status !== 'CANCELLED' && !existingLesson.cancelledAt;

    if (isCancellingLesson) {
      // Check if cancellation limit is exceeded
      const limitCheck = await this.checkCancellationLimit(existingLesson.studentId);
      if (!limitCheck.canCancel) {
        throw new Error(`Limit odwołań został przekroczony. Wykorzystano ${limitCheck.used} z ${limitCheck.limit} dozwolonych odwołań w tym okresie.`);
      }

      updateData.cancelledAt = new Date();

      // Check if cancellation fee should be applied
      const cancellationFeeResult = await this.checkAndApplyCancellationFee(
        existingLesson,
        organizationId
      );

      if (cancellationFeeResult) {
        updateData.cancellationFeeApplied = true;
        updateData.cancellationFeeAmount = cancellationFeeResult.feeAmount;
        updateData.cancellationFeePaymentId = cancellationFeeResult.paymentId;
      }
    }

    // If completing, set completed timestamp and deduct from budget
    const isCompletingLesson = data.status === 'COMPLETED' && existingLesson.status !== 'COMPLETED';
    if (isCompletingLesson && !existingLesson.completedAt) {
      updateData.completedAt = new Date();

      // Deduct hours from student budget, create payment for per-lesson mode, or charge from balance
      // Only if enrollment exists
      if (existingLesson.enrollmentId) {
        await this.deductLessonFromBudget(
          existingLesson.enrollmentId,
          existingLesson.durationMinutes,
          existingLesson.id,
          existingLesson.title
        );
      }
    }

    // If uncompleting (reverting from COMPLETED to another status), restore budget and remove payment
    const isUncompletingLesson = existingLesson.status === 'COMPLETED' && data.status && data.status !== 'COMPLETED';
    if (isUncompletingLesson) {
      updateData.completedAt = null;

      // Restore budget, remove payment, or refund balance
      // Only if enrollment exists
      if (existingLesson.enrollmentId) {
        await this.restoreLessonBudget(
          existingLesson.enrollmentId,
          existingLesson.durationMinutes,
          existingLesson.id,
          existingLesson.title
        );
      }
    }

    const lesson = await prisma.lesson.update({
      where: { id },
      data: updateData,
      include: {
        teacher: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
                avatarUrl: true,
              },
            },
          },
        },
        student: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
                avatarUrl: true,
              },
            },
          },
        },
        course: true,
        enrollment: true,
        location: true,
        classroom: true,
        attendances: true,
      },
    });

    // Fire-and-forget: Send cancellation emails if lesson was cancelled
    if (isCancellingLesson) {
      this.sendCancellationEmails(lesson, data.cancellationReason).catch(err =>
        console.error('Failed to send lesson cancellation emails:', err)
      );
    }

    // Fire-and-forget: Send rescheduling notifications if lesson time was changed
    if (isRescheduling && userId) {
      this.sendReschedulingNotifications(
        lesson,
        existingLesson.scheduledAt,
        organizationId,
        userId
      ).catch(err =>
        console.error('Failed to send rescheduling notifications:', err)
      );
    }

    // Fire-and-forget: Sync to Google Calendar
    if (isCancellingLesson) {
      googleCalendarService.deleteEventFromLesson(lesson.id).catch(err =>
        console.error('Failed to delete lesson from Google Calendar:', err)
      );
    } else {
      googleCalendarService.updateEventFromLesson(lesson.id).catch(err =>
        console.error('Failed to sync lesson update to Google Calendar:', err)
      );
    }

    return lesson;
  }

  /**
   * Check if cancellation fee should be applied and create payment if needed
   * Returns null if no fee applies, or an object with fee details and payment ID
   */
  private async checkAndApplyCancellationFee(
    lesson: any,
    organizationId: string
  ): Promise<{ feeAmount: number; paymentId: string } | null> {
    // Get student with cancellation fee settings
    const student = await prisma.student.findUnique({
      where: { id: lesson.studentId },
      select: {
        id: true,
        cancellationFeeEnabled: true,
        cancellationHoursThreshold: true,
        cancellationFeePercent: true,
        organizationId: true,
        paymentDueDays: true,
        paymentDueDayOfMonth: true,
      },
    });

    // Check if cancellation fee is enabled for this student
    if (!student || !student.cancellationFeeEnabled) {
      return null;
    }

    // Check if thresholds are configured
    if (!student.cancellationHoursThreshold || !student.cancellationFeePercent) {
      return null;
    }

    // Calculate hours until lesson
    const now = new Date();
    const lessonTime = new Date(lesson.scheduledAt);
    const hoursUntilLesson = (lessonTime.getTime() - now.getTime()) / (1000 * 60 * 60);

    // Check if cancellation is within the threshold (late cancellation)
    if (hoursUntilLesson >= student.cancellationHoursThreshold) {
      // Cancelled early enough - no fee
      return null;
    }

    // Calculate fee amount
    const lessonPrice = lesson.pricePerLesson ? Number(lesson.pricePerLesson) : 0;
    if (lessonPrice <= 0) {
      return null; // No price set for the lesson
    }

    const feeAmount = (lessonPrice * student.cancellationFeePercent) / 100;

    // Calculate due date for payment
    const calculateDueDate = (): Date => {
      if (student.paymentDueDayOfMonth) {
        const dueDate = new Date();
        dueDate.setDate(student.paymentDueDayOfMonth);
        if (dueDate <= now) {
          dueDate.setMonth(dueDate.getMonth() + 1);
        }
        return dueDate;
      } else if (student.paymentDueDays) {
        const dueDate = new Date();
        dueDate.setDate(dueDate.getDate() + student.paymentDueDays);
        return dueDate;
      }
      return now;
    };

    // Create pending payment for cancellation fee
    const payment = await prisma.payment.create({
      data: {
        organizationId,
        studentId: student.id,
        enrollmentId: lesson.enrollmentId,
        lessonId: lesson.id,
        amount: feeAmount,
        currency: lesson.currency || 'PLN',
        status: 'PENDING',
        paymentMethod: 'CASH',
        dueAt: calculateDueDate(),
        notes: `Opłata za późne odwołanie lekcji "${lesson.title}" (${student.cancellationFeePercent}% ceny lekcji)`,
      },
    });

    return {
      feeAmount,
      paymentId: payment.id,
    };
  }

  /**
   * Calculate cancellation fee preview (without creating payment)
   * Used by frontend to show fee info before confirming cancellation
   */
  async getCancellationFeePreview(
    lessonId: string,
    organizationId: string
  ): Promise<{
    feeApplies: boolean;
    feeAmount: number | null;
    feePercent: number | null;
    hoursThreshold: number | null;
    hoursUntilLesson: number;
    lessonPrice: number | null;
    currency: string;
  }> {
    const lesson = await prisma.lesson.findFirst({
      where: {
        id: lessonId,
        organizationId,
      },
      include: {
        student: {
          select: {
            cancellationFeeEnabled: true,
            cancellationHoursThreshold: true,
            cancellationFeePercent: true,
          },
        },
      },
    });

    if (!lesson) {
      throw new Error('Lesson not found');
    }

    const now = new Date();
    const lessonTime = new Date(lesson.scheduledAt);
    const hoursUntilLesson = (lessonTime.getTime() - now.getTime()) / (1000 * 60 * 60);
    const lessonPrice = lesson.pricePerLesson ? Number(lesson.pricePerLesson) : null;

    const result = {
      feeApplies: false,
      feeAmount: null as number | null,
      feePercent: lesson.student.cancellationFeePercent,
      hoursThreshold: lesson.student.cancellationHoursThreshold,
      hoursUntilLesson: Math.max(0, hoursUntilLesson),
      lessonPrice,
      currency: lesson.currency || 'PLN',
    };

    // Check if fee should apply
    if (
      lesson.student.cancellationFeeEnabled &&
      lesson.student.cancellationHoursThreshold &&
      lesson.student.cancellationFeePercent &&
      lessonPrice &&
      lessonPrice > 0 &&
      hoursUntilLesson < lesson.student.cancellationHoursThreshold
    ) {
      result.feeApplies = true;
      result.feeAmount = (lessonPrice * lesson.student.cancellationFeePercent) / 100;
    }

    return result;
  }

  /**
   * Check if student can cancel a lesson based on their cancellation limit
   */
  private async checkCancellationLimit(studentId: string): Promise<{
    canCancel: boolean;
    used: number;
    limit: number | null;
    limitEnabled: boolean;
    period: string | null;
  }> {
    const student = await prisma.student.findUnique({
      where: { id: studentId },
      select: {
        cancellationLimitEnabled: true,
        cancellationLimitCount: true,
        cancellationLimitPeriod: true,
        enrollmentDate: true,
      },
    });

    if (!student || !student.cancellationLimitEnabled || !student.cancellationLimitCount) {
      return {
        canCancel: true,
        used: 0,
        limit: null,
        limitEnabled: false,
        period: null,
      };
    }

    // Calculate period start date
    const periodStart = this.calculatePeriodStart(student.cancellationLimitPeriod, student.enrollmentDate);

    // Count cancellations in the current period
    const cancellationsCount = await prisma.lesson.count({
      where: {
        studentId,
        status: 'CANCELLED',
        cancelledAt: {
          gte: periodStart,
        },
      },
    });

    return {
      canCancel: cancellationsCount < student.cancellationLimitCount,
      used: cancellationsCount,
      limit: student.cancellationLimitCount,
      limitEnabled: true,
      period: student.cancellationLimitPeriod,
    };
  }

  /**
   * Calculate the start date of the current period for cancellation limit
   */
  private calculatePeriodStart(period: string | null, enrollmentDate: Date): Date {
    const now = new Date();

    switch (period) {
      case 'month': {
        return new Date(now.getFullYear(), now.getMonth(), 1);
      }
      case 'quarter': {
        const quarter = Math.floor(now.getMonth() / 3);
        return new Date(now.getFullYear(), quarter * 3, 1);
      }
      case 'year': {
        return new Date(now.getFullYear(), 0, 1);
      }
      case 'enrollment':
      default: {
        return new Date(enrollmentDate);
      }
    }
  }

  /**
   * Get cancellation statistics for a student
   */
  async getCancellationStats(studentId: string, organizationId: string): Promise<{
    limitEnabled: boolean;
    limit: number | null;
    used: number;
    remaining: number | null;
    period: string | null;
    periodStart: Date | null;
    canCancel: boolean;
    cancelledLessons: Array<{
      id: string;
      title: string;
      scheduledAt: Date;
      cancelledAt: Date;
      cancellationReason: string | null;
      cancellationFeeApplied: boolean;
      cancellationFeeAmount: number | null;
    }>;
  }> {
    const student = await prisma.student.findFirst({
      where: {
        id: studentId,
        organizationId,
      },
      select: {
        cancellationLimitEnabled: true,
        cancellationLimitCount: true,
        cancellationLimitPeriod: true,
        enrollmentDate: true,
      },
    });

    if (!student) {
      throw new Error('Student not found');
    }

    const periodStart = student.cancellationLimitEnabled
      ? this.calculatePeriodStart(student.cancellationLimitPeriod, student.enrollmentDate)
      : null;

    // Get cancelled lessons (in current period if limit enabled, otherwise all)
    const cancelledLessons = await prisma.lesson.findMany({
      where: {
        studentId,
        status: 'CANCELLED',
        cancelledAt: periodStart ? { gte: periodStart } : { not: null },
      },
      select: {
        id: true,
        title: true,
        scheduledAt: true,
        cancelledAt: true,
        cancellationReason: true,
        cancellationFeeApplied: true,
        cancellationFeeAmount: true,
      },
      orderBy: {
        cancelledAt: 'desc',
      },
    });

    const used = cancelledLessons.length;
    const limit = student.cancellationLimitEnabled ? student.cancellationLimitCount : null;
    const remaining = limit !== null ? Math.max(0, limit - used) : null;
    const canCancel = !student.cancellationLimitEnabled || (limit !== null && used < limit);

    return {
      limitEnabled: student.cancellationLimitEnabled,
      limit,
      used,
      remaining,
      period: student.cancellationLimitPeriod,
      periodStart,
      canCancel,
      cancelledLessons: cancelledLessons.map(l => ({
        id: l.id,
        title: l.title,
        scheduledAt: l.scheduledAt,
        cancelledAt: l.cancelledAt!,
        cancellationReason: l.cancellationReason,
        cancellationFeeApplied: l.cancellationFeeApplied,
        cancellationFeeAmount: l.cancellationFeeAmount ? Number(l.cancellationFeeAmount) : null,
      })),
    };
  }

  /**
   * Send cancellation emails to teacher and student (fire-and-forget helper)
   */
  private async sendCancellationEmails(lesson: any, cancellationReason?: string) {
    await Promise.all([
      emailService.sendLessonCancellation({
        recipientEmail: lesson.teacher.user.email,
        recipientName: `${lesson.teacher.user.firstName} ${lesson.teacher.user.lastName}`,
        otherPersonName: `${lesson.student.user.firstName} ${lesson.student.user.lastName}`,
        otherPersonRole: 'uczeń',
        lessonTitle: lesson.title,
        lessonDate: lesson.scheduledAt,
        cancellationReason,
      }),
      emailService.sendLessonCancellation({
        recipientEmail: lesson.student.user.email,
        recipientName: `${lesson.student.user.firstName} ${lesson.student.user.lastName}`,
        otherPersonName: `${lesson.teacher.user.firstName} ${lesson.teacher.user.lastName}`,
        otherPersonRole: 'lektor',
        lessonTitle: lesson.title,
        lessonDate: lesson.scheduledAt,
        cancellationReason,
      }),
    ]);
  }

  /**
   * Send rescheduling notifications and emails (fire-and-forget helper)
   */
  private async sendReschedulingNotifications(
    lesson: any,
    oldScheduledAt: Date,
    organizationId: string,
    userId: string
  ) {
    // Get user who made the change
    const userWhoRescheduled = await prisma.user.findUnique({
      where: { id: userId },
      select: { firstName: true, lastName: true },
    });

    const rescheduledByName = userWhoRescheduled
      ? `${userWhoRescheduled.firstName} ${userWhoRescheduled.lastName}`
      : 'System';

    // Create in-app notifications and send emails in parallel
    await Promise.all([
      // In-app notification for teacher
      prisma.notification.create({
        data: {
          organizationId,
          userId: lesson.teacher.userId,
          type: NotificationType.IN_APP,
          channel: 'IN_APP',
          subject: 'Zmiana terminu zajęć',
          body: `Zajęcia "${lesson.title}" z ${lesson.student.user.firstName} ${lesson.student.user.lastName} zostały przeniesione. Nowy termin: ${new Date(lesson.scheduledAt).toLocaleString('pl-PL')}`,
          status: 'SENT',
          metadata: {
            lessonId: lesson.id,
            oldDate: oldScheduledAt,
            newDate: lesson.scheduledAt,
            rescheduledBy: userId,
          },
        },
      }),
      // In-app notification for student
      prisma.notification.create({
        data: {
          organizationId,
          userId: lesson.student.userId,
          type: NotificationType.IN_APP,
          channel: 'IN_APP',
          subject: 'Zmiana terminu zajęć',
          body: `Zajęcia "${lesson.title}" z ${lesson.teacher.user.firstName} ${lesson.teacher.user.lastName} zostały przeniesione. Nowy termin: ${new Date(lesson.scheduledAt).toLocaleString('pl-PL')}`,
          status: 'SENT',
          metadata: {
            lessonId: lesson.id,
            oldDate: oldScheduledAt,
            newDate: lesson.scheduledAt,
            rescheduledBy: userId,
          },
        },
      }),
      // Email to teacher
      emailService.sendLessonRescheduled({
        recipientEmail: lesson.teacher.user.email,
        recipientName: `${lesson.teacher.user.firstName} ${lesson.teacher.user.lastName}`,
        otherPersonName: `${lesson.student.user.firstName} ${lesson.student.user.lastName}`,
        otherPersonRole: 'uczeń',
        lessonTitle: lesson.title,
        oldDate: oldScheduledAt,
        newDate: lesson.scheduledAt,
        lessonDuration: lesson.durationMinutes,
        deliveryMode: lesson.deliveryMode || 'IN_PERSON',
        meetingUrl: lesson.meetingUrl,
        rescheduledBy: rescheduledByName,
      }),
      // Email to student
      emailService.sendLessonRescheduled({
        recipientEmail: lesson.student.user.email,
        recipientName: `${lesson.student.user.firstName} ${lesson.student.user.lastName}`,
        otherPersonName: `${lesson.teacher.user.firstName} ${lesson.teacher.user.lastName}`,
        otherPersonRole: 'lektor',
        lessonTitle: lesson.title,
        oldDate: oldScheduledAt,
        newDate: lesson.scheduledAt,
        lessonDuration: lesson.durationMinutes,
        deliveryMode: lesson.deliveryMode || 'IN_PERSON',
        meetingUrl: lesson.meetingUrl,
        rescheduledBy: rescheduledByName,
      }),
    ]);
  }

  /**
   * Send lesson created notifications (IN_APP for student)
   */
  private async sendLessonCreatedNotifications(lesson: any) {
    const scheduledAtFormatted = new Date(lesson.scheduledAt).toLocaleString('pl-PL', {
      dateStyle: 'long',
      timeStyle: 'short',
    });

    // Create IN_APP notification for student
    await prisma.notification.create({
      data: {
        organizationId: lesson.organizationId,
        userId: lesson.student.user.id,
        type: NotificationType.IN_APP,
        channel: 'IN_APP',
        subject: 'Nowe zajęcia zaplanowane',
        body: `Zaplanowano nowe zajęcia "${lesson.title}" z ${lesson.teacher.user.firstName} ${lesson.teacher.user.lastName}. Termin: ${scheduledAtFormatted}`,
        status: 'SENT',
        metadata: {
          lessonId: lesson.id,
          scheduledAt: lesson.scheduledAt,
          teacherId: lesson.teacherId,
          durationMinutes: lesson.durationMinutes,
        },
      },
    });
  }

  /**
   * Send lesson confirmed notifications (IN_APP for student)
   */
  private async sendLessonConfirmedNotifications(lesson: any, organizationId: string) {
    const scheduledAtFormatted = new Date(lesson.scheduledAt).toLocaleString('pl-PL', {
      dateStyle: 'long',
      timeStyle: 'short',
    });

    // Create IN_APP notification for student
    await prisma.notification.create({
      data: {
        organizationId,
        userId: lesson.student.user.id,
        type: NotificationType.IN_APP,
        channel: 'IN_APP',
        subject: 'Zajęcia potwierdzone',
        body: `Zajęcia "${lesson.title}" z ${lesson.teacher.user.firstName} ${lesson.teacher.user.lastName} zostały potwierdzone. Termin: ${scheduledAtFormatted}`,
        status: 'SENT',
        metadata: {
          lessonId: lesson.id,
          scheduledAt: lesson.scheduledAt,
          teacherId: lesson.teacherId,
          confirmedAt: lesson.confirmedByTeacherAt,
        },
      },
    });
  }

  /**
   * Restore budget when uncompleting a lesson (reverting from COMPLETED status)
   */
  private async restoreLessonBudget(enrollmentId: string, durationMinutes: number, lessonId?: string, lessonTitle?: string) {
    const hoursToRestore = durationMinutes / 60;

    // Get enrollment to check payment mode
    const enrollment = await prisma.studentEnrollment.findUnique({
      where: { id: enrollmentId },
      include: { student: true },
    });

    if (!enrollment) {
      throw new Error('Enrollment not found');
    }

    // Handle BALANCE mode separately (uses its own transaction)
    if (enrollment.paymentMode === 'BALANCE' && lessonId) {
      try {
        await balanceService.refundLesson(
          enrollment.studentId,
          enrollment.student.organizationId,
          lessonId,
          lessonTitle || 'Lekcja'
        );
      } catch (error) {
        console.error('Failed to refund lesson to student balance:', error);
      }
      return;
    }

    // Use transaction for PACKAGE and PER_LESSON modes
    await prisma.$transaction(async (tx) => {
      if (enrollment.paymentMode === 'PACKAGE') {
        // PACKAGE mode: Restore hoursUsed
        await tx.studentEnrollment.update({
          where: { id: enrollmentId },
          data: {
            hoursUsed: {
              decrement: hoursToRestore,
            },
          },
        });
      } else if (enrollment.paymentMode === 'PER_LESSON') {
        // PER_LESSON mode: Delete the payment if it exists and is still PENDING
        if (lessonId) {
          const payment = await tx.payment.findFirst({
            where: {
              lessonId,
              status: 'PENDING', // Only delete if still pending
            },
          });

          if (payment) {
            await tx.payment.delete({
              where: { id: payment.id },
            });
          }
          // If payment was already COMPLETED, we don't delete it - that's a financial record
        }
      }
    });
  }

  private async deductLessonFromBudget(enrollmentId: string, durationMinutes: number, lessonId?: string, lessonTitle?: string) {
    const hoursToDeduct = durationMinutes / 60;

    // Get enrollment info first to check payment mode
    const enrollment = await prisma.studentEnrollment.findUnique({
      where: { id: enrollmentId },
      include: {
        student: true,
        course: true,
      },
    });

    if (!enrollment) {
      throw new Error('Enrollment not found');
    }

    // Handle BALANCE mode separately (uses its own transaction)
    if (enrollment.paymentMode === 'BALANCE') {
      if (lessonId) {
        // Get lesson price
        const lesson = await prisma.lesson.findUnique({
          where: { id: lessonId },
          select: { pricePerLesson: true, teacherRate: true, title: true },
        });

        // Use pricePerLesson from lesson, fallback to teacherRate, then to course pricePerLesson
        const price = lesson?.pricePerLesson
          ? parseFloat(lesson.pricePerLesson.toString())
          : lesson?.teacherRate
            ? parseFloat(lesson.teacherRate.toString())
            : parseFloat((enrollment.course?.pricePerLesson || 0).toString());

        if (price > 0) {
          try {
            await balanceService.chargeForLesson(
              enrollment.studentId,
              enrollment.student.organizationId,
              lessonId,
              price,
              lessonTitle || lesson?.title || 'Lekcja'
            );
          } catch (error) {
            console.error('Failed to charge lesson from student balance:', error);
            throw error;
          }
        }
      }
      return;
    }

    // Use transaction for PACKAGE and PER_LESSON modes
    return await prisma.$transaction(async (tx) => {
      // Handle based on payment mode
      if (enrollment.paymentMode === 'PACKAGE') {
        // PACKAGE mode: Check and deduct from hoursPurchased/hoursUsed
        const remainingHours = parseFloat(enrollment.hoursPurchased.toString()) - parseFloat(enrollment.hoursUsed.toString());
        if (remainingHours < hoursToDeduct) {
          throw new Error(`Insufficient budget. Remaining hours: ${remainingHours.toFixed(2)}, Required: ${hoursToDeduct.toFixed(2)}`);
        }

        // Update hoursUsed
        await tx.studentEnrollment.update({
          where: { id: enrollmentId },
          data: {
            hoursUsed: {
              increment: hoursToDeduct,
            },
          },
        });
      } else if (enrollment.paymentMode === 'PER_LESSON') {
        // PER_LESSON mode: Check if payment exists for this lesson
        if (lessonId) {
          // Check for ANY existing payment (PENDING or COMPLETED) to prevent duplicates
          const existingPayment = await tx.payment.findFirst({
            where: {
              lessonId,
              status: { in: ['COMPLETED', 'PENDING'] },
            },
          });

          // If no payment exists, create a pending payment
          if (!existingPayment) {
            // Get the lesson to retrieve teacherRate
            const lesson = await tx.lesson.findUnique({
              where: { id: lessonId },
              select: { teacherRate: true, pricePerLesson: true },
            });

            // Use pricePerLesson from lesson, fallback to teacherRate, then to course pricePerLesson
            const pricePerLesson = lesson?.pricePerLesson
              ? parseFloat(lesson.pricePerLesson.toString())
              : lesson?.teacherRate
                ? parseFloat(lesson.teacherRate.toString())
                : parseFloat((enrollment.course?.pricePerLesson || 0).toString());

            // Calculate dueAt based on student's payment settings
            const now = new Date();
            let dueAt: Date | null = null;

            if (enrollment.student.paymentDueDayOfMonth) {
              // If paymentDueDayOfMonth is set (e.g., 10 = 10th day of month)
              dueAt = new Date(now);
              const targetDay = enrollment.student.paymentDueDayOfMonth;

              // Set to target day of current month
              dueAt.setDate(targetDay);

              // If the target day has already passed this month, move to next month
              if (dueAt <= now) {
                dueAt.setMonth(dueAt.getMonth() + 1);
              }

              // Handle edge case: if target day doesn't exist in the month (e.g., 31st in February)
              // JavaScript automatically adjusts to the next valid date
            } else if (enrollment.student.paymentDueDays) {
              // If paymentDueDays is set, calculate due date (X days from now)
              dueAt = new Date(now);
              dueAt.setDate(dueAt.getDate() + enrollment.student.paymentDueDays);
            } else {
              // If neither is set, student becomes debtor immediately
              dueAt = now;
            }

            await tx.payment.create({
              data: {
                organizationId: enrollment.student.organizationId,
                studentId: enrollment.studentId,
                enrollmentId: enrollment.id,
                lessonId: lessonId,
                amount: pricePerLesson,
                currency: 'PLN',
                status: 'PENDING',
                paymentMethod: 'CASH',
                dueAt: dueAt,
                notes: 'Płatność za lekcję - utworzona automatycznie po zakończeniu lekcji',
              },
            });
          }
        }
      }
    });
  }

  async deleteLesson(id: string, organizationId: string) {
    // Verify lesson exists
    const lesson = await prisma.lesson.findFirst({
      where: {
        id,
        organizationId,
      },
    });

    if (!lesson) {
      throw new Error('Lesson not found');
    }

    // Check if lesson is already completed
    if (lesson.status === 'COMPLETED') {
      throw new Error('Cannot delete completed lesson');
    }

    // Delete event from Google Calendar first (before deleting from DB)
    try {
      await googleCalendarService.deleteEventFromLesson(id);
    } catch (error) {
      console.error('Failed to delete lesson from Google Calendar:', error);
      // Don't fail the lesson deletion if Google Calendar sync fails
    }

    // Handle related records before deleting the lesson
    // 1. Remove lesson reference from payments (don't delete payments, just unlink)
    await prisma.payment.updateMany({
      where: { lessonId: id },
      data: { lessonId: null },
    });

    // 2. Delete teacher payout lessons (if any)
    await prisma.teacherPayoutLesson.deleteMany({
      where: { lessonId: id },
    });

    // Note: LessonAttendance, Substitution, and LessonGoogleCalendarEvent
    // have onDelete: Cascade, so they will be automatically deleted

    // Hard delete - completely remove from database
    await prisma.lesson.delete({
      where: { id },
    });

    return { message: 'Lesson deleted successfully' };
  }

  async confirmLesson(id: string, organizationId: string) {
    const lesson = await prisma.lesson.findFirst({
      where: {
        id,
        organizationId,
      },
    });

    if (!lesson) {
      throw new Error('Lesson not found');
    }

    if (lesson.status === 'CANCELLED') {
      throw new Error('Cannot confirm cancelled lesson');
    }

    if (lesson.status === 'COMPLETED') {
      throw new Error('Lesson already completed');
    }

    const updatedLesson = await prisma.lesson.update({
      where: { id },
      data: {
        status: 'CONFIRMED',
        confirmedByTeacherAt: new Date(),
      },
      include: {
        teacher: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
                avatarUrl: true,
              },
            },
          },
        },
        student: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
                avatarUrl: true,
              },
            },
          },
        },
        course: true,
      },
    });

    // Fire-and-forget: Send lesson confirmation notifications to student
    this.sendLessonConfirmedNotifications(updatedLesson, organizationId).catch(err =>
      console.error('Failed to send lesson confirmation notifications:', err)
    );

    return updatedLesson;
  }

  async getLessonStats(organizationId: string) {
    const total = await prisma.lesson.count({
      where: { organizationId },
    });

    const scheduled = await prisma.lesson.count({
      where: {
        organizationId,
        status: 'SCHEDULED',
      },
    });

    const completed = await prisma.lesson.count({
      where: {
        organizationId,
        status: 'COMPLETED',
      },
    });

    const cancelled = await prisma.lesson.count({
      where: {
        organizationId,
        status: 'CANCELLED',
      },
    });

    const pendingConfirmation = await prisma.lesson.count({
      where: {
        organizationId,
        status: 'PENDING_CONFIRMATION',
      },
    });

    return {
      total,
      scheduled,
      completed,
      cancelled,
      pendingConfirmation,
    };
  }

  // Check for scheduling conflicts
  async checkConflicts(
    organizationId: string,
    teacherId: string,
    studentId: string,
    scheduledAt: Date,
    durationMinutes: number,
    excludeLessonId?: string
  ) {
    const lessonStart = new Date(scheduledAt);
    const lessonEnd = new Date(lessonStart.getTime() + durationMinutes * 60000);

    // Build where clause to exclude cancelled and specific lesson
    const baseWhere: any = {
      organizationId,
      status: {
        notIn: ['CANCELLED', 'NO_SHOW'],
      },
      scheduledAt: {
        lt: lessonEnd,
      },
    };

    if (excludeLessonId) {
      baseWhere.id = { not: excludeLessonId };
    }

    // Check teacher conflicts
    const teacherConflicts = await prisma.lesson.findMany({
      where: {
        ...baseWhere,
        teacherId,
      },
      select: {
        id: true,
        title: true,
        scheduledAt: true,
        durationMinutes: true,
        student: {
          select: {
            user: {
              select: {
                firstName: true,
                lastName: true,
              },
            },
          },
        },
      },
    });

    // Filter to actual time conflicts
    const teacherOverlaps = teacherConflicts.filter((lesson) => {
      const existingStart = new Date(lesson.scheduledAt);
      const existingEnd = new Date(existingStart.getTime() + lesson.durationMinutes * 60000);
      return existingStart < lessonEnd && existingEnd > lessonStart;
    });

    // Check student conflicts
    const studentConflicts = await prisma.lesson.findMany({
      where: {
        ...baseWhere,
        studentId,
      },
      select: {
        id: true,
        title: true,
        scheduledAt: true,
        durationMinutes: true,
        teacher: {
          select: {
            user: {
              select: {
                firstName: true,
                lastName: true,
              },
            },
          },
        },
      },
    });

    // Filter to actual time conflicts
    const studentOverlaps = studentConflicts.filter((lesson) => {
      const existingStart = new Date(lesson.scheduledAt);
      const existingEnd = new Date(existingStart.getTime() + lesson.durationMinutes * 60000);
      return existingStart < lessonEnd && existingEnd > lessonStart;
    });

    return {
      hasConflicts: teacherOverlaps.length > 0 || studentOverlaps.length > 0,
      teacherConflicts: teacherOverlaps.map((lesson) => ({
        id: lesson.id,
        title: lesson.title,
        scheduledAt: lesson.scheduledAt,
        durationMinutes: lesson.durationMinutes,
        studentName: `${lesson.student.user.firstName} ${lesson.student.user.lastName}`,
      })),
      studentConflicts: studentOverlaps.map((lesson) => ({
        id: lesson.id,
        title: lesson.title,
        scheduledAt: lesson.scheduledAt,
        durationMinutes: lesson.durationMinutes,
        teacherName: `${lesson.teacher.user.firstName} ${lesson.teacher.user.lastName}`,
      })),
    };
  }

  /**
   * Create recurring lessons based on a pattern
   */
  async createRecurringLessons(
    organizationId: string,
    lessonData: {
      title: string;
      description?: string;
      teacherId: string;
      studentId: string;
      enrollmentId?: string; // Optional - empty string should be treated as undefined
      courseId?: string;
      durationMinutes: number;
      locationId?: string;
      classroomId?: string;
      deliveryMode: LessonDeliveryMode;
      meetingUrl?: string;
      status: LessonStatus;
    },
    pattern: {
      frequency: RecurringFrequency;
      interval?: number;
      daysOfWeek?: number[]; // 0 = Sunday, 1 = Monday, etc.
      startDate: Date;
      endDate?: Date;
      occurrencesCount?: number;
    }
  ) {
    // Check if organization has skipHolidays enabled
    const orgSettings = await prisma.organizationSettings.findUnique({
      where: { organizationId },
    });
    const skipHolidays = (orgSettings?.settings as Record<string, any>)?.skipHolidays === true;

    // For weekly/biweekly, if daysOfWeek is not provided, use the day of the start date
    const effectiveDaysOfWeek =
      pattern.daysOfWeek && pattern.daysOfWeek.length > 0
        ? pattern.daysOfWeek
        : [new Date(pattern.startDate).getDay()];

    // First, calculate all the dates for lessons and check conflicts
    const lessonDates: Date[] = [];
    const errors: Array<{ date: string; error: string }> = [];
    let currentDate = new Date(pattern.startDate);
    let count = 0;
    // For MONTHLY frequency, remember the original day to preserve it across months
    const originalDayOfMonth = pattern.frequency === 'MONTHLY' ? currentDate.getDate() : undefined;
    // Max occurrences: use provided value, or if endDate is set use higher limit (104 = 2 years weekly)
    // If neither is provided, default to 100 for safety
    const maxOccurrences = pattern.occurrencesCount || (pattern.endDate ? 104 : 100);

    // Collect all valid dates first
    while (
      count < maxOccurrences &&
      (!pattern.endDate || currentDate <= pattern.endDate)
    ) {
      // Check if this day should have a lesson (for weekly/biweekly)
      if (pattern.frequency === 'WEEKLY' || pattern.frequency === 'BIWEEKLY') {
        const dayOfWeek = currentDate.getDay();
        if (!effectiveDaysOfWeek.includes(dayOfWeek)) {
          // Move to next week
          currentDate = this.getNextDate(currentDate, pattern.frequency, pattern.interval || 1);
          continue;
        }
      }

      // Skip Polish holidays if enabled
      if (skipHolidays) {
        const holidayName = getHolidayName(currentDate);
        if (holidayName) {
          errors.push({
            date: currentDate.toISOString(),
            error: `Pominięto święto: ${holidayName}`,
          });
          // Move to next occurrence
          currentDate = this.getNextDate(currentDate, pattern.frequency, pattern.interval || 1, originalDayOfMonth);
          continue;
        }
      }

      // Check for conflicts before adding to list
      const conflicts = await this.checkConflicts(
        organizationId,
        lessonData.teacherId,
        lessonData.studentId,
        currentDate,
        lessonData.durationMinutes
      );

      if (!conflicts.hasConflicts) {
        lessonDates.push(new Date(currentDate));
        count++;
      } else {
        errors.push({
          date: currentDate.toISOString(),
          error: 'Scheduling conflict',
        });
      }

      // Move to next occurrence
      currentDate = this.getNextDate(currentDate, pattern.frequency, pattern.interval || 1, originalDayOfMonth);
    }

    // Use transaction to ensure atomicity - either all lessons are created or none
    const result = await prisma.$transaction(async (tx) => {
      // Create the recurring pattern
      const recurringPattern = await tx.recurringPattern.create({
        data: {
          organizationId,
          frequency: pattern.frequency,
          interval: pattern.interval || 1,
          daysOfWeek: effectiveDaysOfWeek,
          startDate: pattern.startDate,
          endDate: pattern.endDate,
          occurrencesCount: pattern.occurrencesCount,
          createdLessonsCount: lessonDates.length,
        },
      });

      // Create all lessons in the transaction
      const createdLessons = [];

      // Sanitize lessonData - remove empty string values for optional foreign keys
      const sanitizedLessonData = {
        ...lessonData,
        enrollmentId: lessonData.enrollmentId && lessonData.enrollmentId.trim() !== '' ? lessonData.enrollmentId : undefined,
        courseId: lessonData.courseId && lessonData.courseId.trim() !== '' ? lessonData.courseId : undefined,
        locationId: lessonData.locationId && lessonData.locationId.trim() !== '' ? lessonData.locationId : undefined,
        classroomId: lessonData.classroomId && lessonData.classroomId.trim() !== '' ? lessonData.classroomId : undefined,
        meetingUrl: lessonData.meetingUrl && lessonData.meetingUrl.trim() !== '' ? lessonData.meetingUrl : undefined,
      };

      for (const lessonDate of lessonDates) {
        const lesson = await tx.lesson.create({
          data: {
            organizationId,
            ...sanitizedLessonData,
            scheduledAt: lessonDate,
            isRecurring: true,
            recurringPatternId: recurringPattern.id,
          },
          include: {
            teacher: {
              include: {
                user: {
                  select: {
                    id: true,
                    firstName: true,
                    lastName: true,
                    email: true,
                  },
                },
              },
            },
            student: {
              include: {
                user: {
                  select: {
                    id: true,
                    firstName: true,
                    lastName: true,
                    email: true,
                  },
                },
              },
            },
          },
        });
        createdLessons.push(lesson);
      }

      return {
        recurringPattern,
        createdLessons,
      };
    });

    return {
      recurringPattern: result.recurringPattern,
      createdLessons: result.createdLessons,
      errors,
      totalCreated: result.createdLessons.length,
      totalErrors: errors.length,
    };
  }

  /**
   * Calculate next date based on frequency and interval.
   * For MONTHLY: preserves the original day of month. If the target month
   * has fewer days (e.g., Jan 31 → Feb), clamps to the last day of the month.
   * Pass originalDayOfMonth for MONTHLY to ensure consistent day across months.
   */
  private getNextDate(
    currentDate: Date,
    frequency: 'DAILY' | 'WEEKLY' | 'BIWEEKLY' | 'MONTHLY',
    interval: number,
    originalDayOfMonth?: number
  ): Date {
    const nextDate = new Date(currentDate);

    switch (frequency) {
      case 'DAILY':
        nextDate.setDate(nextDate.getDate() + interval);
        break;
      case 'WEEKLY':
        nextDate.setDate(nextDate.getDate() + 7 * interval);
        break;
      case 'BIWEEKLY':
        nextDate.setDate(nextDate.getDate() + 14 * interval);
        break;
      case 'MONTHLY': {
        const targetMonth = nextDate.getMonth() + interval;
        nextDate.setMonth(targetMonth, 1); // Set to 1st to avoid overflow
        const dayToUse = originalDayOfMonth ?? currentDate.getDate();
        const maxDay = new Date(nextDate.getFullYear(), nextDate.getMonth() + 1, 0).getDate();
        nextDate.setDate(Math.min(dayToUse, maxDay));
        break;
      }
    }

    return nextDate;
  }

  /**
   * Bulk update status of multiple lessons
   * Uses updateLesson internally to preserve all side effects
   */
  async bulkUpdateStatus(
    lessonIds: string[],
    status: string,
    organizationId: string,
    userId?: string
  ): Promise<{
    updated: number;
    failed: number;
    errors: Array<{ lessonId: string; title: string; error: string }>;
  }> {
    const results = {
      updated: 0,
      failed: 0,
      errors: [] as Array<{ lessonId: string; title: string; error: string }>,
    };

    for (const lessonId of lessonIds) {
      try {
        // For CONFIRMED status, use confirmLesson method
        if (status === 'CONFIRMED') {
          await this.confirmLesson(lessonId, organizationId);
        } else {
          await this.updateLesson(lessonId, organizationId, { status: status as any }, userId);
        }
        results.updated++;
      } catch (error: any) {
        // Get lesson title for error message
        const lesson = await prisma.lesson.findFirst({
          where: { id: lessonId, organizationId },
          select: { title: true },
        });
        results.failed++;
        results.errors.push({
          lessonId,
          title: lesson?.title || lessonId,
          error: error.message || 'Nieznany błąd',
        });
      }
    }

    return results;
  }
}

export default new LessonService();
