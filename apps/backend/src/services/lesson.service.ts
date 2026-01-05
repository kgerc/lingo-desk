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
    });

    if (!existingLesson) {
      throw new Error('Lesson not found');
    }

    // If cancelling, set cancelled timestamp
    const updateData: any = { ...data };
    if (data.status === 'CANCELLED' && !existingLesson.cancelledAt) {
      updateData.cancelledAt = new Date();
    }

    // If completing, set completed timestamp
    if (data.status === 'COMPLETED' && !existingLesson.completedAt) {
      updateData.completedAt = new Date();
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
}

export default new LessonService();
