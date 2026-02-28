import prisma from '../utils/prisma';
import { ApplicationStatus, AlertType, LanguageLevel } from '@prisma/client';
import studentService from './student.service';
import emailService from './email.service';
import courseService from './course.service';

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

    // Get course name for email (if provided)
    let courseName: string | undefined;
    if (data.courseId) {
      const course = await prisma.course.findFirst({
        where: { id: data.courseId },
        select: { name: true },
      });
      courseName = course?.name;
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

    // Send confirmation email to applicant
    try {
      await emailService.sendApplicationConfirmation({
        applicantEmail: data.email,
        applicantName: data.name,
        organizationName: organization.name,
        courseName,
      });
    } catch (emailError) {
      console.error('Failed to send application confirmation email:', emailError);
    }

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

    const updated = await prisma.courseApplication.update({
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

    // Send status change email only when accepting or rejecting
    if (status === ApplicationStatus.ACCEPTED || status === ApplicationStatus.REJECTED) {
      try {
        const organization = await prisma.organization.findUnique({
          where: { id: organizationId },
          select: { name: true },
        });

        if (organization) {
          await emailService.sendApplicationStatusChange({
            applicantEmail: application.email,
            applicantName: application.name,
            organizationName: organization.name,
            status,
            courseName: updated.course?.name,
            internalNotes: updated.internalNotes,
          });
        }
      } catch (emailError) {
        console.error('Failed to send application status change email:', emailError);
      }
    }

    return updated;
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
      skipEnroll?: boolean;
    },
  ) {
    const application = await this.getApplicationById(id, organizationId);

    if (application.convertedStudentId) {
      throw new Error('To zgłoszenie zostało już przekonwertowane na ucznia');
    }

    const organization = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: { name: true },
    });

    // Save plaintext password before hashing (for welcome email)
    const plaintextPassword = studentData.password;

    // Create student using existing studentService
    const student = await studentService.createStudent({
      ...studentData,
      organizationId,
      languageLevel: (studentData.languageLevel || 'A1') as LanguageLevel,
      language: studentData.language || 'en',
    });

    // Update application with converted student ID and ACCEPTED status
    await prisma.courseApplication.update({
      where: { id: application.id },
      data: {
        convertedStudentId: student.id,
        status: ApplicationStatus.ACCEPTED,
      },
    });

    // Auto-enroll student in the requested course (if application had courseId and not skipped)
    let enrolledCourseName: string | undefined;
    if (application.courseId && !studentData.skipEnroll) {
      try {
        const enrollment = await courseService.enrollStudent(
          application.courseId,
          student.id,
          organizationId,
        );
        enrolledCourseName = enrollment.course?.name || undefined;
      } catch (enrollError) {
        // Log but don't fail — enrollment may fail if course is full or already enrolled
        console.error('Failed to auto-enroll student from application:', enrollError);
      }
    }

    // Send welcome email with credentials
    try {
      await emailService.sendApplicationConverted({
        studentEmail: studentData.email,
        studentName: `${studentData.firstName} ${studentData.lastName}`,
        organizationName: organization?.name || '',
        temporaryPassword: plaintextPassword,
        courseName: enrolledCourseName,
      });
    } catch (emailError) {
      console.error('Failed to send application converted email:', emailError);
    }

    return { student, application, enrolledCourseName };
  }
}

export default new CourseApplicationService();
