import { PrismaClient } from '@prisma/client';

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
  async createLesson(data: CreateLessonData) {
    const { organizationId, enrollmentId, teacherId, studentId, courseId, ...lessonData } = data;

    // Verify enrollment exists and belongs to organization
    const enrollment = await prisma.studentEnrollment.findFirst({
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
      throw new Error('Enrollment not found');
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

    // Create lesson
    const lesson = await prisma.lesson.create({
      data: {
        organizationId,
        courseId: courseId || enrollment.courseId,
        enrollmentId,
        teacherId,
        studentId,
        status: data.status || 'SCHEDULED',
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

  async updateLesson(id: string, organizationId: string, data: UpdateLessonData) {
    // Verify lesson exists
    const existingLesson = await prisma.lesson.findFirst({
      where: {
        id,
        organizationId,
      },
      include: {
        enrollment: true,
      },
    });

    if (!existingLesson) {
      throw new Error('Lesson not found');
    }

    // If cancelling, set cancelled timestamp
    const updateData: any = { ...data };
    if (data.status === 'CANCELLED' && !existingLesson.cancelledAt) {
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

    return lesson;
  }

  /**
   * Deduct lesson hours from student budget or create payment for per-lesson mode
   */
  private async deductLessonFromBudget(enrollmentId: string, durationMinutes: number, lessonId?: string) {
    const hoursToDeduct = durationMinutes / 60;

    // Get current enrollment with student and course info
    const enrollment = await prisma.studentEnrollment.findUnique({
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
      await prisma.studentEnrollment.update({
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
        const existingPayment = await prisma.payment.findFirst({
          where: {
            lessonId,
            status: 'COMPLETED',
          },
        });

        // If no completed payment exists, create a pending payment
        if (!existingPayment) {
          const pricePerLesson = enrollment.course?.courseType?.pricePerLesson || 0;

          await prisma.payment.create({
            data: {
              organizationId: enrollment.student.organizationId,
              studentId: enrollment.studentId,
              enrollmentId: enrollment.id,
              lessonId: lessonId,
              amount: pricePerLesson,
              currency: 'PLN',
              status: 'PENDING',
              paymentMethod: 'CASH',
              notes: 'Płatność za lekcję - utworzona automatycznie po zakończeniu lekcji',
            },
          });
        }
      }
    }
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
