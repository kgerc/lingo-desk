import prisma from '../utils/prisma';
import { ApplicationStatus, AlertType, LanguageLevel } from '@prisma/client';
import studentService from './student.service';

interface CreateApplicationData {
  name: string;
  email: string;
  phone?: string;
  courseId?: string;
  preferences?: string;
  languageLevel?: string;
  availability?: string;
  notes?: string;
}

interface ApplicationFilters {
  status?: ApplicationStatus;
  search?: string;
}

class CourseApplicationService {
  /**
   * Get all applications for an organization
   */
  async getApplications(organizationId: string, filters?: ApplicationFilters) {
    const where: any = { organizationId };

    if (filters?.status) {
      where.status = filters.status;
    }

    if (filters?.search) {
      where.OR = [
        { name: { contains: filters.search, mode: 'insensitive' } },
        { email: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    return prisma.courseApplication.findMany({
      where,
      include: {
        course: {
          select: {
            id: true,
            name: true,
            language: true,
            level: true,
            courseType: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Get application by ID
   */
  async getApplicationById(id: string, organizationId: string) {
    const application = await prisma.courseApplication.findFirst({
      where: { id, organizationId },
      include: {
        course: {
          select: {
            id: true,
            name: true,
            language: true,
            level: true,
            courseType: true,
          },
        },
      },
    });

    if (!application) {
      throw new Error('Zgłoszenie nie zostało znalezione');
    }

    return application;
  }

  /**
   * Create a public application (no auth required)
   */
  async createPublicApplication(orgSlug: string, data: CreateApplicationData) {
    // Find organization by slug
    const organization = await prisma.organization.findUnique({
      where: { slug: orgSlug },
    });

    if (!organization) {
      throw new Error('Nie znaleziono szkoły');
    }

    // Validate courseId belongs to this organization (if provided)
    if (data.courseId) {
      const course = await prisma.course.findFirst({
        where: { id: data.courseId, organizationId: organization.id, isActive: true },
      });
      if (!course) {
        data.courseId = undefined;
      }
    }

    // Create application
    const application = await prisma.courseApplication.create({
      data: {
        organizationId: organization.id,
        name: data.name,
        email: data.email,
        phone: data.phone || null,
        courseId: data.courseId || null,
        preferences: data.preferences || null,
        languageLevel: data.languageLevel || null,
        availability: data.availability || null,
        notes: data.notes || null,
      },
    });

    // Create alert for admins/managers
    await prisma.alert.create({
      data: {
        organizationId: organization.id,
        type: AlertType.INFO,
        title: 'Nowe zgłoszenie na kurs',
        message: `${data.name} (${data.email}) złożył(a) zgłoszenie na kurs.`,
        metadata: {
          applicationId: application.id,
          applicantName: data.name,
          applicantEmail: data.email,
        },
      },
    });

    return application;
  }

  /**
   * Get public courses for application form dropdown
   */
  async getPublicCourses(orgSlug: string) {
    const organization = await prisma.organization.findUnique({
      where: { slug: orgSlug },
      select: { id: true, name: true, logoUrl: true, primaryColor: true },
    });

    if (!organization) {
      throw new Error('Nie znaleziono szkoły');
    }

    const courses = await prisma.course.findMany({
      where: {
        organizationId: organization.id,
        isActive: true,
      },
      select: {
        id: true,
        name: true,
        language: true,
        level: true,
        courseType: true,
      },
      orderBy: { name: 'asc' },
    });

    return { organization, courses };
  }

  /**
   * Update application status
   */
  async updateStatus(
    id: string,
    organizationId: string,
    status: ApplicationStatus,
    internalNotes?: string,
  ) {
    const application = await this.getApplicationById(id, organizationId);

    return prisma.courseApplication.update({
      where: { id: application.id },
      data: {
        status,
        internalNotes: internalNotes ?? application.internalNotes,
      },
      include: {
        course: {
          select: {
            id: true,
            name: true,
            language: true,
            level: true,
            courseType: true,
          },
        },
      },
    });
  }

  /**
   * Convert application to student
   */
  async convertToStudent(
    id: string,
    organizationId: string,
    studentData: {
      firstName: string;
      lastName: string;
      email: string;
      password: string;
      phone?: string;
      languageLevel?: string;
      language?: string;
    },
  ) {
    const application = await this.getApplicationById(id, organizationId);

    if (application.convertedStudentId) {
      throw new Error('To zgłoszenie zostało już przekonwertowane na ucznia');
    }

    // Create student using existing studentService
    const student = await studentService.createStudent({
      ...studentData,
      organizationId,
      languageLevel: (studentData.languageLevel || 'A1') as LanguageLevel,
      language: studentData.language || 'en',
    });

    // Update application with converted student ID
    await prisma.courseApplication.update({
      where: { id: application.id },
      data: {
        convertedStudentId: student.id,
        status: ApplicationStatus.ACCEPTED,
      },
    });

    return { student, application };
  }
}

export default new CourseApplicationService();
