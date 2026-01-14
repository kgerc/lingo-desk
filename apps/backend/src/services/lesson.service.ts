import { PrismaClient, NotificationType } from '@prisma/client';
import emailService from './email.service';
import googleCalendarService from './google-calendar.service';

const prisma = new PrismaClient();

export interface CreateLessonData {
  organizationId: string;
  courseId?: string;
  enrollmentId: string;
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
        course: {
          include: {
            courseType: true,
          },
        },
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
          course: {
            include: {
              courseType: true,
            },
          },
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

    // Calculate teacher rate if not explicitly provided
    const courseTypePricePerLesson = enrollment?.course?.courseType?.pricePerLesson
      ? Number(enrollment.course.courseType.pricePerLesson)
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
        enrollmentId: contractEnrollmentId,
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
        course: {
          include: {
            courseType: true,
          },
        },
        enrollment: true,
        location: true,
        classroom: true,
        attendances: true,
      },
    });

    // Sync to Google Calendar if teacher has connected their calendar
    try {
      await googleCalendarService.createEventFromLesson(lesson.id);
    } catch (error) {
      console.error('Failed to sync lesson to Google Calendar:', error);
      // Don't fail the lesson creation if Google Calendar sync fails
    }

    return lesson;
  }

  async getLessons(organizationId: string, filters?: LessonFilters) {
    const { search, teacherId, studentId, courseId, status, startDate, endDate } = filters || {};

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

    const lessons = await prisma.lesson.findMany({
      where,
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
        course: {
          include: {
            courseType: true,
          },
        },
        enrollment: true,
        location: true,
        classroom: true,
        attendances: true,
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
        course: {
          include: {
            courseType: true,
          },
        },
        enrollment: {
          include: {
            course: {
              include: {
                courseType: true,
              },
            },
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

    // If cancelling, set cancelled timestamp
    const updateData: any = { ...data };
    const isCancellingLesson = data.status === 'CANCELLED' && existingLesson.status !== 'CANCELLED' && !existingLesson.cancelledAt;
    if (isCancellingLesson) {
      updateData.cancelledAt = new Date();
    }

    // If completing, set completed timestamp and deduct from budget
    const isCompletingLesson = data.status === 'COMPLETED' && existingLesson.status !== 'COMPLETED';
    if (isCompletingLesson && !existingLesson.completedAt) {
      updateData.completedAt = new Date();

      // Deduct hours from student budget or create payment for per-lesson mode
      await this.deductLessonFromBudget(
        existingLesson.enrollmentId,
        existingLesson.durationMinutes,
        existingLesson.id
      );
    }

    // If uncompleting (reverting from COMPLETED to another status), restore budget and remove payment
    const isUncompletingLesson = existingLesson.status === 'COMPLETED' && data.status && data.status !== 'COMPLETED';
    if (isUncompletingLesson) {
      updateData.completedAt = null;

      // Restore budget and remove payment
      await this.restoreLessonBudget(
        existingLesson.enrollmentId,
        existingLesson.durationMinutes,
        existingLesson.id
      );
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
        course: {
          include: {
            courseType: true,
          },
        },
        enrollment: true,
        location: true,
        classroom: true,
        attendances: true,
      },
    });

    // Send cancellation emails if lesson was cancelled
    if (isCancellingLesson) {
      try {
        // Email to teacher
        await emailService.sendLessonCancellation({
          recipientEmail: lesson.teacher.user.email,
          recipientName: `${lesson.teacher.user.firstName} ${lesson.teacher.user.lastName}`,
          otherPersonName: `${lesson.student.user.firstName} ${lesson.student.user.lastName}`,
          otherPersonRole: 'uczeń',
          lessonTitle: lesson.title,
          lessonDate: lesson.scheduledAt,
          cancellationReason: data.cancellationReason,
        });

        // Email to student
        await emailService.sendLessonCancellation({
          recipientEmail: lesson.student.user.email,
          recipientName: `${lesson.student.user.firstName} ${lesson.student.user.lastName}`,
          otherPersonName: `${lesson.teacher.user.firstName} ${lesson.teacher.user.lastName}`,
          otherPersonRole: 'lektor',
          lessonTitle: lesson.title,
          lessonDate: lesson.scheduledAt,
          cancellationReason: data.cancellationReason,
        });
      } catch (emailError) {
        console.error('Failed to send lesson cancellation emails:', emailError);
        // Don't fail the update if email fails
      }
    }

    // Send rescheduling notifications and create audit log if lesson time was changed
    if (isRescheduling && userId) {
      try {
        // Get user who made the change
        const userWhoRescheduled = await prisma.user.findUnique({
          where: { id: userId },
          select: {
            firstName: true,
            lastName: true,
          },
        });

        const rescheduledByName = userWhoRescheduled
          ? `${userWhoRescheduled.firstName} ${userWhoRescheduled.lastName}`
          : 'System';

        // Create in-app notifications for teacher and student
        await prisma.notification.create({
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
              oldDate: existingLesson.scheduledAt,
              newDate: lesson.scheduledAt,
              rescheduledBy: userId,
            },
          },
        });

        await prisma.notification.create({
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
              oldDate: existingLesson.scheduledAt,
              newDate: lesson.scheduledAt,
              rescheduledBy: userId,
            },
          },
        });

        // Send rescheduling emails
        await emailService.sendLessonRescheduled({
          recipientEmail: lesson.teacher.user.email,
          recipientName: `${lesson.teacher.user.firstName} ${lesson.teacher.user.lastName}`,
          otherPersonName: `${lesson.student.user.firstName} ${lesson.student.user.lastName}`,
          otherPersonRole: 'uczeń',
          lessonTitle: lesson.title,
          oldDate: existingLesson.scheduledAt,
          newDate: lesson.scheduledAt,
          lessonDuration: lesson.durationMinutes,
          deliveryMode: lesson.deliveryMode || 'IN_PERSON',
          meetingUrl: lesson.meetingUrl,
          rescheduledBy: rescheduledByName,
        });

        await emailService.sendLessonRescheduled({
          recipientEmail: lesson.student.user.email,
          recipientName: `${lesson.student.user.firstName} ${lesson.student.user.lastName}`,
          otherPersonName: `${lesson.teacher.user.firstName} ${lesson.teacher.user.lastName}`,
          otherPersonRole: 'lektor',
          lessonTitle: lesson.title,
          oldDate: existingLesson.scheduledAt,
          newDate: lesson.scheduledAt,
          lessonDuration: lesson.durationMinutes,
          deliveryMode: lesson.deliveryMode || 'IN_PERSON',
          meetingUrl: lesson.meetingUrl,
          rescheduledBy: rescheduledByName,
        });
      } catch (notificationError) {
        console.error('Failed to send rescheduling notifications:', notificationError);
        // Don't fail the update if notification/audit fails
      }
    }

    // Sync to Google Calendar if teacher has connected their calendar
    try {
      if (isCancellingLesson) {
        // If lesson is cancelled, delete the event from Google Calendar
        await googleCalendarService.deleteEventFromLesson(lesson.id);
      } else {
        // Otherwise, update the event in Google Calendar
        await googleCalendarService.updateEventFromLesson(lesson.id);
      }
    } catch (error) {
      console.error('Failed to sync lesson update to Google Calendar:', error);
      // Don't fail the lesson update if Google Calendar sync fails
    }

    return lesson;
  }

  /**
   * Deduct lesson hours from student budget or create payment for per-lesson mode
   */
  /**
   * Restore budget when uncompleting a lesson (reverting from COMPLETED status)
   */
  private async restoreLessonBudget(enrollmentId: string, durationMinutes: number, lessonId?: string) {
    const hoursToRestore = durationMinutes / 60;

    return await prisma.$transaction(async (tx) => {
      const enrollment = await tx.studentEnrollment.findUnique({
        where: { id: enrollmentId },
        include: {
          student: true,
          course: {
            include: {
              courseType: true,
            },
          },
        },
      });

      if (!enrollment) {
        throw new Error('Enrollment not found');
      }

      // Handle based on payment mode
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

  private async deductLessonFromBudget(enrollmentId: string, durationMinutes: number, lessonId?: string) {
    const hoursToDeduct = durationMinutes / 60;

    // Use transaction to prevent race conditions and ensure atomicity
    return await prisma.$transaction(async (tx) => {
      // Get current enrollment with student and course info
      const enrollment = await tx.studentEnrollment.findUnique({
        where: { id: enrollmentId },
        include: {
          student: true,
          course: {
            include: {
              courseType: true,
            },
          },
        },
      });

      if (!enrollment) {
        throw new Error('Enrollment not found');
      }

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
              select: { teacherRate: true },
            });

            // Use teacherRate from lesson if available, fallback to courseType pricePerLesson
            const pricePerLesson = lesson?.teacherRate
              ? parseFloat(lesson.teacherRate.toString())
              : parseFloat((enrollment.course?.courseType?.pricePerLesson || 0).toString());

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

    // Soft delete - mark as cancelled
    await prisma.lesson.update({
      where: { id },
      data: {
        status: 'CANCELLED',
        cancelledAt: new Date(),
        cancellationReason: 'Deleted by user',
      },
    });

    // Delete event from Google Calendar if teacher has connected their calendar
    try {
      await googleCalendarService.deleteEventFromLesson(id);
    } catch (error) {
      console.error('Failed to delete lesson from Google Calendar:', error);
      // Don't fail the lesson deletion if Google Calendar sync fails
    }

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
        course: {
          include: {
            courseType: true,
          },
        },
      },
    });

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
      enrollmentId: string;
      courseId?: string;
      durationMinutes: number;
      locationId?: string;
      classroomId?: string;
      deliveryMode: 'ONLINE' | 'IN_PERSON' | 'HYBRID';
      meetingUrl?: string;
      status: 'SCHEDULED' | 'CONFIRMED' | 'PENDING_CONFIRMATION';
    },
    pattern: {
      frequency: 'DAILY' | 'WEEKLY' | 'BIWEEKLY' | 'MONTHLY';
      interval?: number;
      daysOfWeek?: number[]; // 0 = Sunday, 1 = Monday, etc.
      startDate: Date;
      endDate?: Date;
      occurrencesCount?: number;
    }
  ) {
    // Create the recurring pattern first
    const recurringPattern = await prisma.recurringPattern.create({
      data: {
        organizationId,
        frequency: pattern.frequency,
        interval: pattern.interval || 1,
        daysOfWeek: pattern.daysOfWeek || [],
        startDate: pattern.startDate,
        endDate: pattern.endDate,
        occurrencesCount: pattern.occurrencesCount,
      },
    });

    const createdLessons = [];
    const errors = [];
    let currentDate = new Date(pattern.startDate);
    let count = 0;
    const maxOccurrences = pattern.occurrencesCount || 100;

    // Generate lessons
    while (
      count < maxOccurrences &&
      (!pattern.endDate || currentDate <= pattern.endDate)
    ) {
      // Check if this day should have a lesson (for weekly/biweekly)
      if (pattern.frequency === 'WEEKLY' || pattern.frequency === 'BIWEEKLY') {
        const dayOfWeek = currentDate.getDay();
        if (!pattern.daysOfWeek || !pattern.daysOfWeek.includes(dayOfWeek)) {
          // Move to next day
          currentDate = this.getNextDate(currentDate, pattern.frequency, pattern.interval || 1);
          continue;
        }
      }

      // Check for conflicts before creating
      const conflicts = await this.checkConflicts(
        organizationId,
        lessonData.teacherId,
        lessonData.studentId,
        currentDate,
        lessonData.durationMinutes
      );

      if (!conflicts.hasConflicts) {
        try {
          const lesson = await prisma.lesson.create({
            data: {
              organizationId,
              ...lessonData,
              scheduledAt: currentDate,
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
          count++;
        } catch (error) {
          errors.push({
            date: currentDate.toISOString(),
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      } else {
        errors.push({
          date: currentDate.toISOString(),
          error: 'Scheduling conflict',
        });
      }

      // Move to next occurrence
      currentDate = this.getNextDate(currentDate, pattern.frequency, pattern.interval || 1);
    }

    // Update the pattern with count of created lessons
    await prisma.recurringPattern.update({
      where: { id: recurringPattern.id },
      data: { createdLessonsCount: createdLessons.length },
    });

    return {
      recurringPattern,
      createdLessons,
      errors,
      totalCreated: createdLessons.length,
      totalErrors: errors.length,
    };
  }

  /**
   * Calculate next date based on frequency and interval
   */
  private getNextDate(
    currentDate: Date,
    frequency: 'DAILY' | 'WEEKLY' | 'BIWEEKLY' | 'MONTHLY',
    interval: number
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
      case 'MONTHLY':
        nextDate.setMonth(nextDate.getMonth() + interval);
        break;
    }

    return nextDate;
  }
}

export default new LessonService();
