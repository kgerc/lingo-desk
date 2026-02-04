import { PrismaClient, LessonStatus, LessonDeliveryMode, CourseFormat, LanguageLevel, CourseDeliveryMode } from '@prisma/client';
import emailService from './email.service';

const prisma = new PrismaClient();

// Day schedule with individual time for each day
interface DaySchedule {
  dayOfWeek: number; // 0 = Sunday, 1 = Monday, etc.
  time: string; // HH:mm format
}

// Helper to generate dates from pattern
// Supports both old format (single time) and new format (daySchedules with per-day times)
function generateDatesFromPattern(pattern: {
  frequency: 'WEEKLY' | 'BIWEEKLY' | 'MONTHLY';
  startDate: Date;
  endDate?: Date;
  occurrencesCount?: number;
  daysOfWeek?: number[]; // Legacy: single time for all days
  time?: string; // Legacy: single time for all days (HH:mm)
  daySchedules?: DaySchedule[]; // New: individual time per day
}): Date[] {
  const dates: Date[] = [];

  // Build effective day schedules - support both old and new format
  let effectiveDaySchedules: DaySchedule[] = [];

  if (pattern.daySchedules && pattern.daySchedules.length > 0) {
    // New format: use daySchedules directly
    effectiveDaySchedules = pattern.daySchedules;
  } else if (pattern.time) {
    // Legacy format: convert daysOfWeek + single time to daySchedules
    const legacyDays = pattern.daysOfWeek && pattern.daysOfWeek.length > 0
      ? pattern.daysOfWeek
      : [new Date(pattern.startDate).getDay()];
    effectiveDaySchedules = legacyDays.map(day => ({ dayOfWeek: day, time: pattern.time! }));
  } else {
    // Fallback: use start date's day with default time
    effectiveDaySchedules = [{ dayOfWeek: new Date(pattern.startDate).getDay(), time: '09:00' }];
  }

  const maxOccurrences = pattern.occurrencesCount || 52; // Default max 1 year of weekly lessons

  // For MONTHLY frequency, use simpler logic (use first day's time)
  if (pattern.frequency === 'MONTHLY') {
    const [hours, minutes] = (effectiveDaySchedules[0]?.time || '09:00').split(':').map(Number);
    let currentDate = new Date(pattern.startDate);
    currentDate.setHours(hours, minutes, 0, 0);

    let count = 0;
    while (count < maxOccurrences && (!pattern.endDate || currentDate <= pattern.endDate)) {
      dates.push(new Date(currentDate));
      count++;
      currentDate.setMonth(currentDate.getMonth() + 1);
    }
    return dates;
  }

  // For WEEKLY/BIWEEKLY with multiple days, iterate day by day within each week
  let weekCount = 0;
  const maxWeeks = Math.ceil(maxOccurrences / Math.max(effectiveDaySchedules.length, 1)) + 1;
  const weekInterval = pattern.frequency === 'BIWEEKLY' ? 2 : 1;

  // Find the start of the week containing startDate (Sunday = 0)
  const weekStart = new Date(pattern.startDate);
  weekStart.setDate(weekStart.getDate() - weekStart.getDay());
  weekStart.setHours(0, 0, 0, 0);

  while (weekCount < maxWeeks && dates.length < maxOccurrences) {
    // Check each selected day of this week (sorted by day)
    for (const daySchedule of [...effectiveDaySchedules].sort((a, b) => a.dayOfWeek - b.dayOfWeek)) {
      const [hours, minutes] = daySchedule.time.split(':').map(Number);
      const lessonDate = new Date(weekStart);
      lessonDate.setDate(lessonDate.getDate() + daySchedule.dayOfWeek);
      lessonDate.setHours(hours, minutes, 0, 0);

      // Skip if before start date
      if (lessonDate < pattern.startDate) continue;

      // Stop if after end date
      if (pattern.endDate && lessonDate > pattern.endDate) break;

      // Stop if we have enough occurrences
      if (dates.length >= maxOccurrences) break;

      dates.push(new Date(lessonDate));
    }

    // Move to next week (or skip a week for BIWEEKLY)
    weekStart.setDate(weekStart.getDate() + 7 * weekInterval);
    weekCount++;
  }

  return dates;
}

export interface CreateCourseData {
  organizationId: string;
  teacherId: string;
  name: string;
  // Pola przeniesione z CourseType:
  courseType: CourseFormat;
  language: string;
  level: LanguageLevel;
  deliveryMode: CourseDeliveryMode;
  defaultDurationMinutes: number;
  pricePerLesson: number;
  currency: string;
  description?: string;
  // Istniejące pola:
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
  // Pola przeniesione z CourseType:
  courseType?: CourseFormat;
  language?: string;
  level?: LanguageLevel;
  deliveryMode?: CourseDeliveryMode;
  defaultDurationMinutes?: number;
  pricePerLesson?: number;
  currency?: string;
  description?: string;
  // Istniejące pola:
  startDate?: Date;
  endDate?: Date;
  maxStudents?: number;
  locationId?: string;
  classroomId?: string;
  isActive?: boolean;
}

// Schedule item for creating lessons with course
export interface ScheduleItem {
  scheduledAt: Date;
  durationMinutes: number;
  title?: string;
  deliveryMode: 'IN_PERSON' | 'ONLINE';
  meetingUrl?: string;
}

// Individual day schedule with time
export interface DayScheduleItem {
  dayOfWeek: number; // 0 = Sunday, 1 = Monday, etc.
  time: string; // HH:mm format
}

// Pattern for recurring lessons in schedule
export interface SchedulePattern {
  frequency: 'WEEKLY' | 'BIWEEKLY' | 'MONTHLY';
  startDate: Date;
  endDate?: Date;
  occurrencesCount?: number;
  // Legacy: single time for all selected days
  daysOfWeek?: number[]; // 0 = Sunday, 1 = Monday, etc.
  time?: string; // HH:mm format (used when daysOfWeek is set)
  // New: individual time per day
  daySchedules?: DayScheduleItem[]; // Each day has its own time
  durationMinutes: number;
  deliveryMode: 'IN_PERSON' | 'ONLINE';
  meetingUrl?: string;
}

export interface CreateCourseWithScheduleData extends CreateCourseData {
  schedule?: {
    items?: ScheduleItem[];
    pattern?: SchedulePattern;
  };
  studentIds?: string[]; // Students to enroll automatically
}

export interface BulkUpdateLessonsData {
  teacherId?: string;
  durationMinutes?: number;
  deliveryMode?: 'IN_PERSON' | 'ONLINE';
  meetingUrl?: string | null;
  locationId?: string | null;
  classroomId?: string | null;
}

export interface CourseFilters {
  search?: string;
  teacherId?: string;
  courseType?: CourseFormat;
  isActive?: boolean;
}

class CourseService {
  async createCourse(data: CreateCourseData) {
    const { organizationId, teacherId, ...courseData } = data;

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
        teacherId,
        ...courseData,
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

  /**
   * Create course with schedule (lessons) in a single transaction
   */
  async createCourseWithSchedule(data: CreateCourseWithScheduleData) {
    const { organizationId, teacherId, schedule, studentIds, ...courseData } = data;

    // Verify teacher exists and belongs to organization
    const teacher = await prisma.teacher.findFirst({
      where: {
        id: teacherId,
        user: { organizationId },
      },
      include: {
        user: true,
      },
    });

    if (!teacher) {
      throw new Error('Teacher not found');
    }

    // Verify students exist if provided
    if (studentIds && studentIds.length > 0) {
      const students = await prisma.student.findMany({
        where: {
          id: { in: studentIds },
          user: { organizationId },
        },
      });

      if (students.length !== studentIds.length) {
        throw new Error('One or more students not found');
      }
    }

    // Calculate lesson dates from schedule
    let lessonDates: { date: Date; durationMinutes: number; title?: string; deliveryMode: 'IN_PERSON' | 'ONLINE'; meetingUrl?: string }[] = [];

    if (schedule?.items && schedule.items.length > 0) {
      // Manual schedule items
      lessonDates = schedule.items.map(item => ({
        date: new Date(item.scheduledAt),
        durationMinutes: item.durationMinutes,
        title: item.title,
        deliveryMode: item.deliveryMode,
        meetingUrl: item.meetingUrl,
      }));
    } else if (schedule?.pattern) {
      // Recurring pattern
      const dates = generateDatesFromPattern(schedule.pattern);
      lessonDates = dates.map(date => ({
        date,
        durationMinutes: schedule.pattern!.durationMinutes,
        deliveryMode: schedule.pattern!.deliveryMode,
        meetingUrl: schedule.pattern!.meetingUrl,
      }));
    }

    // Use transaction to create everything atomically
    const result = await prisma.$transaction(async (tx) => {
      // 1. Create the course
      const course = await tx.course.create({
        data: {
          organizationId,
          teacherId,
          ...courseData,
        },
      });

      // 2. Create enrollments for students
      const enrollments: { id: string; studentId: string }[] = [];
      if (studentIds && studentIds.length > 0) {
        for (const studentId of studentIds) {
          const enrollment = await tx.studentEnrollment.create({
            data: {
              courseId: course.id,
              studentId,
              enrollmentDate: new Date(),
              status: 'ACTIVE',
              paymentMode: 'PER_LESSON',
              hoursPurchased: 0,
              hoursUsed: 0,
            },
          });
          enrollments.push({ id: enrollment.id, studentId });
        }
      }

      // 3. Create lessons for each student and each date
      const lessons: any[] = [];
      const errors: { date: string; studentId: string; error: string }[] = [];

      // Use price per lesson from course
      const pricePerLesson = courseData.pricePerLesson ? Number(courseData.pricePerLesson) : undefined;

      for (const lessonDate of lessonDates) {
        for (const enrollment of enrollments) {
          try {
            const lesson = await tx.lesson.create({
              data: {
                organizationId,
                courseId: course.id,
                enrollmentId: enrollment.id,
                teacherId,
                studentId: enrollment.studentId,
                title: lessonDate.title || course.name,
                scheduledAt: lessonDate.date,
                durationMinutes: lessonDate.durationMinutes,
                deliveryMode: lessonDate.deliveryMode as LessonDeliveryMode,
                meetingUrl: lessonDate.meetingUrl,
                status: 'SCHEDULED' as LessonStatus,
                pricePerLesson,
                currency: courseData.currency || 'PLN',
              },
            });
            lessons.push(lesson);
          } catch (error) {
            errors.push({
              date: lessonDate.date.toISOString(),
              studentId: enrollment.studentId,
              error: error instanceof Error ? error.message : 'Unknown error',
            });
          }
        }
      }

      return {
        course,
        enrollments,
        lessons,
        errors,
      };
    });

    // Fetch full course data with relations
    const fullCourse = await prisma.course.findUnique({
      where: { id: result.course.id },
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
        enrollments: {
          where: { status: 'ACTIVE' },
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
    });

    return {
      course: fullCourse,
      lessonsCreated: result.lessons.length,
      enrollmentsCreated: result.enrollments.length,
      errors: result.errors,
    };
  }

  /**
   * Bulk update future lessons of a course
   * Only updates lessons with status SCHEDULED and scheduledAt >= now
   */
  async bulkUpdateCourseLessons(
    courseId: string,
    organizationId: string,
    updates: BulkUpdateLessonsData
  ) {
    // Verify course exists
    const course = await prisma.course.findFirst({
      where: {
        id: courseId,
        organizationId,
      },
    });

    if (!course) {
      throw new Error('Course not found');
    }

    // Find all future lessons that can be updated
    const now = new Date();
    const futureLessons = await prisma.lesson.findMany({
      where: {
        courseId,
        organizationId,
        scheduledAt: { gte: now },
        status: 'SCHEDULED',
      },
      select: { id: true },
    });

    if (futureLessons.length === 0) {
      return {
        updated: 0,
        message: 'No future lessons found to update',
      };
    }

    // Verify teacher if changing
    if (updates.teacherId) {
      const teacher = await prisma.teacher.findFirst({
        where: {
          id: updates.teacherId,
          user: { organizationId },
        },
      });

      if (!teacher) {
        throw new Error('Teacher not found');
      }
    }

    // Build update data
    const updateData: any = {};
    if (updates.teacherId) updateData.teacherId = updates.teacherId;
    if (updates.durationMinutes) updateData.durationMinutes = updates.durationMinutes;
    if (updates.deliveryMode) updateData.deliveryMode = updates.deliveryMode;
    if (updates.meetingUrl !== undefined) updateData.meetingUrl = updates.meetingUrl;
    if (updates.locationId !== undefined) updateData.locationId = updates.locationId;
    if (updates.classroomId !== undefined) updateData.classroomId = updates.classroomId;

    // Update all future lessons
    const result = await prisma.lesson.updateMany({
      where: {
        id: { in: futureLessons.map(l => l.id) },
      },
      data: updateData,
    });

    return {
      updated: result.count,
      message: `Successfully updated ${result.count} lessons`,
    };
  }

  /**
   * Get course lessons with their edit status
   */
  async getCourseLessonsForEdit(courseId: string, organizationId: string) {
    const course = await prisma.course.findFirst({
      where: {
        id: courseId,
        organizationId,
      },
    });

    if (!course) {
      throw new Error('Course not found');
    }

    const now = new Date();
    const lessons = await prisma.lesson.findMany({
      where: {
        courseId,
        organizationId,
      },
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
      orderBy: {
        scheduledAt: 'asc',
      },
    });

    return lessons.map(lesson => ({
      ...lesson,
      canEdit: lesson.scheduledAt >= now && lesson.status === 'SCHEDULED',
      editBlockReason: lesson.scheduledAt < now
        ? 'Lekcja już się odbyła'
        : lesson.status !== 'SCHEDULED'
          ? `Status: ${lesson.status}`
          : null,
    }));
  }

  async getCourses(organizationId: string, filters?: CourseFilters) {
    const { search, teacherId, courseType, isActive } = filters || {};

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

    if (courseType) {
      where.courseType = courseType;
    }

    if (isActive !== undefined) {
      where.isActive = isActive;
    }

    const courses = await prisma.course.findMany({
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
        course: true,
      },
    });

    // Send enrollment confirmation email
    try {
      await emailService.sendEnrollmentConfirmation({
        studentEmail: enrollment.student.user.email,
        studentName: `${enrollment.student.user.firstName} ${enrollment.student.user.lastName}`,
        courseName: enrollment.course!.name,
        courseType: `${enrollment.course!.courseType === 'GROUP' ? 'Grupowy' : 'Indywidualny'} - ${enrollment.course!.language} ${enrollment.course!.level}`,
        startDate: enrollment.course!.startDate,
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
