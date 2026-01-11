import prisma from '../utils/prisma';
import { LanguageLevel, UserRole } from '@prisma/client';
import bcrypt from 'bcrypt';

interface CreateStudentData {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phone?: string;
  dateOfBirth?: string;
  address?: string;
  languageLevel: LanguageLevel;
  goals?: string;
  isMinor?: boolean;
  paymentDueDays?: number;
  organizationId: string;
}

interface UpdateStudentData {
  firstName?: string;
  lastName?: string;
  phone?: string;
  email?: string;
  dateOfBirth?: string;
  address?: string;
  languageLevel?: LanguageLevel;
  goals?: string;
  isMinor?: boolean;
  paymentDueDays?: number;
  isActive?: boolean;
}

export class StudentService {
  async createStudent(data: CreateStudentData) {
    const {
      email,
      password,
      firstName,
      lastName,
      phone,
      dateOfBirth,
      address,
      languageLevel,
      goals,
      isMinor,
      paymentDueDays,
      organizationId
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

    // Generate student number (simple increment)
    const lastStudent = await prisma.student.findFirst({
      where: { organizationId },
      orderBy: { studentNumber: 'desc' },
    });

    const studentNumber = lastStudent
      ? String(parseInt(lastStudent.studentNumber) + 1).padStart(6, '0')
      : '000001';

    // Create user, student, and profile in a transaction
    const result = await prisma.$transaction(async (tx) => {
      // Create user
      const user = await tx.user.create({
        data: {
          email,
          passwordHash,
          firstName,
          lastName,
          phone,
          role: UserRole.STUDENT,
          organizationId,
        },
      });

      // Create user profile
      await tx.userProfile.create({
        data: {
          userId: user.id,
          dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : undefined,
          address,
        },
      });

      // Create student
      const student = await tx.student.create({
        data: {
          userId: user.id,
          organizationId,
          studentNumber,
          languageLevel,
          goals,
          isMinor: isMinor || false,
          paymentDueDays,
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

      // Create empty budget
      await tx.studentBudget.create({
        data: {
          studentId: student.id,
          organizationId,
        },
      });

      return student;
    });

    return result;
  }

  async getStudents(organizationId: string, filters?: {
    search?: string;
    languageLevel?: LanguageLevel;
    isActive?: boolean;
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

    if (filters?.languageLevel) {
      where.languageLevel = filters.languageLevel;
    }

    if (filters?.isActive !== undefined) {
      where.user = {
        ...where.user,
        isActive: filters.isActive,
      };
    }

    const students = await prisma.student.findMany({
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
        budget: true,
        enrollments: {
          where: { status: 'ACTIVE' },
          include: {
            course: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
      orderBy: {
        studentNumber: 'desc',
      },
    });

    return students;
  }

  async getStudentById(id: string, organizationId: string) {
    const student = await prisma.student.findFirst({
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
        budget: true,
        enrollments: {
          include: {
            course: true,
            package: true,
            subscription: true,
          },
        },
        lessons: {
          take: 10,
          orderBy: { scheduledAt: 'desc' },
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
          },
        },
        payments: {
          take: 10,
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!student) {
      throw new Error('Student not found');
    }

    return student;
  }

  async updateStudent(id: string, organizationId: string, data: UpdateStudentData) {
    const student = await prisma.student.findFirst({
      where: { id, organizationId },
      include: { user: true },
    });

    if (!student) {
      throw new Error('Student not found');
    }

    const result = await prisma.$transaction(async (tx) => {
      // Update user data
      if (data.firstName || data.lastName || data.phone || data.email || data.isActive !== undefined) {
        await tx.user.update({
          where: { id: student.userId },
          data: {
            firstName: data.firstName,
            lastName: data.lastName,
            phone: data.phone,
            email: data.email,
            isActive: data.isActive,
          },
        });
      }

      // Update profile
      if (data.dateOfBirth || data.address) {
        await tx.userProfile.update({
          where: { userId: student.userId },
          data: {
            dateOfBirth: data.dateOfBirth ? new Date(data.dateOfBirth) : undefined,
            address: data.address,
          },
        });
      }

      // Update student
      const updatedStudent = await tx.student.update({
        where: { id },
        data: {
          languageLevel: data.languageLevel,
          goals: data.goals,
          isMinor: data.isMinor,
          paymentDueDays: data.paymentDueDays,
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
          budget: true,
        },
      });

      return updatedStudent;
    });

    return result;
  }

  async deleteStudent(id: string, organizationId: string) {
    const student = await prisma.student.findFirst({
      where: { id, organizationId },
    });

    if (!student) {
      throw new Error('Student not found');
    }

    // Soft delete: deactivate user instead of hard delete
    await prisma.user.update({
      where: { id: student.userId },
      data: { isActive: false },
    });

    return { success: true, message: 'Student deactivated' };
  }

  async getStudentStats(organizationId: string) {
    const totalStudents = await prisma.student.count({
      where: { organizationId },
    });

    const activeStudents = await prisma.student.count({
      where: {
        organizationId,
        user: { isActive: true },
      },
    });

    // Count students with low budget by checking enrollments
    const enrollments = await prisma.studentEnrollment.findMany({
      where: {
        course: { organizationId },
        status: 'ACTIVE',
      },
    });

    const studentsWithLowBudget = enrollments.filter((enrollment) => {
      const hoursPurchased = parseFloat(enrollment.hoursPurchased.toString());
      const hoursUsed = parseFloat(enrollment.hoursUsed.toString());
      const hoursRemaining = hoursPurchased - hoursUsed;
      return hoursRemaining <= 2 && hoursRemaining > 0;
    }).length;

    return {
      total: totalStudents,
      active: activeStudents,
      lowBudget: studentsWithLowBudget,
    };
  }

  /**
   * Get enrollment budget information
   */
  async getEnrollmentBudget(enrollmentId: string, organizationId: string) {
    const enrollment = await prisma.studentEnrollment.findFirst({
      where: {
        id: enrollmentId,
        course: { organizationId },
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
        course: {
          select: {
            name: true,
          },
        },
      },
    });

    if (!enrollment) {
      throw new Error('Enrollment not found');
    }

    const hoursPurchased = parseFloat(enrollment.hoursPurchased.toString());
    const hoursUsed = parseFloat(enrollment.hoursUsed.toString());
    const hoursRemaining = hoursPurchased - hoursUsed;

    return {
      enrollmentId: enrollment.id,
      studentName: `${enrollment.student.user.firstName} ${enrollment.student.user.lastName}`,
      courseName: enrollment.course?.name || 'N/A',
      hoursPurchased,
      hoursUsed,
      hoursRemaining,
      lowBudget: hoursRemaining <= 2,
      status: enrollment.status,
      enrollmentDate: enrollment.enrollmentDate,
      expiresAt: enrollment.expiresAt,
    };
  }
}

export default new StudentService();
