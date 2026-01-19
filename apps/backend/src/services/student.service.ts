import prisma from '../utils/prisma';
import { LanguageLevel, UserRole } from '@prisma/client';
import bcrypt from 'bcrypt';
import { parse } from 'csv-parse/sync';
import { organizationService, VisibilitySettings } from './organization.service';

interface CreateStudentData {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phone?: string;
  dateOfBirth?: string;
  address?: string;
  languageLevel: LanguageLevel;
  language?: string; // Language being learned (ISO 639-1 code)
  goals?: string;
  isMinor?: boolean;
  paymentDueDays?: number | null;
  paymentDueDayOfMonth?: number | null;
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
  language?: string; // Language being learned
  goals?: string;
  isMinor?: boolean;
  paymentDueDays?: number | null;
  paymentDueDayOfMonth?: number | null;
  // Cancellation fee settings
  cancellationFeeEnabled?: boolean;
  cancellationHoursThreshold?: number | null;
  cancellationFeePercent?: number | null;
  // Cancellation limit settings
  cancellationLimitEnabled?: boolean;
  cancellationLimitCount?: number | null;
  cancellationLimitPeriod?: string | null;
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
      language,
      goals,
      isMinor,
      paymentDueDays,
      paymentDueDayOfMonth,
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
          language,
          goals,
          isMinor: isMinor || false,
          paymentDueDays,
          paymentDueDayOfMonth,
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
          language: data.language,
          goals: data.goals,
          isMinor: data.isMinor,
          paymentDueDays: data.paymentDueDays,
          paymentDueDayOfMonth: data.paymentDueDayOfMonth,
          // Cancellation fee settings
          cancellationFeeEnabled: data.cancellationFeeEnabled,
          cancellationHoursThreshold: data.cancellationHoursThreshold,
          cancellationFeePercent: data.cancellationFeePercent,
          // Cancellation limit settings
          cancellationLimitEnabled: data.cancellationLimitEnabled,
          cancellationLimitCount: data.cancellationLimitCount,
          cancellationLimitPeriod: data.cancellationLimitPeriod,
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

      // Recalculate dueAt for all PENDING payments when payment terms change
      if (data.paymentDueDays !== undefined || data.paymentDueDayOfMonth !== undefined) {
        await this.recalculatePaymentDueDates(
          tx,
          id,
          updatedStudent.paymentDueDays,
          updatedStudent.paymentDueDayOfMonth
        );
      }

      return updatedStudent;
    });

    return result;
  }

  /**
   * Recalculate dueAt for all PENDING payments when student's payment terms change
   */
  private async recalculatePaymentDueDates(
    tx: any,
    studentId: string,
    paymentDueDays: number | null,
    paymentDueDayOfMonth: number | null
  ) {
    // Get all PENDING payments for this student with their associated lesson
    const pendingPayments = await tx.payment.findMany({
      where: {
        studentId,
        status: 'PENDING',
      },
      include: {
        lesson: {
          select: {
            completedAt: true,
          },
        },
      },
    });

    // Recalculate dueAt for each payment
    for (const payment of pendingPayments) {
      // Use lesson completedAt if available, otherwise use payment createdAt
      const referenceDate = payment.lesson?.completedAt || payment.createdAt;
      let newDueAt: Date;

      if (paymentDueDayOfMonth) {
        // PRIORITY 1: Fixed day of month
        newDueAt = new Date(referenceDate);
        newDueAt.setDate(paymentDueDayOfMonth);

        // If the target day has already passed relative to the reference date,
        // move to next month
        if (newDueAt <= referenceDate) {
          newDueAt.setMonth(newDueAt.getMonth() + 1);
        }

        // Handle edge case: if target day doesn't exist in the month
        // JavaScript automatically adjusts to the next valid date
      } else if (paymentDueDays) {
        // PRIORITY 2: X days from reference date
        newDueAt = new Date(referenceDate);
        newDueAt.setDate(newDueAt.getDate() + paymentDueDays);
      } else {
        // PRIORITY 3: No term = immediate debtor (use reference date)
        newDueAt = referenceDate;
      }

      // Update payment with new dueAt
      await tx.payment.update({
        where: { id: payment.id },
        data: { dueAt: newDueAt },
      });
    }
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

  /**
   * Import students from CSV file
   */
  async importStudentsFromCSV(
    csvContent: string,
    columnMapping: Record<string, string>,
    organizationId: string
  ) {
    // Parse CSV
    const records = parse(csvContent, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
    });

    const results = {
      total: records.length,
      successful: 0,
      failed: 0,
      errors: [] as Array<{ row: number; email: string; error: string }>,
    };

    // Process each row
    for (let i = 0; i < records.length; i++) {
      const row = records[i] as any;
      const rowNumber = i + 2; // +2 because: 1 for header, 1 for 0-based index

      try {
        // Validate required fields
        const email = row[columnMapping.email]?.trim();
        const firstName = row[columnMapping.firstName]?.trim();
        const lastName = row[columnMapping.lastName]?.trim();
        const languageLevelRaw = row[columnMapping.languageLevel]?.trim().toUpperCase();

        if (!email || !firstName || !lastName) {
          throw new Error('Email, imię i nazwisko są wymagane');
        }

        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
          throw new Error('Nieprawidłowy format email');
        }

        // Validate language level
        const validLevels = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
        const languageLevel = languageLevelRaw && validLevels.includes(languageLevelRaw)
          ? (languageLevelRaw as LanguageLevel)
          : 'A1'; // Default to A1 if not provided or invalid

        // Check if user already exists
        const existingUser = await prisma.user.findUnique({
          where: { email },
        });

        if (existingUser) {
          throw new Error('Użytkownik z tym emailem już istnieje');
        }

        // Generate default password (can be changed later)
        const defaultPassword = 'LingoDesk2024!';
        const passwordHash = await bcrypt.hash(defaultPassword, 10);

        // Parse optional fields
        const phone = row[columnMapping.phone]?.trim() || undefined;
        const dateOfBirth = row[columnMapping.dateOfBirth]?.trim() || undefined;
        const address = row[columnMapping.address]?.trim() || undefined;
        const goals = row[columnMapping.goals]?.trim() || undefined;
        const isMinor = row[columnMapping.isMinor]?.trim().toLowerCase() === 'true' ||
                       row[columnMapping.isMinor]?.trim().toLowerCase() === 'tak' ||
                       row[columnMapping.isMinor]?.trim() === '1';

        // Parse payment terms
        const paymentDueDays = row[columnMapping.paymentDueDays]?.trim()
          ? parseInt(row[columnMapping.paymentDueDays])
          : undefined;
        const paymentDueDayOfMonth = row[columnMapping.paymentDueDayOfMonth]?.trim()
          ? parseInt(row[columnMapping.paymentDueDayOfMonth])
          : undefined;

        // Generate student number
        const lastStudent = await prisma.student.findFirst({
          where: { organizationId },
          orderBy: { studentNumber: 'desc' },
        });

        const studentNumber = lastStudent
          ? String(parseInt(lastStudent.studentNumber) + 1).padStart(6, '0')
          : '000001';

        // Create student in transaction
        await prisma.$transaction(async (tx) => {
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
              isMinor,
              paymentDueDays,
              paymentDueDayOfMonth,
            },
          });

          // Create empty budget
          await tx.studentBudget.create({
            data: {
              studentId: student.id,
              organizationId,
            },
          });
        });

        results.successful++;
      } catch (error: any) {
        results.failed++;
        results.errors.push({
          row: rowNumber,
          email: row[columnMapping.email] || 'N/A',
          error: error.message,
        });
      }
    }

    return results;
  }

  /**
   * Preview CSV file and suggest column mappings
   */
  async previewCSV(csvContent: string) {
    // Parse first 5 rows for preview
    const records = parse(csvContent, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
      to: 5, // Only parse first 5 rows
    }) as any;

    if (records.length === 0) {
      throw new Error('Plik CSV jest pusty lub nieprawidłowy');
    }

    // Get column headers
    const headers = Object.keys(records[0]);

    // Suggest mappings based on common column names
    const suggestedMapping: Record<string, string> = {};
    const commonMappings: Record<string, string[]> = {
      email: ['email', 'e-mail', 'mail', 'adres email'],
      firstName: ['firstname', 'first name', 'imię', 'imie', 'name'],
      lastName: ['lastname', 'last name', 'nazwisko', 'surname'],
      phone: ['phone', 'telefon', 'tel', 'mobile', 'phone number'],
      dateOfBirth: ['dateofbirth', 'date of birth', 'birth date', 'data urodzenia', 'dob'],
      address: ['address', 'adres', 'street', 'ulica'],
      languageLevel: ['languagelevel', 'language level', 'level', 'poziom'],
      goals: ['goals', 'cele', 'notes', 'uwagi'],
      isMinor: ['isminor', 'minor', 'is minor', 'nieletni', 'nieletniosc'],
      paymentDueDays: ['paymentduedays', 'payment due days', 'dni płatności', 'termin płatności (dni)'],
      paymentDueDayOfMonth: ['paymentduedayofmonth', 'payment day of month', 'dzień płatności', 'termin płatności (dzień)'],
    };

    for (const header of headers) {
      const normalizedHeader = header.toLowerCase().replace(/[^a-z0-9]/g, '');

      for (const [field, patterns] of Object.entries(commonMappings)) {
        if (patterns.some(pattern => normalizedHeader.includes(pattern.toLowerCase().replace(/[^a-z0-9]/g, '')))) {
          suggestedMapping[field] = header;
          break;
        }
      }
    }

    return {
      headers,
      preview: records,
      suggestedMapping,
    };
  }

  /**
   * Filter student data based on visibility settings for manager role
   */
  filterStudentForManager(student: any, visibility: VisibilitySettings['student']): any {
    const filtered = { ...student };

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

    // Filter address
    if (!visibility.address && filtered.user?.profile) {
      filtered.user = { ...filtered.user, profile: { ...filtered.user.profile } };
      delete filtered.user.profile.address;
    }

    // Filter dateOfBirth
    if (!visibility.dateOfBirth && filtered.user?.profile) {
      filtered.user = { ...filtered.user, profile: { ...filtered.user.profile } };
      delete filtered.user.profile.dateOfBirth;
    }

    // Filter goals/notes
    if (!visibility.notes) {
      delete filtered.goals;
    }

    // Filter payments
    if (!visibility.payments) {
      delete filtered.payments;
    }

    // Filter budget
    if (!visibility.budget) {
      delete filtered.budget;
    }

    return filtered;
  }

  /**
   * Get students with visibility filtering based on user role
   */
  async getStudentsWithVisibility(
    organizationId: string,
    userRole: UserRole,
    filters?: { search?: string; languageLevel?: LanguageLevel; isActive?: boolean }
  ) {
    const students = await this.getStudents(organizationId, filters);

    // ADMIN sees everything
    if (userRole === UserRole.ADMIN) {
      return students;
    }

    // MANAGER - apply visibility settings
    if (userRole === UserRole.MANAGER) {
      const visibility = await organizationService.getVisibilitySettings(organizationId);
      return students.map(student => this.filterStudentForManager(student, visibility.student));
    }

    // Other roles - return basic info
    return students.map(student => ({
      id: student.id,
      studentNumber: student.studentNumber,
      user: {
        id: student.user.id,
        firstName: student.user.firstName,
        lastName: student.user.lastName,
        avatarUrl: student.user.avatarUrl,
      },
      languageLevel: student.languageLevel,
      language: student.language,
    }));
  }

  /**
   * Get single student with visibility filtering based on user role
   */
  async getStudentByIdWithVisibility(id: string, organizationId: string, userRole: UserRole) {
    const student = await this.getStudentById(id, organizationId);

    // ADMIN sees everything
    if (userRole === UserRole.ADMIN) {
      return student;
    }

    // MANAGER - apply visibility settings
    if (userRole === UserRole.MANAGER) {
      const visibility = await organizationService.getVisibilitySettings(organizationId);
      return this.filterStudentForManager(student, visibility.student);
    }

    return student;
  }
}

export default new StudentService();
