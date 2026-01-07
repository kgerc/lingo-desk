import { PrismaClient } from '@prisma/client';
import emailService from './email.service';

const prisma = new PrismaClient();

export interface CreateCourseData {
  organizationId: string;
  courseTypeId: string;
  teacherId: string;
  name: string;
  startDate: Date;
  endDate?: Date;
  maxStudents?: number;
  locationId?: string;
  classroomId?: string;
  isActive: boolean;
}

export interface UpdateCourseData {
  teacherId?: string;
  name?: string;
  startDate?: Date;
  endDate?: Date;
  maxStudents?: number;
  locationId?: string;
  classroomId?: string;
  isActive?: boolean;
}

export interface CourseFilters {
  search?: string;
  teacherId?: string;
  courseTypeId?: string;
  isActive?: boolean;
}

class CourseService {
  async createCourse(data: CreateCourseData) {
    const { organizationId, courseTypeId, teacherId, ...courseData } = data;

    // Verify course type exists and belongs to organization
    const courseType = await prisma.courseType.findFirst({
      where: {
        id: courseTypeId,
        organizationId,
      },
    });

    if (!courseType) {
      throw new Error('Course type not found');
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

    // Create course
    const course = await prisma.course.create({
      data: {
        organizationId,
        courseTypeId,
        teacherId,
        ...courseData,
      },
      include: {
        courseType: true,
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
        _count: {
          select: {
            enrollments: true,
            lessons: true,
          },
        },
      },
    });

    return course;
  }

  async getCourses(organizationId: string, filters?: CourseFilters) {
    const { search, teacherId, courseTypeId, isActive } = filters || {};

    const where: any = {
      organizationId,
    };

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
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
      ];
    }

    if (teacherId) {
      where.teacherId = teacherId;
    }

    if (courseTypeId) {
      where.courseTypeId = courseTypeId;
    }

    if (isActive !== undefined) {
      where.isActive = isActive;
    }

    const courses = await prisma.course.findMany({
      where,
      include: {
        courseType: true,
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
        enrollments: {
          where: {
            status: 'ACTIVE',
          },
          select: {
            id: true,
            studentId: true,
            status: true,
          },
        },
        _count: {
          select: {
            enrollments: true,
            lessons: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return courses;
  }

  async getCourseById(id: string, organizationId: string) {
    const course = await prisma.course.findFirst({
      where: {
        id,
        organizationId,
      },
      include: {
        courseType: true,
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
        location: true,
        classroom: true,
        enrollments: {
          where: {
            status: 'ACTIVE',
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
                    avatarUrl: true,
                  },
                },
              },
            },
          },
        },
        lessons: {
          include: {
            attendances: true,
          },
          orderBy: {
            scheduledAt: 'desc',
          },
          take: 10,
        },
        _count: {
          select: {
            enrollments: true,
            lessons: true,
          },
        },
      },
    });

    if (!course) {
      throw new Error('Course not found');
    }

    return course;
  }

  async updateCourse(id: string, organizationId: string, data: UpdateCourseData) {
    const { teacherId, ...updateData } = data;

    // Verify course exists
    const existingCourse = await prisma.course.findFirst({
      where: {
        id,
        organizationId,
      },
    });

    if (!existingCourse) {
      throw new Error('Course not found');
    }

    // Verify teacher exists if provided
    if (teacherId) {
      const teacher = await prisma.teacher.findFirst({
        where: {
          id: teacherId,
          user: { organizationId },
        },
      });

      if (!teacher) {
        throw new Error('Teacher not found');
      }
    }

    const course = await prisma.course.update({
      where: { id },
      data: {
        teacherId,
        ...updateData,
      },
      include: {
        courseType: true,
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
        _count: {
          select: {
            enrollments: true,
            lessons: true,
          },
        },
      },
    });

    return course;
  }

  async deleteCourse(id: string, organizationId: string) {
    // Verify course exists
    const course = await prisma.course.findFirst({
      where: {
        id,
        organizationId,
      },
    });

    if (!course) {
      throw new Error('Course not found');
    }

    // Check for active enrollments
    const activeEnrollments = await prisma.studentEnrollment.count({
      where: {
        courseId: id,
        status: 'ACTIVE',
      },
    });

    if (activeEnrollments > 0) {
      throw new Error(`Cannot delete course with ${activeEnrollments} active enrollments`);
    }

    // Check for future lessons
    const futureLessons = await prisma.lesson.count({
      where: {
        courseId: id,
        scheduledAt: { gte: new Date() },
      },
    });

    if (futureLessons > 0) {
      throw new Error(`Cannot delete course with ${futureLessons} scheduled lessons`);
    }

    // Soft delete by marking as inactive
    await prisma.course.update({
      where: { id },
      data: { isActive: false },
    });

    return { message: 'Course deleted successfully' };
  }

  async getCourseStats(organizationId: string) {
    const total = await prisma.course.count({
      where: { organizationId },
    });

    const active = await prisma.course.count({
      where: {
        organizationId,
        isActive: true,
      },
    });

    const withEnrollments = await prisma.course.count({
      where: {
        organizationId,
        isActive: true,
        enrollments: {
          some: {
            status: 'ACTIVE',
          },
        },
      },
    });

    return {
      total,
      active,
      withEnrollments,
    };
  }

  // Enroll student in course
  async enrollStudent(
    courseId: string,
    studentId: string,
    organizationId: string,
    paymentMode?: 'PACKAGE' | 'PER_LESSON',
    hoursPurchased?: number
  ) {
    // Verify course exists and is active
    const course = await prisma.course.findFirst({
      where: {
        id: courseId,
        organizationId,
        isActive: true,
      },
      include: {
        enrollments: {
          where: {
            status: 'ACTIVE',
          },
        },
      },
    });

    if (!course) {
      throw new Error('Course not found or inactive');
    }

    // Check if course is full (count only active enrollments)
    const activeEnrollmentsCount = course.enrollments.length;
    if (course.maxStudents && activeEnrollmentsCount >= course.maxStudents) {
      throw new Error('Course is full');
    }

    // Verify student exists
    const student = await prisma.student.findFirst({
      where: {
        id: studentId,
        user: { organizationId },
      },
    });

    if (!student) {
      throw new Error('Student not found');
    }

    // Check if already enrolled
    const existingEnrollment = await prisma.studentEnrollment.findFirst({
      where: {
        courseId,
        studentId,
        status: 'ACTIVE',
      },
    });

    if (existingEnrollment) {
      throw new Error('Student already enrolled in this course');
    }

    // Create enrollment
    const enrollment = await prisma.studentEnrollment.create({
      data: {
        courseId,
        studentId,
        enrollmentDate: new Date(),
        status: 'ACTIVE',
        paymentMode: paymentMode || 'PACKAGE',
        hoursPurchased: hoursPurchased || 0,
        hoursUsed: 0,
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

    // Send enrollment confirmation email
    try {
      await emailService.sendEnrollmentConfirmation({
        studentEmail: enrollment.student.user.email,
        studentName: `${enrollment.student.user.firstName} ${enrollment.student.user.lastName}`,
        courseName: enrollment.course.name,
        courseType: `${enrollment.course.courseType.name} - ${enrollment.course.courseType.language} ${enrollment.course.courseType.level}`,
        startDate: enrollment.course.startDate,
      });
    } catch (emailError) {
      console.error('Failed to send enrollment confirmation email:', emailError);
      // Don't fail the enrollment if email fails
    }

    return enrollment;
  }

  // Unenroll student from course
  async unenrollStudent(enrollmentId: string, organizationId: string) {
    const enrollment = await prisma.studentEnrollment.findFirst({
      where: {
        id: enrollmentId,
        course: { organizationId },
      },
    });

    if (!enrollment) {
      throw new Error('Enrollment not found');
    }

    // Soft delete - mark as cancelled
    await prisma.studentEnrollment.update({
      where: { id: enrollmentId },
      data: { status: 'CANCELLED' },
    });

    return { message: 'Student unenrolled successfully' };
  }
}

export default new CourseService();
