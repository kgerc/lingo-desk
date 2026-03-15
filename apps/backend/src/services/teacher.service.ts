import prisma from '../utils/prisma';
import { ContractType, UserRole } from '@prisma/client';
import bcrypt from 'bcrypt';
import { organizationService, VisibilitySettings } from './organization.service';

interface CreateTeacherData {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phone?: string;
  hourlyRate: number;
  contractType?: ContractType;
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
  cancellationPayoutEnabled?: boolean;
  cancellationPayoutHours?: number | null;
  cancellationPayoutPercent?: number | null;
}

function buildTeacherOrderBy(sortBy?: string, sortOrder: 'asc' | 'desc' = 'asc'): any {
  if (sortBy === 'lastName') return { user: { lastName: sortOrder } };
  if (sortBy === 'email') return { user: { email: sortOrder } };
  if (sortBy === 'hourlyRate') return { hourlyRate: sortOrder };
  if (sortBy === 'createdAt') return { createdAt: sortOrder };
  return { createdAt: 'desc' }; // default: newest first
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
    hourlyRateMin?: number;
    hourlyRateMax?: number;
    contractType?: ContractType;
    language?: string;
    sortBy?: 'lastName' | 'hourlyRate' | 'createdAt' | 'email';
    sortOrder?: 'asc' | 'desc';
    page?: number;
    pageSize?: number;
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

    if (filters?.hourlyRateMin !== undefined || filters?.hourlyRateMax !== undefined) {
      where.hourlyRate = {};
      if (filters.hourlyRateMin !== undefined) where.hourlyRate.gte = filters.hourlyRateMin;
      if (filters.hourlyRateMax !== undefined) where.hourlyRate.lte = filters.hourlyRateMax;
    }

    if (filters?.contractType) {
      where.contractType = filters.contractType;
    }

    if (filters?.language) {
      where.languages = { has: filters.language };
    }

    const safePage = Math.max(1, filters?.page ?? 1);
    const safePageSize = Math.min(Math.max(1, filters?.pageSize ?? 10), 100);
    const skip = (safePage - 1) * safePageSize;

    const [total, teachers] = await Promise.all([
      prisma.teacher.count({ where }),
      prisma.teacher.findMany({
        where,
        skip,
        take: safePageSize,
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
          _count: {
            select: {
              courses: true,
              lessons: true,
            },
          },
        },
        orderBy: buildTeacherOrderBy(filters?.sortBy, filters?.sortOrder),
      }),
    ]);

    const totalPages = Math.ceil(total / safePageSize);
    return {
      data: teachers,
      pagination: {
        page: safePage,
        pageSize: safePageSize,
        total,
        totalPages,
        hasMore: safePage < totalPages,
      },
    };
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
        courses: {
          include: {
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
      const userUpdateData: Record<string, any> = {};
      if (data.firstName !== undefined) userUpdateData.firstName = data.firstName;
      if (data.lastName !== undefined) userUpdateData.lastName = data.lastName;
      if (data.phone !== undefined) userUpdateData.phone = data.phone;
      if (data.email !== undefined) userUpdateData.email = data.email;
      if (data.isActive !== undefined) userUpdateData.isActive = data.isActive;

      if (Object.keys(userUpdateData).length > 0) {
        await tx.user.update({
          where: { id: teacher.userId },
          data: userUpdateData,
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
          cancellationPayoutEnabled: data.cancellationPayoutEnabled,
          cancellationPayoutHours: data.cancellationPayoutHours,
          cancellationPayoutPercent: data.cancellationPayoutPercent,
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
        status: { in: ['CONFIRMED'] },
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

  async deleteTeacherWithCascade(id: string, organizationId: string) {
    const teacher = await prisma.teacher.findFirst({
      where: { id, organizationId },
    });

    if (!teacher) {
      throw new Error('Teacher not found');
    }

    // Cancel all future lessons
    await prisma.lesson.updateMany({
      where: {
        teacherId: id,
        scheduledAt: { gte: new Date() },
        status: { in: ['CONFIRMED'] },
      },
      data: { status: 'CANCELLED_ON_TIME' },
    });

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

  async getTeacherByUserId(userId: string) {
    const teacher = await prisma.teacher.findUnique({
      where: { userId },
      include: {
        user: true,
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

  /**
   * Filter teacher data based on visibility settings for manager role
   */
  filterTeacherForManager(teacher: any, visibility: VisibilitySettings['teacher']): any {
    const filtered = { ...teacher };

    // Filter hourlyRate
    if (!visibility.hourlyRate) {
      delete filtered.hourlyRate;
    }

    // Filter contractType
    if (!visibility.contractType) {
      delete filtered.contractType;
    }

    // Filter user email
    if (!visibility.email && filtered.user) {
      filtered.user = { ...filtered.user };
      delete filtered.user.email;
    }

    // Filter user phone
    if (!visibility.phone && filtered.user) {
      filtered.user = { ...filtered.user };
      delete filtered.user.phone;
    }

    // Filter bio/notes
    if (!visibility.notes) {
      delete filtered.bio;
    }

    // Filter payouts
    if (!visibility.payouts) {
      delete filtered.payouts;
    }

    return filtered;
  }

  /**
   * Get teachers with visibility filtering based on user role
   */
  async getTeachersWithVisibility(
    organizationId: string,
    userRole: UserRole,
    filters?: { search?: string; isActive?: boolean; isAvailableForBooking?: boolean; hourlyRateMin?: number; hourlyRateMax?: number; contractType?: ContractType; language?: string; sortBy?: 'lastName' | 'hourlyRate' | 'createdAt' | 'email'; sortOrder?: 'asc' | 'desc'; page?: number; pageSize?: number }
  ) {
    const result = await this.getTeachers(organizationId, filters);

    // ADMIN sees everything
    if (userRole === UserRole.ADMIN) {
      return result;
    }

    // MANAGER - apply visibility settings
    if (userRole === UserRole.MANAGER) {
      const visibility = await organizationService.getVisibilitySettings(organizationId);
      return { ...result, data: result.data.map(teacher => this.filterTeacherForManager(teacher, visibility.teacher)) };
    }

    // Other roles - return basic info
    return {
      ...result,
      data: result.data.map(teacher => ({
        id: teacher.id,
        user: {
          id: teacher.user.id,
          firstName: teacher.user.firstName,
          lastName: teacher.user.lastName,
          avatarUrl: teacher.user.avatarUrl,
        },
        isAvailableForBooking: teacher.isAvailableForBooking,
      })),
    };
  }

  /**
   * Get single teacher with visibility filtering based on user role
   */
  async getTeacherByIdWithVisibility(id: string, organizationId: string, userRole: UserRole) {
    const teacher = await this.getTeacherById(id, organizationId);

    // ADMIN sees everything
    if (userRole === UserRole.ADMIN) {
      return teacher;
    }

    // MANAGER - apply visibility settings
    if (userRole === UserRole.MANAGER) {
      const visibility = await organizationService.getVisibilitySettings(organizationId);
      return this.filterTeacherForManager(teacher, visibility.teacher);
    }

    return teacher;
  }
}

export default new TeacherService();
