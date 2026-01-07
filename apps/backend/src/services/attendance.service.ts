import { PrismaClient, AttendanceStatus } from '@prisma/client';

const prisma = new PrismaClient();

export interface CreateAttendanceData {
  lessonId: string;
  studentId: string;
  status: AttendanceStatus;
  notes?: string;
}

export interface UpdateAttendanceData {
  status?: AttendanceStatus;
  notes?: string;
}

class AttendanceService {
  async createAttendance(data: CreateAttendanceData, organizationId: string) {
    // Verify lesson exists and belongs to organization
    const lesson = await prisma.lesson.findFirst({
      where: {
        id: data.lessonId,
        organizationId,
      },
    });

    if (!lesson) {
      throw new Error('Lesson not found');
    }

    // Verify student exists and belongs to organization
    const student = await prisma.student.findFirst({
      where: {
        id: data.studentId,
        organizationId,
      },
    });

    if (!student) {
      throw new Error('Student not found');
    }

    // Check if attendance already exists
    const existingAttendance = await prisma.lessonAttendance.findUnique({
      where: {
        lessonId_studentId: {
          lessonId: data.lessonId,
          studentId: data.studentId,
        },
      },
    });

    if (existingAttendance) {
      throw new Error('Attendance record already exists for this lesson and student');
    }

    const attendance = await prisma.lessonAttendance.create({
      data: {
        lessonId: data.lessonId,
        studentId: data.studentId,
        status: data.status,
        notes: data.notes,
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
      },
    });

    return attendance;
  }

  async updateAttendance(
    lessonId: string,
    studentId: string,
    data: UpdateAttendanceData,
    organizationId: string
  ) {
    // Verify attendance exists and belongs to organization
    const attendance = await prisma.lessonAttendance.findFirst({
      where: {
        lessonId,
        studentId,
        lesson: {
          organizationId,
        },
      },
    });

    if (!attendance) {
      throw new Error('Attendance record not found');
    }

    const updatedAttendance = await prisma.lessonAttendance.update({
      where: {
        lessonId_studentId: {
          lessonId,
          studentId,
        },
      },
      data,
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
      },
    });

    return updatedAttendance;
  }

  async getAttendanceByLesson(lessonId: string, organizationId: string) {
    // Verify lesson exists and belongs to organization
    const lesson = await prisma.lesson.findFirst({
      where: {
        id: lessonId,
        organizationId,
      },
    });

    if (!lesson) {
      throw new Error('Lesson not found');
    }

    const attendances = await prisma.lessonAttendance.findMany({
      where: {
        lessonId,
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
      },
      orderBy: {
        createdAt: 'asc',
      },
    });

    return attendances;
  }

  async deleteAttendance(lessonId: string, studentId: string, organizationId: string) {
    // Verify attendance exists and belongs to organization
    const attendance = await prisma.lessonAttendance.findFirst({
      where: {
        lessonId,
        studentId,
        lesson: {
          organizationId,
        },
      },
    });

    if (!attendance) {
      throw new Error('Attendance record not found');
    }

    await prisma.lessonAttendance.delete({
      where: {
        lessonId_studentId: {
          lessonId,
          studentId,
        },
      },
    });

    return { message: 'Attendance deleted successfully' };
  }

  async bulkUpsertAttendance(
    lessonId: string,
    attendances: Array<{ studentId: string; status: AttendanceStatus; notes?: string }>,
    organizationId: string
  ) {
    // Verify lesson exists and belongs to organization
    const lesson = await prisma.lesson.findFirst({
      where: {
        id: lessonId,
        organizationId,
      },
    });

    if (!lesson) {
      throw new Error('Lesson not found');
    }

    // Use transaction to ensure all updates succeed or fail together
    const results = await prisma.$transaction(
      attendances.map((attendance) =>
        prisma.lessonAttendance.upsert({
          where: {
            lessonId_studentId: {
              lessonId,
              studentId: attendance.studentId,
            },
          },
          update: {
            status: attendance.status,
            notes: attendance.notes,
          },
          create: {
            lessonId,
            studentId: attendance.studentId,
            status: attendance.status,
            notes: attendance.notes,
          },
        })
      )
    );

    return results;
  }
}

export default new AttendanceService();
