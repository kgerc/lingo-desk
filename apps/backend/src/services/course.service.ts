import { PrismaClient } from '@prisma/client';

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
            attendance: true,
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
    const activeEnrollments = await prisma.enrollment.count({
      where: {
        courseId: id,
        isActive: true,
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
            isActive: true,
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
  async enrollStudent(courseId: string, studentId: string, organizationId: string) {
    // Verify course exists and is active
    const course = await prisma.course.findFirst({
      where: {
        id: courseId,
        organizationId,
        isActive: true,
      },
      include: {
        _count: {
          select: {
            enrollments: true,
          },
        },
      },
    });

    if (!course) {
      throw new Error('Course not found or inactive');
    }

    // Check if course is full
    if (course.maxStudents && course._count.enrollments >= course.maxStudents) {
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
    const existingEnrollment = await prisma.enrollment.findFirst({
      where: {
        courseId,
        studentId,
      },
    });

    if (existingEnrollment) {
      throw new Error('Student already enrolled in this course');
    }

    // Create enrollment
    const enrollment = await prisma.enrollment.create({
      data: {
        courseId,
        studentId,
        enrolledAt: new Date(),
        isActive: true,
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

    return enrollment;
  }

  // Unenroll student from course
  async unenrollStudent(enrollmentId: string, organizationId: string) {
    const enrollment = await prisma.enrollment.findFirst({
      where: {
        id: enrollmentId,
        course: { organizationId },
      },
    });

    if (!enrollment) {
      throw new Error('Enrollment not found');
    }

    // Soft delete - mark as inactive
    await prisma.enrollment.update({
      where: { id: enrollmentId },
      data: { isActive: false },
    });

    return { message: 'Student unenrolled successfully' };
  }
}

export default new CourseService();
