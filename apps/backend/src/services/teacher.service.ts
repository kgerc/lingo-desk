import prisma from '../utils/prisma';
import { ContractType, UserRole } from '@prisma/client';
import bcrypt from 'bcrypt';

interface CreateTeacherData {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phone?: string;
  hourlyRate: number;
  contractType: ContractType;
  specializations?: string[];
  languages?: string[];
  bio?: string;
  organizationId: string;
}

interface UpdateTeacherData {
  firstName?: string;
  lastName?: string;
  phone?: string;
  email?: string;
  hourlyRate?: number;
  contractType?: ContractType;
  specializations?: string[];
  languages?: string[];
  bio?: string;
  isAvailableForBooking?: boolean;
  isActive?: boolean;
}

export class TeacherService {
  async createTeacher(data: CreateTeacherData) {
    const {
      email,
      password,
      firstName,
      lastName,
      phone,
      hourlyRate,
      contractType,
      specializations,
      languages,
      bio,
      organizationId,
    } = data;

    // Check if user exists
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      throw new Error('User with this email already exists');
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    // Create user and teacher in a transaction
    const result = await prisma.$transaction(async (tx) => {
      // Create user
      const user = await tx.user.create({
        data: {
          email,
          passwordHash,
          firstName,
          lastName,
          phone,
          role: UserRole.TEACHER,
          organizationId,
        },
      });

      // Create user profile
      await tx.userProfile.create({
        data: {
          userId: user.id,
        },
      });

      // Create teacher
      const teacher = await tx.teacher.create({
        data: {
          userId: user.id,
          organizationId,
          hourlyRate,
          contractType,
          specializations: specializations || [],
          languages: languages || [],
          bio,
        },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
              phone: true,
              avatarUrl: true,
              isActive: true,
            },
          },
        },
      });

      return teacher;
    });

    return result;
  }

  async getTeachers(organizationId: string, filters?: {
    search?: string;
    isActive?: boolean;
    isAvailableForBooking?: boolean;
  }) {
    const where: any = { organizationId };

    if (filters?.search) {
      where.user = {
        OR: [
          { firstName: { contains: filters.search, mode: 'insensitive' } },
          { lastName: { contains: filters.search, mode: 'insensitive' } },
          { email: { contains: filters.search, mode: 'insensitive' } },
        ],
      };
    }

    if (filters?.isActive !== undefined) {
      where.user = {
        ...where.user,
        isActive: filters.isActive,
      };
    }

    if (filters?.isAvailableForBooking !== undefined) {
      where.isAvailableForBooking = filters.isAvailableForBooking;
    }

    const teachers = await prisma.teacher.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            phone: true,
            avatarUrl: true,
            isActive: true,
            createdAt: true,
          },
        },
        availability: true,
        _count: {
          select: {
            courses: true,
            lessons: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return teachers;
  }

  async getTeacherById(id: string, organizationId: string) {
    const teacher = await prisma.teacher.findFirst({
      where: {
        id,
        organizationId,
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            phone: true,
            avatarUrl: true,
            isActive: true,
            createdAt: true,
            profile: true,
          },
        },
        availability: true,
        courses: {
          include: {
            courseType: true,
            _count: {
              select: {
                enrollments: true,
              },
            },
          },
        },
        lessons: {
          take: 10,
          orderBy: { scheduledAt: 'desc' },
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
        },
        payouts: {
          take: 5,
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!teacher) {
      throw new Error('Teacher not found');
    }

    return teacher;
  }

  async updateTeacher(id: string, organizationId: string, data: UpdateTeacherData) {
    const teacher = await prisma.teacher.findFirst({
      where: { id, organizationId },
      include: { user: true },
    });

    if (!teacher) {
      throw new Error('Teacher not found');
    }

    const result = await prisma.$transaction(async (tx) => {
      // Update user data
      if (data.firstName || data.lastName || data.phone || data.email || data.isActive !== undefined) {
        await tx.user.update({
          where: { id: teacher.userId },
          data: {
            firstName: data.firstName,
            lastName: data.lastName,
            phone: data.phone,
            email: data.email,
            isActive: data.isActive,
          },
        });
      }

      // Update teacher
      const updatedTeacher = await tx.teacher.update({
        where: { id },
        data: {
          hourlyRate: data.hourlyRate,
          contractType: data.contractType,
          specializations: data.specializations,
          languages: data.languages,
          bio: data.bio,
          isAvailableForBooking: data.isAvailableForBooking,
        },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
              phone: true,
              avatarUrl: true,
              isActive: true,
            },
          },
        },
      });

      return updatedTeacher;
    });

    return result;
  }

  async deleteTeacher(id: string, organizationId: string) {
    const teacher = await prisma.teacher.findFirst({
      where: { id, organizationId },
    });

    if (!teacher) {
      throw new Error('Teacher not found');
    }

    // Check if teacher has active lessons
    const activeLessons = await prisma.lesson.count({
      where: {
        teacherId: id,
        scheduledAt: { gte: new Date() },
        status: { in: ['SCHEDULED', 'CONFIRMED'] },
      },
    });

    if (activeLessons > 0) {
      throw new Error(`Cannot delete teacher with ${activeLessons} active lessons`);
    }

    // Soft delete: deactivate user
    await prisma.user.update({
      where: { id: teacher.userId },
      data: { isActive: false },
    });

    return { success: true, message: 'Teacher deactivated' };
  }

  async getTeacherStats(organizationId: string) {
    const totalTeachers = await prisma.teacher.count({
      where: { organizationId },
    });

    const activeTeachers = await prisma.teacher.count({
      where: {
        organizationId,
        user: { isActive: true },
      },
    });

    const availableTeachers = await prisma.teacher.count({
      where: {
        organizationId,
        isAvailableForBooking: true,
        user: { isActive: true },
      },
    });

    return {
      total: totalTeachers,
      active: activeTeachers,
      available: availableTeachers,
    };
  }

  async setAvailability(
    teacherId: string,
    organizationId: string,
    availability: Array<{
      dayOfWeek: number;
      startTime: string;
      endTime: string;
    }>
  ) {
    const teacher = await prisma.teacher.findFirst({
      where: { id: teacherId, organizationId },
    });

    if (!teacher) {
      throw new Error('Teacher not found');
    }

    // Delete existing availability and create new ones
    await prisma.$transaction(async (tx) => {
      // Delete old availability
      await tx.teacherAvailability.deleteMany({
        where: { teacherId },
      });

      // Create new availability
      if (availability.length > 0) {
        await tx.teacherAvailability.createMany({
          data: availability.map((slot) => ({
            teacherId,
            dayOfWeek: slot.dayOfWeek,
            startTime: slot.startTime,
            endTime: slot.endTime,
          })),
        });
      }
    });

    return { success: true, message: 'Availability updated' };
  }

  // ============================================
  // TEACHER SCHEDULE MANAGEMENT
  // ============================================

  async getTeacherByUserId(userId: string) {
    const teacher = await prisma.teacher.findUnique({
      where: { userId },
      include: {
        user: true,
        availability: true,
      },
    });

    return teacher;
  }

  async getTeacherSchedule(teacherId: string, startDate: Date, endDate: Date) {
    const lessons = await prisma.lesson.findMany({
      where: {
        teacherId,
        scheduledAt: {
          gte: startDate,
          lte: endDate,
        },
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
                phone: true,
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
        attendances: true,
      },
      orderBy: {
        scheduledAt: 'asc',
      },
    });

    return lessons;
  }

  async getAvailabilityExceptions(teacherId: string, startDate?: Date, endDate?: Date) {
    const where: any = { teacherId };

    if (startDate || endDate) {
      where.OR = [];
      if (startDate) {
        where.OR.push({ startDate: { gte: startDate } });
        where.OR.push({ endDate: { gte: startDate } });
      }
      if (endDate) {
        where.OR.push({ startDate: { lte: endDate } });
      }
    }

    const exceptions = await prisma.teacherAvailabilityException.findMany({
      where,
      orderBy: {
        startDate: 'asc',
      },
    });

    return exceptions;
  }

  async addAvailabilityException(
    teacherId: string,
    startDate: Date,
    endDate: Date,
    reason?: string
  ) {
    const exception = await prisma.teacherAvailabilityException.create({
      data: {
        teacherId,
        startDate,
        endDate,
        reason,
      },
    });

    return exception;
  }

  async deleteAvailabilityException(exceptionId: string) {
    await prisma.teacherAvailabilityException.delete({
      where: { id: exceptionId },
    });

    return { success: true, message: 'Exception deleted' };
  }

  async getTeacherPreferences(teacherId: string) {
    let preferences = await prisma.teacherSchedulePreferences.findUnique({
      where: { teacherId },
    });

    // If no preferences exist, create default ones
    if (!preferences) {
      preferences = await prisma.teacherSchedulePreferences.create({
        data: {
          teacherId,
          timezone: 'Europe/Warsaw',
          prepTimeMinutes: 0,
          minBreakBetweenMinutes: 0,
        },
      });
    }

    return preferences;
  }

  async updateTeacherPreferences(
    teacherId: string,
    data: {
      timezone?: string;
      prepTimeMinutes?: number;
      maxLessonsPerDay?: number;
      minBreakBetweenMinutes?: number;
    }
  ) {
    const preferences = await prisma.teacherSchedulePreferences.upsert({
      where: { teacherId },
      update: data,
      create: {
        teacherId,
        ...data,
      },
    });

    return preferences;
  }

  async checkAvailabilityConflicts(teacherId: string, date: Date) {
    // Check if date falls within any exception
    const exceptions = await prisma.teacherAvailabilityException.findMany({
      where: {
        teacherId,
        startDate: { lte: date },
        endDate: { gte: date },
      },
    });

    return {
      hasConflict: exceptions.length > 0,
      exceptions,
    };
  }
}

export default new TeacherService();
